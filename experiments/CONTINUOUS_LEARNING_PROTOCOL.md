# Craftle continuous experiment protocol (v0.1)

Sources consulted: [Mineflayer](https://github.com/PrismarineJS/mineflayer), [Mineflayer Pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder), [Voyager](https://github.com/MineDojo/Voyager), and related MineRL/MineDojo benchmark designs.

## Implemented now

- `.github/workflows/continuous-learning.yml`: hourly GitHub Actions trigger; serializes training runs via concurrency group; same Mineflayer environment and verified-outcome reward v3.
- A training job restores the most recent matching cached **network weights**, performs a bounded 180-second survival episode on Paper 1.21.1, writes lineage with Git SHA/cache key, audits event→reward linkage, archives first-person recording/logs and saves a new checkpoint.
- Separate `vanilla-v3-transfer.yml` runs Mojang vanilla, not Create. Current vanilla track trains independently; **not yet a frozen transfer evaluation**.
- Keep trained-assistance labels explicit: forage/eat/explore/retreat remain SCRIPTED Mineflayer primitives; only option selection is learned.
- Confidence criteria: food consumption with increased hunger, validated option reward, network update, zero duplicate credits, and held-out improvement versus random/scripted/frozen.

## Limitations / next research engineering gates

1. This is *periodic continuing training*, not uninterrupted 24/7 uptime: workflow scheduling can be delayed and jobs can fail. The max episode here is 180 seconds per hourly run.
2. Checkpoints preserve model weights and update count, **not** optimizer/replay buffer/PRNG, so episode boundaries are not bit-exact resumptions. Cache restoration is best-effort; cold starts flagged in lineage. Cache entries can be evicted, and attempts may be skipped.
3. World seed is currently fixed to 20261205; vary train seeds separately from held-out seeds before claiming generalization.
4. The prerecorded POV covers each short episode but does not constitute multi-day unbroken video. Run quality depends on timestamp/frame-gap audit.
5. Need durable storage beyond short-lived Actions cache; plan external object storage or GitHub Release asset retention for archival checkpoints, manifests and replay history. For scientific chain of custody track incoming/outgoing SHA256 and restore failures.
6. Need a frozen-policy evaluator across Paper, vanilla and eventually Create/NeoForge plus paired scripted/random controls and blinded held-out seeds.
7. Voyager's automatic curriculum, skill memory and iterative execution are architectural inspirations; we do **not** import pretrained LLM content or claim Voyager-style discovery.
8. Add agent-selected consolidation actions (journal/sleep/replay) with provenance labels REAL/REPLAY/DREAM; evaluate ablations, not just self-reported intelligence.
9. Validate the new workflow in a live scheduled/dispatch run before asserting end-to-end continuity.

## Stop conditions

Fail experiment and retain diagnostics on corrupt checkpoint, missing world readiness, malformed observation, mismatched reward evidence, no frames, or non-monotonic capture timestamps. **Do not treat no-meal episodes as infrastructure failure**, but record their negative outcome.

