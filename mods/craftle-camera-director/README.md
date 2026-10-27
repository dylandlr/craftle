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

**Important implementation boundary:** Generated skins exist as PNG assets and are served as read-only previews; they are **not yet applied to offline-mode Mineflayer players in native Minecraft**. This requires an explicit client-side skin renderer or an appropriate server-side skin distribution strategy. The camera-director mod currently only changes POV. Do not describe generated identities as visible on the real agent until a native-client/Flashback integration test verifies it.

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
