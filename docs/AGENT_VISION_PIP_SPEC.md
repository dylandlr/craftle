# Craftle Agent Vision — spectator-only picture in picture (proposed)

## Required outcome
While a human spectator flies a free camera in the filming Minecraft client, a live inset displays a second render of the vanilla world from Turesla's eye position and head orientation. It is a *camera perspective* of the agent, not necessarily the inputs consumed by its DQN. It must never alter bot.lookAt(), bot.entity, agent decisions, server commands, world state, reward, or checkpoint.

## Architecture
1. Server-side agent publishes timestamped pose (position, yaw/pitch, eye height, dimension, identity, life/session ID). Existing pose_sample can serve as baseline; validate freshness and coordinate conventions.
2. **Fabric client performs a second world render offscreen** into a dedicated framebuffer using a virtual camera at the agent pose, while maintaining the spectator's normal view and controls. No modification of the actual camera entity during the primary frame, no render-recursion, no input forwarding.
3. Composite the framebuffer as a draggable/resizable picture-in-picture using DrawContext/Fabric render hooks appropriate to Minecraft 1.21.1, restoring GL render state and main camera every frame.
4. When target pose is stale, in another dimension, outside loaded chunks, or agent disconnected/dead, show an explicit unavailable/last-frame marker rather than pretending the view is live. Frame source and latency must be visible.
5. Show raw view separately from optional perception overlays: (a) 3D ray hit from head direction, (b) instrumented Mineflayer observations, (c) actual 44-feature DQN policy input. These must not be conflated.
6. Use a bounded render rate (10-15 FPS initially) and cap inset size/resolution; measure overhead with client FPS and profiling.
7. No network requests from the agent to the spectator client; the video render and overlay are local to the spectator. Do not alter agent/world state or training.

## Acceptance criteria
- Observer can move/rotate freely while inset stays locked to the moving agent's head and eye position.
- Inset responds to agent yaw/pitch and block occlusion, at an explicitly measured refresh rate.
- F1/F7/F9 visibility semantics are documented; toggle PIP independently of numeric HUD.
- Disconnection, death, unloaded target, camera not available and stale pose produce distinct states.
- A synchronized screen recording proves simultaneous observer movement and agent view updates.
- Fabric 1.21.1 CI builds, and a real client smoke test confirms no GL state corruption or FPS collapse.
- No new agent vision features are claimed as learned until proven by observation contract and training.

## Status
Specification only. Existing F7 yaw/pitch reticle is **not** this visual feature. Existing Prismarine Viewer camera is **not** a verified second render in the native Fabric HUD. Do not describe either as a functioning Agent Vision PIP.

## Approved visual reference and implementation plan (2026-10-28)
The user approved the high-density cyan-on-dark research dashboard concept: dominant live spectator canvas, large yellow-accented first-person POV upper right, 3D voxel grids, FOV cone, object detection rectangles with spatial connectors, top and side projections, depth and segmentation views, bottom controls and agent status. Match the visual hierarchy and panel proportions, not just the feature names.

### Implemented UI shell
`/vision` serves `tools/craftle-vision-dashboard.html`, which can show the existing Prismarine Viewer spectator iframe and read-only `/api/hud/state` values including head yaw/pitch. The frustum is an illustrative heading projection, not a calibrated 3D renderer. No second agent camera, real bounding boxes, semantic masks or depth textures exist yet. All missing feeds are explicitly labeled unavailable.

### Remaining blockers, in dependency order
1. **Real second render**: implement an isolated Fabric 1.21.1 camera framebuffer with correct eye pose, FOV, world dimension and lifetime handling. Do not change the spectator's main camera or agent controls. Add a low-FPS frame bridge ONLY if the web dashboard needs it; leave streaming disabled until resource budgets, encoding, auth, and format are verified.
2. **2D/3D projection matrices**: unify actual render camera transforms so frustum and labels align in both spectator and agent views; add projection tests and tests for occlusion, off-screen targets, and changing aspect ratios.
3. **Geometry source provenance**: name observer-cache geometry, agent-sensed targets, and policy-input fields distinctly. Visual highlights must not suggest DQN sees rendered pixels.
4. **Depth, segmentation, boxes**: render scene depth and segmentation safely or show explicit no-data states; don't construct colored masks from arbitrary guessing.
5. **Verification**: Fabric Gradle 1.21.1 compile, native Minecraft screenshot comparisons at multiple angles, JavaScript smoke tests, instrumented lag, frozen-agent and spectator motion tests, and stale/death/reconnect behavior.

### Local preview
```powershell
git pull origin main
docker compose -f deploy/filming/compose.yml --profile learning up -d --build --force-recreate agent
```
Open http://127.0.0.1:3011/vision. The Minecraft server and its volumes do not need reset.
