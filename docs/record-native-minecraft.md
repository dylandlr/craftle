# Native Minecraft full-session recording — first safe filming run

This produces footage in a **real Minecraft Java 1.21.1 client**, not Prismarine. It runs a cloned Turesla checkpoint on a completely separate vanilla world and separate Docker Compose project.

**Not yet executed or recorded by ChatGPT.** The actual MP4/replay must be captured from a real client on your Windows PC. Recording the separate filming world demonstrates bot behavior but is **not** an uncontaminated evaluation of learning. Do not join the production server on port 25565 with your filming client.

## Why an isolated filming server?

A normal native Minecraft observer, even in spectator mode, may affect simulation/player state and cannot be declared invisible to the learner. This filming setup uses a *different server and another copy of Turesla*, so nothing in the original continuous learner on 25565 is affected. Inside the filming world itself, the camera is still an ordinary connected player; do not use these runs as scientifically controlled benchmarks.

## Windows walkthrough

1. In the Craftle repository, run:
   ```powershell
   git pull origin main
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-native-filming.ps1 -Checkpoint accepted
   docker compose -f deploy/filming/compose.yml --profile learning up -d --build
   docker compose -f deploy/filming/compose.yml --profile learning ps
   ```
   The helper refuses to overwrite an existing filming checkpoint. You can opt for `continuous-v1` or `continuous-v2` instead, before the first filming start.
2. Install Minecraft Java Edition **1.21.1** client with Fabric and a compatible client-side video/replay mod. [ReplayMod Minecraft 1.21.1](https://www.replaymod.com/download/) and [Flashback](https://flashback-mod.com/) support 1.21.1. Use a separate Minecraft launcher installation/profile, not your normal modded gameplay world. Replay mod captures gameplay packets while connected and lets you render a camera path from its replay afterward; OBS screen capture is another option.
3. Join `127.0.0.1:25575` from the **real Minecraft client** with a distinct name, e.g. `CraftleCamera`. If your online launcher identity differs, use that username in the next step. The filming server uses offline authentication only on `127.0.0.1`, not exposed to your LAN.
4. From PowerShell, set the camera account to spectator on the **filming** server:
   ```powershell
   docker compose -f deploy/filming/compose.yml exec minecraft rcon-cli "gamemode spectator CraftleCamera"
   ```
   You can then spectate Turesla with the vanilla spectator GUI (number keys when selecting player). Do not send `/gamemode`, `/tp`, or observer commands to the production server.
5. Start a replay recording using your installed mod, then record the desired period. Make an orbit/third-person camera path during replay editing, or film live with OBS. Both produce **native Minecraft animations, particle effects and sound**, unlike Prismarine.
6. To inspect the separate agent:
   ```powershell
   docker compose -f deploy/filming/compose.yml --profile learning logs --tail 80 agent
   docker compose -f deploy/filming/compose.yml --profile learning exec agent node scripts/report-agent-learning.js /state/agent/continuous/agent.log
   ```
7. End the filming run without touching production:
   ```powershell
   docker compose -f deploy/filming/compose.yml --profile learning down
   ```
   This preserves `deploy/filming/state/` for later review.

## Recording acceptance checks

- Video depicts a Minecraft Java 1.21.1 client with **native** movement and block/attack effects.
- Turesla is moving on the **filming** server, not a manually scripted placeholder.
- Replay timeline covers start to finish, with real client capture date and a generated MP4 export.
- Filming world's mobs, inventory and player count are **not** used to evaluate the scientific no-observer baseline; the actual experiment requires observer isolation or offline deterministic replay.
- The persistent Minecraft server on 25565, accepted baseline and continuous checkpoints are unchanged.
- If the video is black or the character seems frozen, inspect the native client/replay recording first rather than rebuilding the agent renderer.

## Limitations and next engineering phase

This is a reproducible **manual native-client recording pipeline**, not autonomous headless rendering. End-to-end unattended capture requires real-client automation or a deterministic server replay with full authoritative state, and is not implemented. Server observer isolation remains to be proved; see `docs/native-spectator-isolation.md`. Prismarine's annotations remain available as a debug view at `http://127.0.0.1:3011/api/annotations` for the separate filming agent, subject to agent logging.
