# Navigation impossibility as an observed outcome

The live evidence from Turesla includes `no_known_connected_route`, `no_native_complete_route`, stationary position, and pathfinder `isMoving:false` / `hasGoal:false`. These support a conclusion that **the current planners did not find a route**, not that the surrounding Minecraft world is fundamentally impassable.

This module adds the explicit `navigation_impossible` outcome and an offline recovery learner, without changing the live bot.

1. A route failure is recorded with decision ID, situation ID, goal ID and failure reason.
2. An experiment controller may propose a bounded attempt (method name is supplied externally, not automatically selected).
3. After the attempt, the learner compares distance-to-goal and whether a fresh route is available.
4. Measurable movement toward the goal or a newly available route marks `observed_recovery_progress`. This remains temporal association, not causal proof.
5. Repeated failures exhaust an explicit budget and recommend **tabling** the goal, preserving earlier progress.

The module is not yet connected to the DQN replay buffer, goal portfolio or Mineflayer movement. In particular, its `navigation_impossible` domain outcome is *not* one of the previous `OptionEpisode.finish` result enum values. A later integration must extend and test that contract instead of silently mapping failures to success or death.

Do not turn on learned recovery in the live experiment until the action execution, tick accounting, resumed state, and separated trial world are verified.
