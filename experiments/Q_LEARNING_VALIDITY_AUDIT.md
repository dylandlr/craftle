# Craftle held-out Q-learning result — validity audit (2026-10-22)

## Observed evidence
GitHub Actions run 39885642827 completed three isolated jobs, one per Minecraft seed (20261119, 20261120, 20261121), each comparing the frozen visual Q-table against random action control. Reported mean intrinsic rewards per transition:
- 20261119: Q 0.030970, random 0.231582, difference -0.200612.
- 20261120: Q 0.236219, random 0.287291, difference -0.051072.
- 20261121: Q -0.036922, random 0.253561, difference -0.290483.

Frozen dominant-action fractions: 0.880, 0.600, 0.980. Random: 0.275, 0.231, 0.288. All three seed-specific reward differences are negative, with an unweighted mean difference of approximately -0.1807. Three of three negative signs yields a two-sided exact sign-test p-value of 0.25 under independent unbiased signs, not statistically significant at 0.05.

## Design validity
- Both treatments used the same Mineflayer action interface, nominal 350 ms motor pulses, first-person RGB brightness state, and nominal 60-second limit.
- Frozen evaluation was designed to load a stored Q-table and disable both exploration and Q-value updates. Checkpoint hashes were checked after both treatments.
- Each treatment used a fresh Docker Minecraft server initialized with the same specified world seed, but this **does not prove identical player spawn coordinates, terrain observation, mob states, or weather at first decision**.
- Training world seed (20261022) differs from held-out seeds.
- **The random controller does not use the brightness-state abstraction for decision making**. Thus the result compares complete policies, not isolated changes to learning.
- The reward is an intrinsic proxy primarily rewarding absolute displacement and coarse brightness novelty. It is not an independently established measure of exploration, survival, or Minecraft mastery.
- Action reward is attributed between asynchronous camera frames and may include latency, inertia and effects outside the requested action window. Equal motor-pulse limits are not equal measured physical-effect windows.
- Epsilon=0 frozen evaluation gives a deterministic greedy policy. Unseen states default to first action (forward), making severe action collapse partly an **implementation bias**, not necessarily learned behavior.
- Three seeds are a tiny, potentially correlated and non-pre-registered sample. World-generator determinism does not imply identical spawn or paired stochastic states.
- No independent task-based metric, confidence interval with meaningful coverage, or quantitative treatment effect on survival has been established.

## Permissible conclusion
In this exploratory three-seed held-out comparison, the frozen tabular brightness-based Q policy earned less *intrinsic reward per transition* than the random policy on all three tested seeds. It strongly repeated one action. It is **not valid** to conclude that Q-learning generally fails in Minecraft, that random agents are inherently smarter, or that deep RL will necessarily be better.

## Required next tests
1. Record exact spawn (coordinates and dimension) and world version, health, inventory, weather, initial camera checksum, observation-to-action latency and physical duration.
2. Refactor action attribution to reward the measured interval immediately after motor pulses, including a controlled rest window; prevent slow camera delivery from silently extending evaluation.
3. Define an independent goal metric (distance from spawn, unique traversed areas, items obtained, survival) with predefined success criteria.
4. Fix deterministic first-action tie bias; run baseline policies with randomized tie-breaking and coverage-aware exploration, explicitly separating treatment changes.
5. Pre-register a larger holdout seed set and multiple replicates per seed; retain failed/censored trials and publish paired effects with uncertainty.

Source run: https://github.com/dylandlr/craftle/actions/runs/39885642827
