# Clock-bracketed event replay

The offline v2 report bounds elapsed server ticks between logged decisions and
associated events. It never changes policy state, rewards, replay buffers,
checkpoints, or the Minecraft world. `trainingEligible` is always false.

## Analysis of the supplied live result

The supplied report contains 1,231 clock samples and 200 decisions, of which 158
(79%) are bracketed; 42 (21%) lack bounds. The excerpt does not establish why
those 42 failed. Regenerate with v2 and inspect `diagnostics.bracketStatuses`.

Decision #6606 at `2026-11-02T01:53:19.912Z` and its transition at
`2026-11-02T01:53:21.684Z` are 1,772 ms apart. Both have tick interval
`[7547293, 7547394]`. For ordered endpoints S in [Ls, Us], E in [Le, Ue]:

```text
minimum elapsed ticks = max(0, Le - Us)
maximum elapsed ticks = Ue - Ls
```

Thus this pair admits **[0, 101] ticks**, not exactly 101, not zero, and not a
wall-time-derived 35.44 ticks. These extrema cover every ordered pair consistent
with the brackets. No constant tick rate, interpolation, or midpoint is assumed.
A singleton interval still does not prove an option's causal boundary or reward
timing. `target_transition` records the controller's observation/update boundary;
it is not proof that a navigation goal or physical action finished then.

The sampled tick values span 101 ticks across roughly five seconds, consistent
with the configured five-second sampling interval. A faster observer cadence may
narrow future bounds but cannot turn asynchronous RCON observations into exact
event instrumentation. The raw 1,231-sample / 200-decision files are not in this
checkout; the supplied timestamps and tick interval are covered by a regression
test, not presented as a rerun of the complete live dataset.

## Identity, continuity, and correlation

- Agent logs now carry a fresh process UUID `sessionId`, increasing
  `eventSequence`, and local `monotonicMs`. One envelope covers all producers and
  agents in that process. Identity is `(sessionId, agent_id, decisionId)`.
  These fields are added only at logging, outside the learner and checkpoint.
- Clock samples use schema `craftle.server-clock.v2`, a fresh
  `collectorSessionId`, and `sampleSequence`. Epoch advances on observed world
  changes, decreasing gametime, or decreasing observation wall time. Collector
  failures are written into the JSONL stream as continuity barriers.
- Replay retains acquisition order. It splits at invalid samples, clock errors,
  session/epoch/world changes, decreasing ticks, sequence resets, and overlapping
  or reversed query windows. Wall-time overlap between segments is ambiguous.
  A duration cannot cross segments even if its two endpoint brackets are valid.
- Legacy logs remain readable. Missing agent sessions use a per-agent inferred
  segment based on `connecting` records and decreasing decision IDs. Missing
  collector sessions are marked `legacy_inferred`. Restarts with no observable
  boundary cannot be reconstructed reliably; inferred identity is not proof.
- Missing IDs are never wildcard matches. Correlation checks timestamp order,
  sequence order when present, and action consistency when present. Late events
  with an explicit matching identity remain associated with their own decision.
  Duplicate decision identities or multiple closing events prevent a unique
  duration. All associations retain `id_association_not_causal_proof`.
- Query completion must be strictly before the event's earliest wall time, and
  the later query must start strictly after its latest wall time. Equal
  millisecond timestamps do not establish ordering and require wider samples.
- Two passes over a fixed log prefix retain the latest N decisions independently
  of event volume. A hash detects edits to that prefix between passes. There is
  a 1,000-event cap per selected identity; truncation is counted and prevents a
  final duration. Ordinary concurrent appends are excluded from the snapshot.

Bounds assume monotonic server gametime within a segment and a known bound on
relative agent/collector wall-clock error. `--clock-skew-ms` widens the event's
wall-time uncertainty in both directions; default 0 means an explicit assumption
of a common synchronized clock, not a measured guarantee. The default maximum
enclosing query span is 15,000 ms; longer gaps report `stale_clock_gap`. RCON
round-trip time is included in that span. Missing before/after coverage reports
`unbounded`. Reports expose all status counts instead of only a success count.

A collector UUID is **not a server boot ID or world incarnation ID**. Restoring
or restarting a world without an observed gametime decrease remains undetectable.
Exact learning transitions would require server-side event stamps, stable world
incarnation identity, explicitly linked option start/end and reward events, and
synchronized or bounded clock error. This change does not wire the report into
SMDP learning or change the existing controller's `steps: 1` update.

## Local checks and offline deployment

Use a separate checkout of this branch so working on reporting code cannot
replace files mounted by a live agent. Fetch/pull only in that checkout. Run:

```powershell
node --test test/clock-event-correlation.test.js test/clock-bracketed-replay.test.js test/clock-collector.test.js test/event-envelope.test.js test/server-tick-clock.test.js test/minecraft-clock-rcon.test.js test/option-transition.test.js test/smdp-target.test.js
npm test
```

Validated locally with Node 22.15.0: **364 tests passed, 0 failed**. Coverage
includes exhaustive small-interval duration bounds, the supplied #6606 example,
query-boundary timestamp ties, rollback/restart ambiguity, session collisions,
legacy multi-agent logs, duplicate endpoints, output overwrite protection, and a
mock RCON server that verifies collector restarts and read-only commands. No live
Minecraft service or learner was started by these checks.

Generate against existing log paths (reading them is sufficient; the collector
and agent need not restart). Choose a new output filename for every run:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
node scripts/build-clock-bracketed-replay.js `
  'C:\path\to\live\deploy\filming\state\agent\continuous\agent.log' `
  'C:\path\to\live\deploy\filming\state\observer\server-clock.jsonl' `
  "clock-bracketed-events-v2-$stamp.json" 200 `
  --max-sample-gap-ms 15000 --clock-skew-ms 0
$report = Get-Content "clock-bracketed-events-v2-$stamp.json" -Raw | ConvertFrom-Json
$report.diagnostics
$report.records | Select-Object decisionId, sessionId, duration
```

Replace the two input paths with the existing deployment paths. Set clock skew
from your deployment's measured synchronization bound; do not assume 0 across
unverified hosts. The tool exclusively creates its output and refuses to replace
any existing file, including either input or a checkpoint. Inputs are read only.

## Optional collector-only rollout

This rollout is supplied for operator use; it was not run against the live
server. In the existing deployment checkout, copy only the reviewed
`scripts/collect-server-clock.js` and `src/server-tick-clock.js` files from the
separate checkout, then restart only the observer service:

```powershell
docker compose -f deploy/filming/compose.yml --profile clock up -d --no-deps clock
docker compose -f deploy/filming/compose.yml --profile clock restart clock
Get-Content .\deploy\filming\state\observer\server-clock.jsonl -Tail 5
```

The second command is necessary when an already-running bind-mounted collector
must reload changed code. Do not run a blanket `compose up`, restart the agent,
or replace checkpoint/state directories for this report update. Verify new
samples have a nonempty `collectorSessionId`, increasing `sampleSequence`, and
valid requested/completed times. Expect a conservative boundary at the collector
restart. Wait for at least two successful samples before evaluating new events.
The default five-second interval is unchanged. To trial one-second sampling,
set `CRAFTLE_CLOCK_INTERVAL_MS=1000` for the collector and recreate only that
service with `up -d --no-deps --force-recreate clock`; measure RCON overhead and
reported widths before retaining that setting.

Agent session instrumentation becomes active only at a separately planned agent
restart/redeployment using both `src/main.js` and `src/event-envelope.js`. It is
not required to analyze legacy logs. No agent restart is part of the collector
rollout. Roll back collector code by restoring those two observer files and
restarting only `clock`; retain existing logs and use a fresh report filename.
