# Craftle: Learning from completed experiences (architecture v1)

## Observed baseline (code review, 2026-10-31)

In main, `src/targeted-controller.js` uses epsilon-greedy `createOptionDQN` with default epsilon=0.3. `src/targeted-survival.js` runs a nominal 1800ms option decision interval. The controller constructs the previous transition on the next `choose()`, before the new option begins, with `steps:1`. Those are temporally sampled transitions, not necessarily completed task outcomes. Q-values are **not** probabilities.

This is a design proposal; none of the changes below are implemented.

## Invariants

1. Preserve Turesla's active checkpoint/continuous data and legacy controller baseline. No silent migration.
2. **Act → wait for an outcome → attribute → learn → decide again.** Don't immediately replace an unfinished option merely because the scheduler fired.
3. Allow *interruption* for critical hazards, death, disappearance of goal, irrecoverable path failure, explicit timeout, or configured safety limits. Log reason, duration, terminal/truncated status and verified evidence.
4. An option is an episode with ID, observation contract version, chosen skill/target, start/end Minecraft tick, start/end wall clock, starting inventory/health/food, expected affordance, attempt count, and observable result.
5. Enforce a maximum duration and bounded retries, so 'commitment' is not infinite repetition of a stuck action.
6. Distinguish outcomes: verified_success, verified_failure, interrupted, timed_out, no_observable_change, unknown. Never silently label unknown as success.
7. For temporal-difference learning, use semi-Markov target: `r_aggregated + gamma ** duration_in_policy_steps * max_legal_next_Q`. Choose and document whether duration is actual ticks or fixed quantum; calibrate discount accordingly.
8. Keep causality conservative: local observations can show inventory delta, broken block, position change, but attributing it to a specific action requires before/after instrumentation and control for other effects.
9. Existing curiosity journals are observation-only. Future curiosity picks a *bounded intervention* with a pre-action prediction, then compares recorded outcome. No recipe table, privileged world seed, or scripted expert semantic label.
10. Persist knowledge and run lineage across deaths/checkpoint resumes. Agent's learned affordance evidence and policy weights are separate artifacts.
11. Always distinguish **chosen option**, **navigation sub-actions**, **executed control ticks**, **observed outcome**, and **learning update**. A pathfinder moving is not a new DQN choice.

## Implementation milestones

- A: Read-only audit: link decision IDs to pathfinder outcomes, verified harvest/eat/inventory/health changes, option durations and interruption reasons in current logs. Count option turnover and time-to-outcome.
- B: Pure `OptionEpisode` finite-state machine with tests for success/failure/death/timeout/interruption; no integration with the agent.
- C: Integrate behind opt-in `CRAFTLE_OPTION_EPISODES=1` only in isolated trials. Scheduler checks active episode; no new DQN choice until settled. Add maximum duration and safety preemption.
- D: Train using time-aware transitions, proper truncation handling, target network diagnostics, model validation and reproducible exploration schedule.
- E: Connect curiosity prediction to intervention/outcome events, reward **measured learning progress** only, compare against no-curiosity and random exploration on paired seeds.
- F: Study low-level motor actions (forward/jump/sneak/swim) as a separate action-space experiment rather than mixing with scripted navigation.

## Controlled comparisons

Use paired seeds and fixed total environment ticks and learning budgets to compare: legacy fixed-interval DQN, temporally-extended DQN (equal epsilon), temporally-extended DQN with scheduled epsilon, and curiosity-enhanced temporally-extended DQN. Compare verified survival/food/harvest outcomes, novel affordances with repeated evidence, decision switches per minute, option completion rate, deaths, and episode return.

**Do not optimize only for fewer switches**: a frozen or stuck agent would score well. Outcomes and learning curves are decisive.
