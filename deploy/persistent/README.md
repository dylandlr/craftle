## Push-style Auto Director camera stream

`GET http://127.0.0.1:3001/api/director/stream` now delivers **Server-Sent Events** named `director` containing the read-only smoothed drone-camera pose. A new connection receives an initial state immediately, then updates when agent motion changes (checked every 200 ms; not a guaranteed 5 FPS render source). Missing or stale agent telemetry is explicitly `available:false`. The stream sends no gameplay packets and has no write endpoint; slow/disconnected viewers are discarded. The existing `GET /api/director` remains available.

This is a renderer integration primitive, **not rendered drone footage**. The present iframe on port 3001 still displays Prismarine Viewer's stock third-person camera. A custom/forked browser viewer that accesses `Viewer.camera` in its Three.js rendering loop is required to apply the new camera pose, render particles, animate the Minecraft avatar, and play position-aware sound. The complete cinematic recorder is not yet deployed. Do not confuse the observer stream with autonomous video recording.

## Live drone camera pose API (renderer integration)

The spectator monitor on `http://127.0.0.1:3001` now exposes **`GET /api/director`**. The JSON contains a smoothed chase camera pose, look-at target, action-derived zoom intention, agent identity and observation timestamp. The output is read-only and calculated exclusively from spectator telemetry; there are no control POST endpoints and it does not send movement commands to Minecraft. Stale or missing telemetry results in `available:false` with null pose fields, rather than presenting a stale camera as live. This is an integration contract for the next custom renderer, **not a claim that Prismarine Viewer's iframe camera is already driven by it** (`renderApplied:false`).

The standard high-level Prismarine Viewer `mineflayer` web API exposes first/third-person selection but not an external per-frame camera setter. Its lower-level Viewer does expose `setFirstPersonCamera` and camera controls; turning this endpoint into a real drone shot requires hosting a customized viewer page and explicit render-loop control rather than trying to control a different-origin iframe. We should validate the renderer camera matrix, terrain occlusion, and actual motion on local vanilla 1.21.1 before enabling it by default. Audio, particles and avatar skeletal animation remain separate rendering tasks.

## Spectator effects and cinematic-drone groundwork

When the agent is running, the observation-only event bridge (`CRAFTLE_SPECTATOR_EFFECTS=1` by default) records genuine Mineflayer movement, entity swings/hurts, received particles and sound-effect *metadata* to its regular session or continuous agent log. The inspector at `http://127.0.0.1:3001` displays the most recent particles/sounds, motion type and a calculated trailing-drone shot intention (behind heading, elevated, with tighter zoom for observed attack/harvest decisions). The shot planner `src/spectator-director.js` has deterministic unit tests.

**Do not mistake this for complete cinematic rendering.** The desired camera pose is **not applied** to Prismarine Viewer yet. Particle/sound metadata are not graphical particles or audible Minecraft sound. Similarly, derived walk/jump labels are not avatar skeletal animation. Proper avatar poses, rendered effects, asset-backed positional audio and continuous drone camera need renderer integration or a full Minecraft client capture; vanilla Minecraft resource packs and sound assets must be handled appropriately. The spectator remains invisible as no additional Minecraft protocol client is spawned by these new features. Existing first-person/third-person viewer, model checkpoints, server state and training loop are otherwise unchanged.

For film-grade results, a separate Minecraft client with authenticated spectator privileges plus explicit visibility/interaction isolation might be an alternative renderer, but it is **not** intrinsically invisible to agents and must be audited before being used in experiments. Our preferred path retains the virtual observer and develops a renderer with external camera transforms, correct model animations, particle playback and positional audio without registering an entity.

## Experimental continuous Mineflayer agent (opt-in)

The default runner still uses validated three-minute training sessions. To keep the **same Mineflayer connection** active across training checkpoints and retain a stable third-person viewer, enable experimental continuous mode:

```powershell
$env:CRAFTLE_CONTINUOUS_AGENT = "1"
$env:CRAFTLE_CAMERA_MODE = "third_person"
docker compose -f deploy/persistent/compose.yml --profile learning up -d --build --force-recreate agent
```

Browse the raw viewer at `http://127.0.0.1:3000` or the spectator/inspector at `http://127.0.0.1:3001`. Continuous mode connects one agent without the usual 180-second shutdown. It writes decision events and pose telemetry to `state/agent/continuous/agent.log`. The existing targeted controller periodically saves weights atomically to `state/agent/continuous-policy.json`, initially copied from `state/agent/accepted-policy.json`. **It never promotes or overwrites the accepted baseline.** Checkpoint cadence is based on policy updates; uninterrupted runtime does not yet mean full optimizer/replay/RNG state is durable across process failures.

**Tradeoff:** this first continuous implementation disables the three-minute reference-frame/video capture and per-session promotion. It is for stable long-lived viewing/training, not a validated equivalent replacement for the benchmark runner. Production-grade rolling 720p video segments, checkpoint transaction validation, exact resumed learner state, reconnect health checks, and isolated failure tests remain to be built. A genuine client crash exits and restarts the process (up to five consecutive exits); camera pauses then, unlike routine checkpoint saves. The normal restart policy still governs the Docker container.

To return to the validated session runner:

```powershell
$env:CRAFTLE_CONTINUOUS_AGENT = "0"
docker compose -f deploy/persistent/compose.yml --profile learning up -d --force-recreate agent
```

The world in `state/server`, accepted baseline and separate continuous checkpoint persist. To make consistent backups, stop both services and copy state and secrets before changing deployments.

## Watch-only browser spectator monitor (first implemented slice)

Pull the latest main branch and recreate the agent (your persistent state directory is untouched):

```powershell
$env:CRAFTLE_CAMERA_MODE = "third_person"
$env:CRAFTLE_REFERENCE_WIDTH = "1280"
$env:CRAFTLE_REFERENCE_HEIGHT = "720"
docker compose -f deploy/persistent/compose.yml --profile learning up -d --build --force-recreate agent
```

Open **http://127.0.0.1:3001/** for the new watch-only monitor. It embeds the working Prismarine Viewer from port 3000, shows a connection/reconnection indication, and offers **Take Camera** and **Return to Auto**. The camera starts in watch-only mode. Click **Take Camera**, then click the embedded viewer to focus it; Prismarine Viewer's built-in MapControls provide **WASD** movement, **Space** up, **Shift** down, and mouse orbit. Return to Auto restores watch-only and reloads the embedded viewer to its default follow perspective. The new monitor HTTP server runs in the long-lived persistent runner rather than in the three-minute session process. Port 3001 is exposed only on Windows loopback.

**Scope limitation:** This is an incremental browser monitor, *not yet* an independently rendered/captured third-person Auto Director. The actual Prismarine Viewer camera on port 3000 still belongs to each short-lived agent session; the monitor reconnects when a new one starts. The Return to Auto button resets the browser camera, not an authoritative shared camera lease. It does not send commands to the learning agent or affect its checkpoint. An in-browser read-only inspector is available from the persistent session logs. The current manual takeover is **local to one browser** (not an authoritative shared camera lease); independent 720p third-person recording and uninterrupted camera streams remain future implementation work. Port 3000 continues to serve the unmodified raw viewer.

# Craftle on your PC: persistent Minecraft Java world

Requires Docker Desktop using Linux containers, enough free disk for recordings, and an awake PC. This deployment is not active until started on that host. Starting it uses the Minecraft server under the [Minecraft EULA](https://aka.ms/MinecraftEULA).

From a checkout of this repository in PowerShell:

```powershell
.\deploy\persistent\start.ps1
```

The script creates a random local RCON password only when absent, preserves existing state, builds the agent, and starts the stack. If your PC's script policy blocks local scripts, the equivalent commands with Node.js installed are:

```powershell
node scripts/init-persistent.js
docker compose -f deploy/persistent/compose.yml --profile learning up -d --build
```

Connect Minecraft Java **1.21.1** to `localhost:25565`. This is the actual Mojang vanilla server; Prismarine Viewer recordings are separate from the official client view. The containerized bot connects as Turesla. The local server uses offline player authentication for that bot and publishes only on the PC's loopback interface; RCON is not published. Remote exposure and authenticated multiplayer require a separate configuration. Do not turn this into a public offline-authentication server by changing the bind address.

## HD recording without changing the Minecraft server

The persistent deployment already runs **Mojang vanilla 1.21.1** (TYPE=VANILLA). Paper is used only in separate experimental GitHub Actions benchmark jobs; it is not required to record in HD. Rendering resolution is a viewer/client setting, not a server implementation setting.

To opt into a **1280×720 capture** in Windows PowerShell, from the repository root:

```powershell
$env:CRAFTLE_REFERENCE_WIDTH = "1280"
$env:CRAFTLE_REFERENCE_HEIGHT = "720"
docker compose -f deploy/persistent/compose.yml --profile learning up -d --no-deps --force-recreate agent
```

For 1920×1080, use width 1920 and height 1080. This only affects subsequent recordings, not the accepted DQN checkpoint, survival policy observation space or existing server world. Raw POV JPEGs and `survival_reference.mp4` retain the selected dimensions; `annotated_demo.mp4` remains an intentionally downscaled 768×768 preview. High resolution can slow the CPU-based Prismarine Viewer and increase storage significantly, so benchmark capture FPS and session promotion before committing to extended runs. The rendered POV is not identical to the official Minecraft Java client with shaders or resource packs. For highest-fidelity cinematic footage, join the same local vanilla server from the official Minecraft Java client and record with OBS at 1080p or higher. Do not delete `state/server` or `state/agent` during this change.

## Optional third-person spectator camera

The default learning and recording setup remains first-person. For an optional **live third-person web spectator** at 720p recording settings, set:

```powershell
$env:CRAFTLE_REFERENCE_WIDTH = "1280"
$env:CRAFTLE_REFERENCE_HEIGHT = "720"
$env:CRAFTLE_CAMERA_MODE = "third_person"
docker compose -f deploy/persistent/compose.yml --profile learning up -d --build --no-deps agent
```

Open **http://localhost:3000** to view the spectator camera while the bot is connected. The web viewer is separate from the saved headless 720p first-person MP4, and it does **not** become the policy's visual input. Only port 3000 on the local Windows host is published, not the public network. The viewer will briefly disappear between learning sessions as the bot reconnects. Use `$env:CRAFTLE_CAMERA_MODE = "first_person"` (or remove that environment variable) and recreate the agent to disable it.

**Third-person 720p video** is not yet provided by this web-view option: Prismarine Viewer's headless API does not document a configurable third-person camera. For third-person footage now, join `localhost:25565` using the official Minecraft Java 1.21.1 client, press **F5** to cycle perspective, and capture with OBS. That footage is a camera on the player you control, not a follow-camera locked to the bot; filming the AI avatar requires positioning a separate camera/player near it. Do not mistake the spectator video for agent sensory input.

## What persists

| Location | Contents |
| --- | --- |
| `state/server` | World, player inventories/positions, advancements, server console logs and server settings |
| `state/agent/accepted-policy.json` | Latest validated targeted DQN weights |
| `state/agent/sessions/<id>` | Incoming manifest, candidate model, decision/consumption/provenance logs, raw POV frames, encoded video, and promotion/failure report |
| `secrets/rcon_password.txt` | Local generated credential; never commit or upload it |

Paths are relative to this deployment directory and ignored by git. Container replacement reuses them. Initial seed only generates a **new** world; changing the seed variable does not reset an existing world. The deployment does not give starter items, create an arena, induce hunger, or reset inventory between sessions.

The vanilla server stays running while the bot reconnects between three-minute recording/training sessions. Thus this is a persistent world with periodically reconnecting learning, not an uninterrupted client connection. The normal player name preserves the player data; death/respawn still follows Minecraft rules. A kernel file lock prevents concurrent writers to the accepted model and releases automatically on process exit/reboot.

Session candidates promote only after normal completion, valid event/update accounting, valid network weights and successful video encoding. Failures retain the old accepted checkpoint and all diagnostics. **World changes are not rolled back** when a model candidate is rejected. Replay memory/target-network/PRNG state still reset between sessions; weight continuity is not exact training-state resumption. A crash may lose updates since the last accepted session. No automatic LLM takeover is enabled.

Three consecutive invalid sessions pause the agent until it is explicitly restarted, while the Minecraft server stays available. Session watchdogs bound startup/encoding hangs. New sessions use the same exploration seed; replay history and random-generator continuity are future work.

## Inspect, stop and resume

```powershell
docker compose -f deploy/persistent/compose.yml logs --tail 100 agent minecraft
docker compose -f deploy/persistent/compose.yml exec minecraft rcon-cli list
docker compose -f deploy/persistent/compose.yml exec minecraft rcon-cli "data get entity Turesla foodLevel"
docker compose -f deploy/persistent/compose.yml --profile learning stop
docker compose -f deploy/persistent/compose.yml --profile learning up -d
```

Use normal Compose stop before a planned PC shutdown. Docker's restart policy can resume containers when Docker Desktop starts, but it cannot keep the PC awake or start Docker Desktop itself. Watch recording disk use: raw frames are retained and there is no automatic deletion policy. Retain enough room for the world and checkpoints. To make a consistent backup, stop agent and Minecraft, copy the entire `state` directory somewhere durable, then resume. Do not copy a live world and assume it is a consistent snapshot. Keep secrets separately; ordinary server.properties includes the RCON password and must not be publicly archived.

The Docker wrapper and dependency tags are not immutable digests yet. `persistent-server.yml` records image IDs and independently tests a scoreboard marker surviving full server-container replacement. The agent image build/renderer smoke test and unit tests are separate checks. These CI checks are evidence of the deployment mechanism, not proof the server is already running on your PC.

## Grounded Voyager baseline

`src/voyager-grounding.js` is a tested proposal gate for a future **adapted** Voyager/LLM baseline. It accepts only the same 44 encoded sensory features and available 15 actions as targeted RL. Model output must name the current observation and one available action index. It cannot execute generated JavaScript, issue admin commands, import a skill library, retrieve recipes through tools, fabricate a success flag, or reuse a response from an ended life. Async execution rechecks target availability before acting.

This gate does **not** remove pretrained knowledge or prove a model ignored remembered recipes. Label this treatment `pretrained_language_prior`. The caller-supplied inference provider is not connected to a paid model or native Voyager here; tests use a mock provider. Native Voyager is a separate replication with its documented compatible environment; connecting it directly to this vanilla 1.21.1 server is not validated. See [comparison protocol](../../experiments/VOYAGER_COMPARISON_PROTOCOL.md).

For a comparison or backup treatment, stop RL, create a separate world copy while the server is stopped, and use separate model memories/logs. Record the treatment boundary. Do not silently substitute an LLM into the RL run, share its skills with the RL agent, or count its accomplishments as non-LLM discovery. A native-versus-grounded LLM ablation can measure the effect of interface restrictions, not removal of pretraining.
