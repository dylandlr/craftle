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
