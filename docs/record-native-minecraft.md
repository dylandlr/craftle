## Live in-game chat about Turesla (filming server only)

Craftle now includes an **opt-in spectator-only chat commentator**. This is a separate Docker service that tails the filming agent's JSONL log and sends short messages to **your Minecraft username only** using the filming server's RCON. It never broadcasts to Turesla, calls learner methods, or modifies checkpoints. Messages label chosen intentions and attempted attacks/harvests as such, rather than claiming success.

With your Minecraft recorder account already connected to the **isolated** filming server, use your actual username:

```powershell
git pull origin main
$env:CRAFTLE_CAMERA_USERNAME = "YOUR_MINECRAFT_USERNAME"
docker compose -f deploy/filming/compose.yml --profile commentary up -d commentary
docker compose -f deploy/filming/compose.yml --profile commentary logs -f commentary
```

When you see `filming_chat_sent`, watch the chat in your real Minecraft client. For example, it may show `[Craftle] Turesla: Exploring the world`, `[Craftle] Turesla: Punched / attacked entity:17 (attempt)`, or `[Craftle] Turesla: Ate apple (hunger 12 -> 16)`. The service rate-limits messages to one every 3.5 seconds by default. The client chat must be visible in Minecraft video settings if you want it to appear in Flashback footage; exact replay-chat capture behavior depends on Flashback's settings and recording coverage. Do not point this service at the production server.

To stop commentary without stopping either Minecraft or the learning process:

```powershell
docker compose -f deploy/filming/compose.yml --profile commentary stop commentary
```

The service starts reading at the current log end and reports **new events only**, so historic actions will not flood the chat. Requires `CRAFTLE_CAMERA_USERNAME` to be a valid Minecraft username different from Turesla. Do not use the username of Turesla. The new service is not a truly invisible Minecraft observer or a server-authoritative logger.

# Recommended path: Flashback (Minecraft Java 1.21.1, Fabric)

**Status:** Flashback client setup and recording finalization scripts are committed; **no native video has been captured or verified**. The real Minecraft Java client must still run on your Windows machine. The isolated filming server, not the live persistent learning server, is the target.

## A. Install Flashback in a separate Minecraft instance

Create a dedicated **Fabric 1.21.1** launcher profile/instance and note its game directory. Then preview compatible versions (no downloads):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-flashback-client.ps1 -GameDirectory "C:\Minecraft\CraftleFlashback"
```

To download the exact 1.21.1 Fabric builds of Flashback and Fabric API from Modrinth and verify the published SHA-512 checksums, add `-DownloadMods`. The script refuses conflicting jars and will not install or modify Minecraft itself, Fabric Loader or the launcher. Install Fabric Loader in the instance using your preferred launcher first. Flashback is **client-side only**.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-flashback-client.ps1 -GameDirectory "C:\Minecraft\CraftleFlashback" -DownloadMods
```

Official release list: https://modrinth.com/mod/flashback/versions — select versions filtered for **1.21.1**. The 1.21.1 branch is distinct from newer 26.x releases. Do not install Flashback on the vanilla server.

## B. Start the isolated filming server

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-native-filming.ps1 -Checkpoint accepted
docker compose -f deploy/filming/compose.yml --profile learning up -d --build
```

The checkpoint-copy script refuses to overwrite a previous filming checkpoint. Use a new clean filming state for an independent run; never erase the persistent learning server's state. Native client connects to `127.0.0.1:25575`. Set **only the filming account** to spectator mode with `rcon-cli`; this world is not used for uncontaminated scientific benchmarks.

## C. Capture an entire Flashback replay

Enable Flashback's **Automatically Start** and **Automatically Finish** recording options in the client, or use its in-game record controls. Connect to the isolated filming server, follow Turesla through the spectator selection screen, and leave Flashback recording until the intended end. Exit/disconnect cleanly so Flashback can finish writing its replay. Preserve the raw replay before editing.

Open Flashback's replay editor, track Turesla, export a full-duration native `.mp4` with game audio; preserve a separate untouched master and make shorter clips separately. For a long trial, ensure sufficient disk space and memory. Export without fullscreen if the encoder presents a black video.

## D. Finalize a verifiable evidence bundle

Determine the **UTC timestamp of the first frame in the exported replay segment**, not the MP4 file creation time or the time Flashback rendered the export. The exported replay timeline may be trimmed, retimed or shifted from the original recording. If the starting time cannot be established precisely, mark the annotation alignment as approximate; do not claim frame-level synchronization.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/finalize-flashback-recording.ps1 `
  -Video "recordings/native/turesla-full.mp4" `
  -ReplayStartUtc "2026-10-26T18:00:00Z" `
  -OutputDirectory "recordings/native/run-001"
```

The timestamp shown is **an example**. This copies the **filming** agent log, probes the actual MP4 using `ffprobe`, generates an SRT and JSON evidence manifest, and leaves the original MP4 unchanged. Use a unique output directory per run. Flashback and the Minecraft client are not launched by this script.

## E. Acceptance gate

The recording is complete only once a genuine MP4 has been exported from a Fabric Minecraft Java client, its frames are visibly inspected, Turesla is present, and the evidence bundle passes the checks. There is **no real MP4 yet** from this assistant's execution.

---

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

