# Craftle autonomous spectator and camera handoff — v1 design contract

Status: **design approved, not yet implemented**. The existing Prismarine Viewer third-person web server remains the working baseline.

## Intent

A **virtual director**, not a player or Minecraft protocol client, watches and records experiments unattended. Visiting the spectator web UI lets a human temporarily control the spectator camera. Closing the viewer or pressing **Return to Auto** returns it to autonomous camera selection. Neither mode can issue agent locomotion/look/control commands, mutate server blocks, modify inventories, or add a Minecraft player/entity.

## Isolation invariants

1. Recorder is a service/process separate from the learning agent and its three-minute sessions. Agent restarts do not destroy the recorder's state, recordings, or web UI.
2. No recorder Mineflayer login. Agent-world telemetry comes from a read-only, explicitly bounded bridge; never inject extra in-world players, send gameplay packets, or expose the camera pose to the policy.
3. A human controls **spectator camera pose only**. Any agent commands must use a separate opt-in, authenticated experiment-control interface, disabled by default; not an extension of camera controls.
4. Observer cannot grant rewards, influence agent observations, or write to agent checkpoint. Session/agent identity and camera provenance appear in recordings.
5. Expose web/control port on host loopback by default; reject unauthenticated remote control. Browser disconnects and restarts release temporary leases.

## State machine

- `AUTO_RECORDING`: zero human owners; camera tracks selected AI with smoothing, adjusts distance/occlusion, maintains deterministic fallback.
- `MANUAL_CAMERA`: one authorized browser owner holds a short renewable lease (heartbeat); WASD/mouse update camera independent of agents. Auto recording continues separately.
- `RETURNING_TO_AUTO`: lease released/expired, blend into latest auto-selected target with bounded duration; then AUTO_RECORDING.
- `NO_AGENT`: keep service alive during agent respawns/session restarts; show last known metadata / searching; never reset recorder.
- `ERROR`: preserve last valid footage and diagnostic log; recover automatically if safe.

Handoff is triggered by explicit **Take Camera**. Opening the UI alone can remain read-only until the user requests ownership, preventing tab/viewer focus from disrupting capture. **Return to Auto** or disconnect lease expiry transitions out of manual.

## Recording separation

- `scientific_reference.mp4`: uninterrupted canonical first-person agent observation with timestamped frame manifest; no human camera interventions.
- `director.mp4`: unattended third-person cinematic camera with its own timestamped metadata and target selection; manual UI takeovers do not stop this stream.
- `manual_camera.mp4`: optional user-directed footage, separately labeled with operator-session boundaries.
- Shared world/server time anchors, frame dimensions, dropped-frame counts, session ids, and agent ids allow aligned multi-view comparison.
- Default output 1280x720; test encoder/video dimensions and frame pacing. Prefer resilient segments over one permanently open MP4 so failures do not destroy previous footage.

## Auto Director v1

Track selected agent, smooth chase cam; default full-body framing. Switch only on stable, measurable action/event priorities (combat > death > crafting/interaction > travel > idle), with hysteresis/cooldown to prevent camera thrash. Avoid invented event interpretations. Support temporary gaps at session boundaries.

## Human spectator v1

- Left panel: live agent roster, follow selection, policy/session identities.
- Right panel: health, food, position, last action, inventory, recent events; show timestamps and stale telemetry indicator.
- Mouse look, WASD navigation, Q/E vertical movement, Shift speed, orbit/zoom; camera only.
- Keyboard shortcut/button: Take Camera, Return to Auto, Follow selected.
- Read-only clients can coexist; exactly one camera lease holder per shared manual camera.
- Support camera mode and handoff in local browser without spawning any Minecraft player.

## Walking and jumping

The Mineflayer player seen as the local viewer subject may lack complete entity animations in Prismarine Viewer. Drive rendered character gait/poses from measured velocity, grounded state and authoritative action events. Display inferred visual-only states as inferred; never fabricate agent actions. Validate walk, jump, fall and idle on an actual agent in the local vanilla world.

## Acceptance tests

1. No new entry in server player list or entity count when spectator connects, disconnects, moves, or follows.
2. Agent action/event traces and rewards are identical between camera-controlled and camera-idle deterministic test runs, modulo recorded wall-clock resource overhead.
3. Auto Director runs for >2 full agent-session boundaries with no browser connected; videos have verified width=1280,height=720, nonempty frames and monotonic frame timestamps.
4. Two browser clients: only lease owner controls manual camera; auto recording uninterrupted; lease expires promptly after abrupt tab/browser closure.
5. Return to Auto, session restart, agent death/respawn, viewer reload, and crash recovery do not mutate accepted learning checkpoint.
6. Real walk/jump footage displays arms/legs movement and visible airborne frames, tied to measured motion.

## Implementation order

1. Decouple spectator service/process from agent three-minute lifecycle and specify read-only telemetry stream with agent identity.
2. Add persistent auto-director camera and segmented 720p recording.
3. Add authenticated local manual camera lease + handoff, WASD/orbit/follow UI.
4. Add inspector and gait/jump rendering; validate on real Minecraft footage.
5. Add multi-agent coverage and event-driven cut selection.

## Current limitations

As of this design, the working third-person Prismarine Viewer starts from within `src/main.js` at agent spawn and ends with that bot's session. The headless capture is first-person. A standalone recorder, manual handoff, animations and dual-POV recordings require actual implementation/testing. Do not represent this document as deployed functionality.
