## Fixing delayed deaths/chat and unavailable density telemetry (October 27, 2026)

A long-standing commentary queue used a 3.5-second message throttle but could accumulate 40 queued actions, making deaths appear well after the actual game event. The updated filming commentator:

- Discards chat items older than 6.5 seconds.
- Clears obsolete queued death/recovery messages and prioritizes fresh death, food consumption and verified recovery messages.
- Sends critical events immediately instead of waiting for routine chat throttle.
- Records `ageMs` on every delivered message for latency debugging.
- Uses `target_action` events to update HUD vitals (the previous reader watched an unrelated `health` type).
- Updates HUD state on death/respawn and visibly marks stale telemetry.

The `/api/density` response now includes `reason`, `ageMs` and the latest density event even if its `occupancyRatio` is null. `available:true` requires a finite, fresh ratio. `available:false` is possible when there are no density events in recent logs, the filming agent wasn't restarted with `CRAFTLE_FILMING_DENSITY_AUDIT=1`, nearby block cache has no valid blocks, or a source is stale. Do **not** assume that `pose_sample` implies the separate density audit is enabled.

Update the *filming copy only*:

```powershell
git pull origin main
$env:CRAFTLE_CAMERA_USERNAME = 'dyl_is_here'
docker compose -f deploy/filming/compose.yml --profile learning up -d --build --force-recreate agent
docker compose -f deploy/filming/compose.yml --profile commentary --profile hud up -d --force-recreate commentary hud
Invoke-RestMethod 'http://127.0.0.1:3011/api/density' | Format-List *
docker compose -f deploy/filming/compose.yml --profile learning exec agent sh -lc "grep 'spectator_density_audit' /state/agent/continuous/agent.log | tail -3"
docker compose -f deploy/filming/compose.yml --profile commentary logs --tail 30 commentary
```

This requires a real restart of the **filming agent container** for the environment-variable change and new code to reach the running agent; recreating the HUD/chat services alone will not enable block-density instrumentation. Captured source timestamps are UTC and may not match local clocks or Flashback's replay-relative time. Actual frame-accurate sync still requires a Flashback recording start anchor; this fix addresses stale/delayed overlays, **not** frame-exact replay synchronization.

## Built-in 18-panel observatory and optional automatic native POV (main branch)

The filming spectator monitor now includes **all 18 diagnostic views**, visible by default. Each panel has an independent **×** (minimize) and **✓** (expand) button. The same views remain accessible individually from its tabs. The default layout initially displays recent live telemetry (bounded log tail, up to 1,200 diagnostic events, refreshing every five seconds). Load a complete `agent.log` with the observatory file picker to inspect historical runs; this switches the browser session to the selected local file.

The main browser monitor is at `http://127.0.0.1:3011/` on the isolated filming server; direct all-views route: `http://127.0.0.1:3011/observatory`. These are **browser research panels**, not 18 native Minecraft on-screen widgets. The existing game actionbar/chat remain separate and private to `dyl_is_here`.

New diagnostic events written to the filming agent JSONL: navigation goal with decision/skill/position, navigation no-path failures and stalls, 4 Hz pose samples, and 2-second block-density reports including leaves, block beneath Turesla, position, a world-age anchor and recommended POV mode. Rewards, chosen actions, transitions, death and verified eating continue logging through existing event contracts. The data are collected observer-side; do not confuse logged observations with a server-authoritative record.

To run the updated system, from the repository:

```powershell
git pull origin main
$env:CRAFTLE_CAMERA_USERNAME = 'dyl_is_here'
docker compose -f deploy/filming/compose.yml --profile learning up -d --build agent
docker compose -f deploy/filming/compose.yml --profile follow --profile commentary --profile hud up -d follow commentary hud
Start-Process 'http://127.0.0.1:3011/'
```

### Native camera switcher (separately installed client mod)

The optional **Craftle Camera Director** Fabric 1.21.1 client-only mod is maintained under `mods/craftle-camera-director`. It polls `http://127.0.0.1:3011/api/density` and switches the *native* spectator POV: **third-person rear** at ≥52% nearby occupied blocks, **first-person** again at ≤32%. Hysteresis avoids rapid toggling. **F8** disables or enables automatic mode. It only operates on the filming server `127.0.0.1:25575`, ignores stale data, and never controls Turesla.

The mod's Java source and CI build workflow were committed, but the JAR still needs to be built and installed on your actual Minecraft Fabric client. See [the Camera Director readme](../mods/craftle-camera-director/README.md) for build/installation details and GitHub Actions artifact instructions. **No client-side switching has been observed or verified yet.** Flashback may override or omit live perspective changes during replay export; test a short recording to confirm.

### Verification checks

```powershell
# Native filming server and agent running?
docker compose -f deploy/filming/compose.yml --profile learning ps
# Density endpoint should become available after a few seconds.
Invoke-RestMethod 'http://127.0.0.1:3011/api/density'
# Recent event readout should contain diagnostic events.
(Invoke-RestMethod 'http://127.0.0.1:3011/api/observatory/events').events | Select-Object -Last 5
# Agent log should show navigation and density diagnostics:
docker compose -f deploy/filming/compose.yml --profile learning exec agent sh -lc "grep -E 'target_navigation_|spectator_density_audit' /state/agent/continuous/agent.log | tail -15"
```

Note: Docker image rebuild/recreation resets the **filming agent process** and its in-memory state. It does not overwrite the saved filmed-world files or production world. Use the isolated filming server for the first test.

## Return to spectator follow after reconnecting

The optional `follow` watchdog now checks whether `dyl_is_here` is connected. On a new connection, it issues `gamemode spectator dyl_is_here`, then `spectate Turesla dyl_is_here`. It also recovers after Turesla death/respawn. It does not control the learning agent and only operates on the separate filming server. There can be a delay of one polling interval (6 seconds by default) and the camera may briefly detach while the target respawns.

```powershell
git pull origin main
$env:CRAFTLE_CAMERA_USERNAME = "dyl_is_here"
docker compose -f deploy/filming/compose.yml --profile follow up -d --force-recreate follow
docker compose -f deploy/filming/compose.yml --profile follow logs -f follow
```

Look for `filming_camera_reconnected`, `filming_camera_spectator_mode` and `filming_follow_attempt`. Stop the optional follow service when you want manual spectator freecam without automatic reattachment.

## Fourteen-view research dashboard

The local `tools/craftle-observatory.html` now has 14 views (six original + Charts, Heatmap, Decision Analysis + Movement Efficiency, Opportunities, Death Analysis, Reward Diagnostics, Session Overview). The five newest panels report:

- **Movement efficiency:** logged path length versus net displacement, vertical climbing and descent, sampled velocity.
- **Opportunities:** number of decision instants with food/animal/plant targets, target-category exposures, explore/retreat choices despite candidates.
- **Death analysis:** death timestamps, previous observed health/hunger and last action; temporal adjacency is **not** causal attribution.
- **Reward diagnostics:** logged reward range, sums of available v2 component events, observed survival outcomes.
- **Session overview:** observed event count, duration, top actions, source/provenance limitations.

The views read only a user-selected local JSONL log; they do not have network access, send Minecraft commands or change learner behavior. Missing observations are shown as absent, not generated. Significant future work remains: truly synchronized video playback, camera HUD integration, Q-value capture and block-underfoot instrumentation to verify treetop movement.

## Nine-view offline observatory

`tools/craftle-observatory.html` now offers nine tabs: Spatial Grid, Actual Inputs, Navigation, Learning, Survival, Timeline, Charts, Heatmap and Decision Analysis. New plots show logged transition rewards, health/hunger series, vertical elevation, 8-block spatial visit frequency and policy action distribution. All charts are computed locally in the browser from an explicitly loaded `agent.log`, without contacting the Minecraft server.

```powershell
git pull origin main
start .\tools\craftle-observatory.html
```

Load `recordings/native/filming-agent.log` (or a raw copied continuous agent log). Missing telemetry is not silently fabricated. The heatmap represents positions Turesla visited, **not visible terrain or a learned mental map**. Elevation alone cannot prove that it is standing on leaves. The decision comparison shows how often food/animal/plant targets were available when the DQN selected actions. A live data source and video frame alignment are planned separately; this is not yet a Fabric overlay in Flashback.

## Native in-game spectator HUD (filming only)

The optional `hud` service renders a **private actionbar** in the real Java client's HUD, sourced exclusively from the filming agent's JSONL log. It shows the latest action/decision ID, health, hunger, XYZ, last observed reward and learner update count. The service uses only `title dyl_is_here actionbar <json>` over filming-server RCON: it does **not** create a scoreboard, mutate the learner, broadcast chat, or send telemetry to Turesla. Values may show `?` until a fresh event arrives, and stale action telemetry is labeled.

```powershell
git pull origin main
$env:CRAFTLE_CAMERA_USERNAME="dyl_is_here"
docker compose -f deploy/filming/compose.yml --profile hud up -d hud
docker compose -f deploy/filming/compose.yml --profile hud logs --tail 30 hud
```

Run with follow and commentary services using `--profile hud --profile follow --profile commentary up -d hud follow commentary`. This service is **optional** and runs only on the copy of the world on port 25575. Stop it with `docker compose -f deploy/filming/compose.yml --profile hud stop hud`. The actionbar appears above the hotbar and is intentionally compact; it is **not** a fully customizable client-side graphical overlay. Its visibility in exported Flashback replay video depends on Flashback's HUD/render settings; record a short test export to validate before a multi-hour filming session.

## Verbose commentary and diagnosing treetop wandering

The filming-only commentator now sends more informative messages to the configured camera player `dyl_is_here`: DQN decision ID, choice, available action mask count, detected target count, skill failures, pathfinding failures, substantial rewards, and a periodic position/vitals/reward summary. This uses a targeted `tellraw dyl_is_here` command (no global broadcast) from a separate observer tool. Turesla's current targeted DQN cannot press Tab or issue chat commands, and the commentary service does not inject messages into its policy. Keep this service restricted to the filming world because vanilla chat events and RCON still add some server workload.

```powershell
git pull origin main
$env:CRAFTLE_CAMERA_USERNAME="dyl_is_here"
docker compose -f deploy/filming/compose.yml --profile commentary up -d commentary
docker compose -f deploy/filming/compose.yml --profile commentary logs --tail 40 commentary
```

The filming footage needs independent review. Export the complete Flashback video as `recordings/native/turesla-full.mp4` and copy the filming log (don't copy the production-world log):

```powershell
New-Item -ItemType Directory -Force recordings/native | Out-Null
docker compose -f deploy/filming/compose.yml --profile learning cp agent:/state/agent/continuous/agent.log recordings/native/filming-agent.log
python scripts/review-filming.py --log recordings/native/filming-agent.log --video recordings/native/turesla-full.mp4 --out recordings/native/filming-review.json
```

The reviewer produces a JSON behavioral report plus 12 actual timestamped video frames under `recordings/native/review-frames/`. It reports action frequencies, navigation failures, explored 8-block cells and Y-coordinate range. **This does not automatically recognize tree blocks, interpret avatar actions from images, or prove why the agent climbs trees**. Inspect the extracted frames alongside the JSON. A ground-truth terrain diagnosis requires block-underfoot samples and matched replay/event timestamps. You may upload the MP4 plus log to ChatGPT for an actual visual diagnosis.

## Keep native spectator attached after Turesla dies

Vanilla /spectate can detach when its target player dies. On the isolated filming server there is now an opt-in **follow watchdog** that reissues `spectate Turesla <your camera player>` after spawn/death/respawn events and on a 30-second safety heartbeat. It **does not move, attack or change the learner**. The camera may briefly become free-flying between Turesla's death and respawn; automatic reattachment resumes after the new player entity exists. This is not a seamless replay camera cut, and Flashback should keep recording during the gap.

With your real Minecraft filming account already connected and in spectator gamemode, from PowerShell:

```powershell
git pull origin main
$env:CRAFTLE_CAMERA_USERNAME = "YOUR_MINECRAFT_USERNAME"
docker compose -f deploy/filming/compose.yml --profile follow up -d follow
docker compose -f deploy/filming/compose.yml --profile follow logs -f follow
```

Ensure the camera account is in spectator mode, using the filming server only:

```powershell
docker compose -f deploy/filming/compose.yml exec minecraft rcon-cli "gamemode spectator YOUR_MINECRAFT_USERNAME"
```

To run both optional services, use `--profile follow --profile commentary up -d follow commentary`. The camera follow service can reattach even after you manually leave Turesla's viewpoint (by design); stop it with `docker compose -f deploy/filming/compose.yml --profile follow stop follow` when you want manual freecam.

**Verify empirically:** watch Turesla die and respawn, confirm the follow service logs `filming_follow_lifecycle` and `filming_follow_attempt`, then confirm your native client reattaches. It has not been validated in the user's live session yet. The watchdog only affects the separate filming server; it must not be enabled against the continuous learning world.

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

