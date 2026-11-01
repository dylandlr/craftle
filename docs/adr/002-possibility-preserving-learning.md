# ADR-002: Preserve possibilities without invalid Bellman targets

Status: PROPOSED; does not change the live v1 checkpoint, reward or runtime.

## Core design correction
The system must not treat a missing route, unfamiliar skill, or absent currently observed target as proof that a goal is impossible.
Separate four predicates for a goal or option:
- physical legality: known impossible under current game rules, known possible, uncertain;
- capability availability: executor/skill installed, missing, or unknown;
- planner feasibility: route found, route not found, or not evaluated;
- opportunity existence: observed, inferred, remembered, or untested.
Only provably illegal primitive actions get permanently hard-masked by the constraint layer. Missing capabilities and failed plans are recorded as *recoverable beliefs*, not permanent masks on high-level goals.

## Decision levels
A long-lived goal portfolio retains unattained possibilities with evidence, confidence and revisitation triggers.
The executive chooses an executable subgoal or an information-gathering action, not necessarily the original unattainable option.
The option learner estimates return conditional on the current situation, including option feasibility and uncertainty.
A route-not-found result updates planner reliability / uncertainty; it does not declare a destination physically unreachable.

## Temporal valuation: do not use one gamma for all meanings
For finite episodes, gamma=1 can be valid with bounded rewards and terminal handling.
For continuing Minecraft survival, undiscounted sums can diverge; gamma=1 requires a bounded/episodic or average-reward formulation.
An SMDP with tick discount gamma uses target:
  R_k = sum_{j=0}^{k-1} gamma^j r_{t+j}
  y = R_k + (terminal ? 0 : gamma^k max_{o' feasible NOW} Q_target(s',o'))
The max is over options currently executable at the *low-level control layer*. It is NOT the ontology of imaginable high-level goals.
Alternative to discounting: average-reward differential SMDP
  delta = (sum_{j=0}^{k-1} r_{t+j} - rho*k) + max_{o'} h(s') - h(s)
where rho is an estimated average reward per server tick and h is a relative value; assumptions include an ergodic/unichain induced process and stable estimation. This requires a distinct algorithm, not setting gamma=1 in existing DQN.

## Research stance
Plausible but unobserved strategies remain in hypothesis memory; provide investigation, tool building, and curriculum opportunities subject to evidence and safety limits. Avoid permanently excluding a goal based on a single planner failure.
Do not require RL to assign a numeric Q-value to every imaginable possibility: open-ended possibility spaces cannot fit a fixed finite-action Q-head. New capabilities require a versioned skill/action schema or parametric goal-option representation.

## Required acceptance criteria
1. One failed pathfinder route does not remove its high-level goal.
2. Known impossible primitives are not executed; uncertain possibilities can be investigated through safe subgoals.
3. A temporarily unavailable capability produces evidence + retry conditions, not a permanent ban.
4. Empty executable option set routes to a bounded recovery supervisor; it must not crash the continuous runner.
5. Future opportunities are not zero-valued solely because they cannot be executed now.
6. Discounted and average-reward targets are mathematically separated, tested on finite toy processes, and evaluated independently.
7. All long-running goal pursuit obeys resource/time budgets, preventing endless stuck attempts.

## Migration
Keep continuous v1 frozen as historical baseline. Implement a goal possibility registry + typed capability/feasibility evidence first. Add executable supervision and episode outcomes next. Evaluate SMDP discounted vs differential-average-reward learner on isolated runs with identical seeds/worlds. Only then choose the ongoing objective.
