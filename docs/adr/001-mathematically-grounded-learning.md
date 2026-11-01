# ADR-001: Mathematically grounded learning (proposal, not deployed)

## Source-verified defects
- Controller sets steps=1 on every transition, although options span varying real time.
- DQN uses target = reward + gamma^steps * max allowed target-Q, gamma=0.95; terminal suppresses bootstrap; TD residual clipped [-5,5].
- Replay holds 512 experiences; four SGD updates per experience; target network copied every 100 SGD updates. Updates are not decision counts.
- Reward v1 = verified-eat credit + 0.7 * min(0, delta health) - 0.03. It does not distinguish successful navigation from no-route behavior.
- Action masks restrict the policy: explore is always true unless explicitly infeasible; retreat requires hostile within 24 blocks; edible inventory enables eat; target actions require detected candidates. Last 200 traces: 153 singleton masks and 200 no-target observations.
- Masked Q values are not viable counterfactual action evaluations and should not be interpreted as such.

## Mathematical migration decision — semi-Markov options
The new learner must record start and end Minecraft server ticks, k>=1, actual execution evidence, observed interval rewards, terminal flag, and next feasible mask.

R = sum over j=0..k-1 of gamma^j * r[j]
TD target = R + (environmentTerminal ? 0 : gamma^k * max eligible targetQ(nextState)).

Do not merely change the steps input while keeping a one-time reward if reward accrues over the interval.

Discount scale MUST be redefined when migrating. Current gamma=0.95 has half-life log(0.5)/log(0.95)=13.513 decision steps. If treated as server ticks at 20 TPS, it is only ~0.676 seconds. For a 60-second tick-based half-life use gamma=2^(-1/1200) (~0.9994225). This is a proposed time horizon, not a discovered optimum.

## Architecture contracts
Distinguish available, planner-feasible, command-issued, actual effect, and verified outcome. Feasibility predictions are not proofs of impossibility.

Outcome states: verified_success, verified_failure, no_observable_change, interrupted, timed_out, unknown. The executive owns interruptions/retries; environment terminal applies only to genuine terminal events. If no option is eligible, route to an explicit recovery supervisor rather than throwing out of the continuous learner.

New experiment must have a new schema, checkpoints and run ID; freeze v1 intact. Do not transfer old replay to incompatible reward/transition definitions.

## Reward design (new v3 candidate)
Reward primary survival and verified food acquisition, with measured events and declared provenance. Associate health losses with time interval but do not claim causal attribution to the selected option without evidence.

Potential-based shaping candidate F = gamma^k * Phi(nextState) - Phi(state), using the same time scale and correct terminal conditions. Unlike arbitrary novelty/movement bonuses, potential-based shaping has policy-preservation results under its assumptions. Test reward ranges before deployment.

## Evaluation gates
1. Instrument event IDs, start/end server ticks, execution and outcomes with no policy change.
2. Verify SMDP target equation for different durations and terminal vs nonterminal cases.
3. Audit perception detection recall: 200/200 recent traces lack a visible candidate, not necessarily because none existed.
4. Independent multi-seed held-out worlds; metrics: survival length, verified food acquisition, navigation deadlock, action entropy conditional on mask and option success.
5. Ablate one change at a time: SMDP duration, mask feasibility, reward components, epsilon schedule, replay/architecture. Compare with scripted and frozen v1 controls.

Do not increase model size or gamma, alter the live checkpoint, or globally disable explore before the invariants above are proven.
