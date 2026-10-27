## F10 policy-view diagnostics (experimental)

**F9:** toggle basic Minecraft research HUD. **F10:** toggle explicit *DQN-visible target count* and a warning that displayed terrain diagnostics are *observer-only*, not part of current DQN inputs. **F8:** automatic filming camera. F10 is an early perception inspector, not yet a raycast-aligned 3D or first-person sensory overlay. It consumes `/api/hud/state` and cannot change policy actions.

## Tree-navigation ablation

The filming Compose now exposes `CRAFTLE_TREE_NAVIGATION=1` as a **separate, opt-in scripted execution baseline**. With the flag enabled, `src/connected-exploration.js` searches a bounded neighborhood of Mineflayer's locally loaded blocks for connected nonhazardous footing and picks a conservative goal. Unknown terrain remains unknown; it does not mine, build, jump through barriers, teleport or provide map data to the 44-feature DQN. This is not proof of learned navigation or guaranteed route success: Minecraft Pathfinder validates actual routes and will still emit `noPath` when appropriate.

To test against the unchanged baseline in the isolated filming world:

```powershell
git pull origin main
node --check src/spectator-monitor.js
node --test test/connected-exploration.test.js
$env:CRAFTLE_TREE_NAVIGATION = "1"
docker compose -f deploy/filming/compose.yml --profile learning up -d --build --force-recreate agent
```

Set `CRAFTLE_TREE_NAVIGATION=0` and recreate the agent to return to the original behavior. Do not wipe the persistent state. Preserve action/reward logging and compare matched world seeds and frozen-policy trials, not one anecdotal run.

## Footage sync workflow

For automatic upload from the Windows filming machine, configure **Google Drive for desktop** to sync the local recording folder into a dedicated private Google Drive folder such as `Craftle/filming-footage`. Configure Flashback exports to write there (or copy finished MP4s into the synced folder). Wait for the desktop application's sync-complete indicator before requesting a review; partial files can otherwise be unreadable. In ChatGPT, say **"Review the newest video in my Craftle filming-footage folder on Google Drive"**. The connected Drive connector can find accessible uploaded files when asked, but it does *not* monitor uploads automatically, and no unattended Windows-side sync was provisioned by these repository changes. Never store API credentials in the repository or make footage publicly shared merely for review.

## Multi-citizen client skins (experimental)

The client now requests `GET http://127.0.0.1:3011/api/citizens` and associates registered player usernames with their persistent citizen IDs. Each skin is loaded separately from `/api/citizens/<id>/skin.png`. Other Minecraft players retain vanilla skins; the override is filming-server only, client-side and read-only.

By default the continuous filming agent is still Turesla alone. The `CRAFTLE_CITIZEN_ROSTER_JSON` environment variable may provision **additional cosmetic registry entries** (example: `[{"id":"agent_001","name":"Turesla"},{"id":"agent_002","name":"Citizen2"}]`), but DOES NOT spawn additional agents into Minecraft. Treat roster size and Minecraft agent count separately until population spawning and autonomous controls are implemented.

From the Craftle repository root, after a successful Fabric CI build:

```powershell
git pull origin main
$env:CRAFTLE_CAMERA_USERNAME = "dyl_is_here"
docker compose -f deploy/filming/compose.yml --profile learning up -d --build --force-recreate agent
Invoke-RestMethod "http://127.0.0.1:3011/api/citizens"
```

Download the rebuilt client JAR from the workflow, replace the existing JAR in the CraftleFlashback `mods` folder, restart Fabric 1.21.1, and observe Turesla on `127.0.0.1:25575`. Skin overrides and F9 HUD still require compile and live gameplay verification. Flashback replay rendering must also be tested separately.

## Native in-game research HUD (experimental)

After installing the rebuilt Fabric mod, **F9** toggles a compact six-line native HUD overlay. It displays health/hunger, active DQN decision, reward and training updates, block beneath the agent, navigation result and visible target count. The UI polls the local filming monitor's `/api/hud/state` once per second and indicates stale data. It is available only when connected to the isolated `127.0.0.1:25575` server and cannot issue commands to Turesla. **F8** independently controls the POV switch. This is a first compact native overlay, not the previously envisioned fully collapsible six-panel HUD.

**Build/validation status:** the Java source has been committed, but no successful local Fabric compilation or Windows gameplay test has been observed in this conversation. A successful GitHub Actions artifact build and a live filming-client test are needed before asserting full compatibility.

## Procedural citizen appearances (identity layer v1)

Every Craftle citizen uses `mode: random` by default. The appearance is generated deterministically from world seed + citizen ID + generation and persisted; reconnecting or restarting does **not** reroll the citizen's face, clothing or model. Cosmetic attributes are independent of personality, genes, learned policy and survival reward. For multi-agent populations, allocate a unique citizen ID per individual and generate each identity once.

The persistent runner currently provisions `agent_001` (Turesla) on startup under `/state/agent/citizens/`:
- `agent_001.json` — identity seed, clothing, colors and appearance metadata.
- `agent_001.png` — 64×64 Minecraft skin PNG.

For more citizens or preview assets:

```powershell
node scripts/generate-citizen-skins.js --ids Turesla,Citizen2,Citizen3 --world-seed craftle --output recordings/citizens
```

After updating and rebuilding the filming agent, the preview skin can be downloaded from `http://127.0.0.1:3011/api/citizens/agent_001/skin.png` and metadata from `/api/citizens/agent_001`.

**Native skin integration (experimental):** The Fabric client includes a read-only `AbstractClientPlayerEntity#getSkinTextures` mixin for player name `Turesla`, restricted to the isolated filming server. It fetches the local generated PNG and model metadata and installs a Minecraft texture on the render thread. This is client-only: no server skin profile changes and no modification to the policy. This integration has **not yet passed a reported Fabric build or live-client/Flashback test**. Other citizen names still need a dynamic identity registry and matching URL routes. If the local endpoint is unavailable, the vanilla skin should remain visible.

# Craftle Native Camera Director (Minecraft Fabric 1.21.1)

Optional **client-only** filming mod. It changes the native camera perspective and draws a read-only research HUD while the camera player is connected to the dedicated Craftle filming server `127.0.0.1:25575`. It never connects to the Minecraft game protocol or commands the learning agent. The production `25565` server, all other servers and Flashback replays are excluded.

## Behavior

- Automatically enabled on the **filming server only** when valid fresh telemetry is available.
- At surrounding solid/leaf block occupancy **≥ 52%**: use third-person rear view.
- Once occupancy **≤ 32%**: return to first-person, using hysteresis to avoid rapid flicker.
- Sample source: read-only `http://127.0.0.1:3011/api/density` from filming spectator monitor.
- Ignores data older than 8 seconds. Network outage means no additional perspective changes.
- Press **F8** to toggle this option off/on. Manual F5 remains available when auto mode is off.
- The camera may briefly show a transition during entity death/respawn. The existing `follow` watchdog performs player spectating; the mod only sets camera perspective.

## Build and install

Requires Java 21 and Gradle 8.10.2, or download the successful build artifact from the repository's **Build Fabric camera director** GitHub Actions workflow.

```powershell
cd mods/craftle-camera-director
gradle --no-daemon build
```

Copy the non-`-sources` jar from `build/libs` to `C:\Users\delar\Games\CraftleFlashback\mods`, alongside Fabric API and Flashback. Restart Minecraft with the Fabric 1.21.1 profile. Do not install this in the server mods directory or in the production world.

In another terminal:

```powershell
git pull origin main
$env:CRAFTLE_CAMERA_USERNAME="dyl_is_here"
docker compose -f deploy/filming/compose.yml --profile learning up -d --build agent
docker compose -f deploy/filming/compose.yml --profile follow up -d follow
```

Open the filming spectator monitor at `http://127.0.0.1:3011/observatory` and check that `http://127.0.0.1:3011/api/density` reports `available:true` after the bot connects. It may initially report `false` while the log is warming up.

## Validation and caveats

This implementation has been committed as source, **not yet verified running in the user's Minecraft client**. The CI workflow is intended to catch compile regressions; a successful build would not replace an actual native recording test.

Block density is calculated from Turesla's Mineflayer-loaded block cache in a 5×3×5 neighborhood around head height; unknown/unloaded blocks do not count. It is **not a rendered camera raycast**, so obstruction behind the camera can differ from this proxy. Default thresholds are provisional and can be tuned after footage review. The monitor also exposes diagnostics and all 18 observatory views but these **are browser views**, not in-game HUD panels.

For Flashback: test an export to verify any camera-mode changes are preserved. Flashback's replay camera can override perspectives, so a client-side filming camera toggle is not guaranteed to survive replay editing. Use the original recording as evidence.
