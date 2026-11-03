# SpectatorPlus acceptance and promotion gate — Craftle

Status: **NOT PROMOTED**. A passing local unit test does not establish experimental non-interference.

## Target
- Filming clone: vanilla Java 1.21.1, host port 25575, camera account `dyl_is_here`, learner `Turesla`.
- Main experiment: persistent vanilla Java 1.21.1, host port 25565; reward-v2 continuous learner.
- SpectatorPlus upstream: hpfxd/SpectatorPlus, a client/server mod with **limited client-only behavior**. Health, food, hotbar, inventory and screen synchronization require a compatible server-side Fabric/Paper installation; do not expect these from vanilla.
- Never install Fabric/Paper/SpectatorPlus server side on main without an explicitly separate, versioned experimental condition.

## Gate A — isolated filming functional trial
1. Confirm the precise Minecraft and SpectatorPlus client jar versions; use a Fabric client compatible with Java 1.21.1. Keep a second unmodded client profile.
2. On filming server only, query `gamerule spectatorsGenerateChunks` via `docker compose -f deploy/filming/compose.yml exec -T minecraft rcon-cli "gamerule spectatorsGenerateChunks"`. Require `false` before camera joins.
3. Run `node --test test/spectator-monitor.test.js test/spectator-director.test.js test/spectator-telemetry.test.js`.
4. Check filming browser monitor `http://127.0.0.1:3011/observatory` and telemetry freshness. A functioning web monitor is distinct from a native in-game camera.
5. Join filming server at localhost:25575 as `dyl_is_here`; camera must be spectator; follow `Turesla` in first person. Check held item and health UI; do **not** claim vanilla server transmits mod-only full inventory or hunger.
6. Trigger a natural agent death/respawn and reconnect camera; verify attachment recovery without sending any controls to Turesla. Capture short video with visible HUD, target and time.
7. Require zero learner control endpoints exposed through the viewer and no agent gameplay actions initiated by observer.

## Gate B — observational isolation (not definitive)
1. Disconnect camera. Gather baseline with `scripts/sample-filming-environment.ps1 -Phase baseline -Samples 24 -IntervalSeconds 5`.
2. Join as camera; gather `-Phase spectator` with the same arguments. Keep observer near Turesla, never free-fly to unexplored chunks.
3. Compare `recordings/isolation/baseline.jsonl` and `spectator.jsonl`, observer player-info/chat visibility audits, server gamerule, and agent-observed entities. Expect camera to be player-list visible on an ordinary vanilla server.
4. If contamination signals or unexpected changes appear, stop. Simple A/B RCON samples **cannot** establish zero experimental impact.

## Gate C — research-grade promotion
- Native spectator must **not** connect to the live persistent learning server unless isolation is demonstrated with matched-seed, frozen-checkpoint trials and server-side chunk/tick/entity instrumentation; player-list invisibility alone is insufficient.
- Read-only tools may be promoted independently (offline log replay, observatory, annotations, recording of the filming clone) without connecting spectator to main.
- Preserve main checkpoint, logs and Docker volumes. Do not run `down -v`, switch main from vanilla, or restart main agent for observer testing.
- Promotion requires explicit documented results: mod version compatibility, video evidence, follow-after-death result, audits, and research-isolation verdict.
- If the client-only mod passes functional trial, approve its use on **filming only**; maintain main experiment as independent control. Revisit full server-side implementation as a new, isolated Fabric/Paper experiment.

## Deferred follow-up
- Why Turesla stayed at 1 health during starvation: record `DIFFICULTY=normal` and distinguish starvation-floor behavior from eventual mob-caused death; inspect authoritative death cause and timestamps before attribution.
- Canopy navigation: preserve episode logs and video; do not interpret pathfinder motion as neural skill learning.
