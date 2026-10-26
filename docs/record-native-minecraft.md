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

## Versioned native recording + synchronized annotation workflow

Flashback is a good fit for the initial real-client demonstration. Its official [1.21.1-compatible builds](https://flashback-mod.com/) provide recording, replay editing, **Track Entity** camera tracking and MP4 export. In a replay, track **Turesla** rather than manually approximating its movements. Native recording must begin *while* connected to the separate filming server on port `25575`. A later MP4 export may start at a different replay timestamp: use the actual beginning of the exported segment, **not** the moment you pressed Save or Export.

For a full recording, start Flashback capture before the behavior you wish to film, save at the end, and open the replay after disconnecting. In the editor select Turesla with Track Entity (body/root), set start/end boundaries, configure camera offset and export 1080p MP4. Avoid shorts-only trimming: retain a complete master export and make a shorter edit separately. If the replay contains multiple deaths/respawns, verify that the entity tracking reattaches correctly after each; a UUID change can require separate camera segments.

To align annotations to a real native MP4, first copy the filming log out of Docker:

```powershell
New-Item -ItemType Directory -Force -Path recordings/native | Out-Null
docker compose -f deploy/filming/compose.yml --profile learning cp agent:/state/agent/continuous/agent.log recordings/native/filming-agent.log
```

Then export the real Minecraft client footage, e.g. `recordings/native/turesla-full.mp4`. Record the precise **first exported video-frame UTC timestamp** in an experiment manifest. Only after you know that actual time, run:

```powershell
python scripts/align-native-filming.py `
  --video recordings/native/turesla-full.mp4 `
  --log recordings/native/filming-agent.log `
  --video-start-utc 2026-10-26T18:00:00Z `
  --output-prefix recordings/native/turesla-evidence
```

**The timestamp shown above is an example; replace it with the actual frame-aligned UTC timestamp.** If you only know the approximate clock time or edited the replay's time mapping, the subtitle timing cannot be claimed exact. Adjust with a measured `--offset-seconds` for constant offsets; nonlinear cuts/time warps need a future segment-based alignment format.

The script verifies the MP4 using ffprobe and emits an `.srt` file and an audit `.json` with evidence classifications; it **does not** fabricate an MP4, install Minecraft, drive Flashback or perform exports. You may import the SRT into your editor or separately burn it into a derivative video with ffmpeg; preserve the original unannotated recording. Run the unit check with `python -m unittest discover -s test -p 'test_native_filming_alignment.py'`.

**Native footage status:** No exported Minecraft video is attached to this repository or conversation yet. The recording requires the real client and actual gameplay run; do not claim completed footage until the MP4 is verified.

