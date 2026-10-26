## Filming observer audit (opt-in, not proof of zero impact)

The agent can now log whether its Mineflayer `bot.players` registry includes the camera username, whether any `bot.entities` entry has the camera username, and whether received chat mentions that name. These are passive reads; the policy remains unchanged. Enable **only in the isolated filming server**:

```powershell
git pull origin main
$env:CRAFTLE_CAMERA_USERNAME = "YOUR_ACTUAL_MINECRAFT_USERNAME"
$env:CRAFTLE_OBSERVER_AUDIT = "1"
docker compose -f deploy/filming/compose.yml --profile learning up -d --build --no-deps --force-recreate agent
docker compose -f deploy/filming/compose.yml --profile learning exec agent sh -lc "grep 'observer_visibility_audit\|observer_chat_audit' /state/agent/continuous/agent.log | tail -20"
```

The audit should be enabled while the camera account is logged in. This command **restarts only the filming agent**, not the persistent learning agent or Minecraft server. It reports exposure through Mineflayer's public registries, not every raw player-info/network packet, and does not establish whether the server's mob spawning, chunk loading, ticks, or world generation change. A `playerListVisible: true` result definitively means the account is known to Mineflayer; `entityVisible: false` means no matching observer entity was present in the sampled client entity table, not proof of complete invisibility. No zero-contamination claim should be made on this basis alone.

# Craftle native Minecraft recorder — isolation contract v1

## Non-negotiable architecture

- **Learner:** Mineflayer connects to the existing vanilla 1.21.1 Java server and is the only process authorized to issue Turesla's gameplay controls.
- **Native recorder:** a separate real Minecraft Java 1.21.1 client captures full native character animations, block particles, sound, skins and lighting. Never inject camera movements into the learner or act through the learner's session.
- **Evidence feed:** append-only learner telemetry plus optional server observer records. A synchronized event stream powers the browser/notebook annotations and postproduction subtitles.
- **Prismarine Viewer:** lightweight browser debugging with annotations. It is not the source of truth for animation or world physics.

## Why ordinary spectator mode is not yet safe

An ordinary Minecraft client connected in spectator mode still has a player identity, protocol packets, potential tab-list exposure, entity visibility, chunk-loading effects, login events and lifecycle effects. It also requires cheats/permission to switch gamemode on a vanilla server. Do **not** claim it is experimentally invisible merely because it has spectator gamemode, invisibility, or no collision.

### Preferred evidence-grade recording: offline replay

For controlled experiments, capture immutable server/learner event records and reconstruct native-client cinematic footage from a snapshot after the experiment. The recorder must not connect to the live learning world. This is the easiest guarantee that recording cannot alter learning, but reconstruction fidelity needs its own validation and deterministic replay data beyond ordinary vanilla logs.

### Optional live recorder: separate development branch

A live native recorder may be evaluated only after implementing server-side observer isolation (likely an audited Paper/Fabric server plugin/mod; that is **not vanilla anymore**). A vetted observer protocol proxy is another research option, but must reproduce chunks, entities and timing correctly without affecting the upstream world. Before shipping, prove all of these:
- Learner receives no observer entity, metadata, player-info/tab-list entry, chat/login text, or score/team changes.
- Observer never changes block, inventories, entities, weather, mob spawn/despawn, tick timing, chunk loading or pathfinding opportunities relative to a no-observer matched run.
- Observer has no server-side collision, AI targeting, loot collection, attack/damage, inventory interactions or chat rights.
- Server-side packet audit records all observer-induced packets and any gameplay mutations; fail closed if a forbidden one occurs.
- Position/movement of the observer does not influence spawning or simulation distance.
- Include deterministic matched-seed A/B tests with/without recorder, and compare packet transcripts, tick timings, entity spawn patterns and agent observations.

**Do not automatically start a native spectator against the persistent world.** Until these checks pass, only enable it on an expendable test world or render from offline snapshots.

## Event annotation schema

`GET http://127.0.0.1:3001/api/annotations` returns `craftle.spectator-annotations.v1` with timestamped, bounded entries containing event type, symbol, label, decision ID, target ID and available coordinates. Agent-reported intents/attempts are labeled accordingly. Missing target coordinates stay null; no spatial marker should be fabricated. The endpoint is a **read-only observation** from agent logs, not server-authoritative truth.

For a notebook:

```python
import requests, pandas as pd
result = requests.get("http://127.0.0.1:3001/api/annotations", timeout=5).json()
display(pd.DataFrame(result["events"]))
```

Future work: implement and validate a server-authoritative observer event collector with tick and dimension; add 3D positional markers to the browser only for correctly located events; export the exact same annotation stream as transparent overlays for native camera footage; add native-client capture after observer-isolation test passes.

## Acceptance gates

1. `/api/annotations` is accessible in a working stock viewer build with no new WebGL patches.
2. Each label states **intended**, **attempted**, **observed**, or **server confirmed**; never conflate them.
3. Event source has bounded memory, read-only HTTP, strict local port binding, and no agent control API.
4. A real native client screenshot/video is required before declaring native capture operational.
5. Zero confirmed observer-contamination differences in matched trials before enabling live capture on the continuous training server.
