# Q-learning implementation scrutiny — corrective audit

## Mathematical update
Craftle implements off-policy one-step tabular Q-learning:
Q(s,a) <- Q(s,a) + alpha [ r + gamma (terminal ? 0 : max_a' Q(s',a')) - Q(s,a) ].
This update is algebraically correct. Regression tests now cover the numerical bootstrapped target and zero-bootstrap terminal update.

## Confirmed implementation defects and corrections
1. **Greedy first-action tie bias (fixed):** unseen/all-tied states previously chose the first schema action, `forward`. Now the greedy branch uniformly samples among exactly tied maximum-valued actions. The frozen policy still does not train, and a seeded random source is required for replay-deterministic tie sampling.
2. **Delayed motor reward attribution (partially fixed):** displacement and health delta previously measured across entire renderer-frame intervals; now each control pulse records its own beginning/end position, health and timestamps. Next visual state still arrives asynchronously; absolute displacement and novelty remain weak proxies. Action starts and ends are logged for independent auditing.
3. **Unreliable checkpoint validation (fixed):** malformed state rows no longer silently disappear on reload. Cumulative update counter is persisted.
4. **Frozen learning could initialize Q-table before throwing (fixed):** no Q-table changes occur when frozen learning is attempted.
5. **Invalid state input might create entries during failed updates (fixed):** validate before mutation.

## Remaining scientific validity problems
- Quadrant brightness state aliasing violates the Markov approximation severely. An apparently identical brightness key may conceal completely different locations, hazards, resources and movement opportunities.
- Fixed gamma per decision treats decisions of uneven wall-clock length as equal time steps.
- No terminal-aware Minecraft training loop: death/disconnect is not reliably processed as a terminal Q transition.
- The first observation after an action can arrive with highly variable camera delay. An action pulse is now bounded, but the state transition still spans an uncontrolled observation gap.
- Random action and greedy tie selection need explicitly seeded RNG streams and precommitted seeds to be exactly replayable.
- Pixel states do not contain own orientation, hunger, or velocity; agent lacks recurrent memory.
- Epsilon fixed at 0.30 during training; no exploration-schedule ablation.
- Intrinsic reward rewards displacement and novel brightness classes, not Minecraft success. A rotating / repetitive path could exploit it.
- Metrics cannot establish game competence without independent navigation, collection, survival, and task milestones.
- Comparison does not control exact spawn and procedural stochasticity and has only three seeds.

## Crucial interpretation
Old checkpoints and evaluations are **not commensurable with corrected learning code**. They reflect first-action tie bias and old reward timing. For a valid post-fix comparison, train from a **fresh Q-table**, retain training/evaluation version identifiers, and rerun frozen-vs-random comparisons on held-out world seeds. The prior three-seed failure remains a reproducible observation about the old implementation only, not a valid estimate of corrected Q-learning performance.

Source: https://github.com/dylandlr/craftle/actions/runs/39885642827
