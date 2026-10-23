# Craftle reward v2, reference controls, and endogenous consolidation

## Baseline preservation
The existing `intrinsicVisualReward` function is unchanged. `CRAFTLE_RL_REWARD_VERSION=v1` remains default, with alpha=.2, gamma=.9, epsilon=.3. The 4-hour training artifact from run 39905600794 is preserved as historical reference. Do not compare raw v1 rewards to v2 rewards: the objectives have different scales and meanings. Replay requires code SHA, exact world seed, fresh checkpoint and observation version.

## Reward v2 pilot
V2 computes environment-side rewards for entry to new **4-block spatial cells**, health loss, task progress if observed, and a per-action/idle cost. The learner still receives only four bins of RGB brightness; no world coordinates go into policy state. New-cell reward is paid once per training run, retained across deaths. No reward is paid for moving vertically in place, so jumping no longer automatically earns movement points. Death remains a separately handled negative terminal reward. These are **hand-selected intrinsic learning incentives**, not hard-coded rules such as 'jump', 'fight' or 'mine'. The current taskProgress channel has no gameplay event source and defaults to zero—do not count it as implemented task-learning reward.

## Pilot matrix (not a final hyperparameter sweep)
- v1 baseline alpha=.2, gamma=.9, epsilon=.3.
- v2-a alpha=.05, gamma=.95, epsilon=.3.
- v2-b alpha=.2, gamma=.9, epsilon=.3.
- v2-c alpha=.1, gamma=.99, epsilon=.5.
Each pilot is only two 90-second training sessions on the same seed and should be interpreted as a **smoke/feasibility test**. It confounds alpha/gamma/epsilon across variants; it cannot identify separate causal hyperparameter effects. Proper tuning later uses one-factor-at-a-time or factorial designs with multiple independent training seeds and separate untouched held-out seeds, multiple runs per combination, identical action budgets, frozen checkpoints, paired task-grounded metrics, and uncertainty intervals.

## Survival-capable reference controllers
Mineflayer itself is a robot API, **not** a ready-made general-purpose survival intelligence. Pathfinder, auto-eat, PVP/PVE, collectblock, tool managers and state-machine plugins can form a survival-capable scripted controller. A reproducible control could use a hazard-avoidance state machine, auto-eating, pathfinder navigation and inventory collection. Such a controller is allowed privileged Minecraft block/entity/game data and must be marked **privileged scripted oracle/reference**, not a same-sensor comparison against vision-only Q-learning. Capture its POV via the same Prismarine renderer while recording its control events, health, deaths, inventory and explored cells. Report the information advantage prominently.
Other research references: Voyager (MineDojo) uses an LLM and code-generated skills, not our intended no-LLM RL baseline. Do not claim compatibility with current Craftle Minecraft/Paper version until tested.
Main candidates: https://github.com/PrismarineJS/mineflayer-pathfinder , https://github.com/PrismarineJS/mineflayer-pvp , https://github.com/PrismarineJS/mineflayer-collectblock , https://voyager.minedojo.org/

## Endogenous consolidation actions (design contract, not yet implemented)
Agent may eventually choose REST, JOURNAL, MEDITATE, or DEEP_THINK as **costly meta-actions**:
- REST/NAP: allocate wall-clock training budget to real experience replay.
- JOURNAL: serialize selected, observed episodes as hypotheses and evidence, never fabricated game events.
- MEDITATE: update learned encoder/world-model on replay without new environment transitions.
- DEEP_THINK: evaluate alternative action plans using a separately calibrated dynamics model.
These actions must not emit free reward simply because they were chosen. Opportunity cost (time, hunger, mob exposure) remains real. Reward any benefit only through improved later **real** outcomes (survival, spatial coverage, progress), compared against equal-compute no-rest controls. Use provenance REAL, REPLAY_OF_REAL, MODEL_IMAGINED. Hypothetical dreams must not contaminate factual memory or ordinary tabular Q updates as if they were real. Sleep is not yet replay training; JPEG capture alone is insufficient, because actions/rewards/terminals need synchronized transitions.

## Risks
- We need direct world-position telemetry and a true external task-success evaluator; new spatial cells are still an engineered proxy.
- Current four-brightness visual state aliases hazards, mobs, obstacles and progress.
- Reward coefficient comparisons must use a common **external** metric, not each policy's internal reward.
- The pilot's training sessions must independently succeed and produce valid Q checkpoints before promotion to longer experiments.
