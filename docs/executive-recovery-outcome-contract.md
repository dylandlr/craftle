# Executive recovery / option-episode integration

This milestone joins the existing `ThreeSystemLoop`, targeted 44×15 DQN adapter, `NavigationRecoveryLearner` and `GoalPortfolio` **offline** without replacing live Turesla's policy. It takes explicit observations from its caller; it does not fabricate Minecraft events or outcomes.

| Execution distinction | Recorded `kind` | Option episode settlement | Executive behavior |
| --- | --- | --- | --- |
| Action unavailable under current capabilities | `capability_unavailable` | `interrupted`, bootstrap next observation | Keep goal unless recovery budget exhausted |
| Action attempted and did not work | `attempt_failed` | `verified_failure`, **not** environment-terminal | Keep objective, learn negative outcome |
| Progress, but task not complete | `partial_progress` | `unknown`; record actual movement evidence | Maintain objective |
| Objective worth revisiting | `goal_deferred` | `interrupted` | Table with explicit `resumeWhen` |
| Action outcome directly verified | `action_succeeded` | `verified_success` with agent observation provenance | Record action progress |

The DQN still learns once per settled episode, with duration-aware discounts through its adapter. This is NOT proof that Turesla has learned to navigate or survive better.

**Important design limitations before a live rollout:**
- The currently deployed Minecraft agent does not yet instantiate `ThreeSystemLoop` or `ExecutiveRecoveryBridge`; the spectator recovery telemetry in PR #31 remains separate.
- This bridge maps new domain outcomes onto existing option result enums instead of modifying old checkpoint schemas.
- A route failure means the CURRENT planner found no route; it does not prove the world is impassable.
- The recovery learner's `beginRecovery` and `finishRecovery` calls need actual attributable, same-target Mineflayer evidence; the current test inputs are simulated.
- Truncation is not death: don't use `episodeTerminal` unless a real game termination occurred.
- `resumeWhen` is recorded but still text, not an evaluated environmental predicate.
- Failure of downstream callbacks can currently cause non-atomic resolution; before enabling live learning, add an event journal/transaction strategy, replay-safe IDs, and restart recovery.
- No additional visual pixels are passed to the agent. Observer HUD/chat remain human-only.
- The live checkpoint, world and continuous agent are not changed by this PR.

Run `node --test test/executive-recovery-bridge.test.js` from repository root.
