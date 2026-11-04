# Craftle: embodied action and descent learning contract (candidate)

## Scientific objective
Determine whether a non-LLM agent, given generic Minecraft motor operations and local
observations, can discover useful resource manipulation and navigation sequences
without being supplied those sequences by an author.

No authored `bridge`, `dig staircase`, `water-bucket clutch`, or `pillar` macro-action
may be inserted into the agent policy, action mask, curriculum labels, or reward.
The underlying game physics, tools, block validity and basic Minecraft item rules
are environmental constraints, not strategic recipes.

## Boundary: client, agent, and language
Mineflayer API support is NOT synonymous with a learned skill. Separate:
- **Client capability**: Minecraft protocol permits a normal player operation.
- **Executor**: implementation issues the input and awaits an observed outcome.
- **Affordance**: locally observed operation and arguments may be attempted.
- **Policy**: selects the affordance; learns from consequences.
- **Attribution**: records exact attempt, server tick if available, resulting
  blocks/items/health/position and possible outside intervention.

Chat uses `bot.chat`; there is no free-text generator in the motor Q learner.
A separate language policy must supply text. Commands are disallowed by default
and chat delivery is not verified merely because `bot.chat` returned.

## Environment and observations
Use the Mineflayer self-observation only: nearby known block cells, player
position/velocity, facing, health, hunger, inventory, equipped item, entities
and interaction results. Unknown chunks remain unknown. Never feed spectator
or administrator observations into agent state.

The environment exposes generic operations:
`move`, `look`, `jump`, `sneak`, `sprint`, `dig`, `place`,
`equip`, `craft`, `attack`, `use_block`, `use_item`,
`open_container`, `transfer`, `chat`, `wait`.

The initial affordance and Q implementations are proposals; they are not a
fully bound Mineflayer action surface. Every executable action must be paired
with a physically grounded argument and a real actuator.

## Descent formulation
Treat descent as an *environmental objective*, not a prewritten procedure.
Learning evaluation may reward sustained progress toward a reachable lower
destination while penalizing injury, time, starvation and failed actuation.
Do not reward `place` or `dig` just for selecting those verbs.

The unified descent geometry component is a baseline, not the agent's
exhaustive planner. It identifies observed short steps, drops, climbable
terrain and water. It is useful as a safety/reference control.

The emergent treatment must permit arbitrary sequences of generic actions
to alter world geometry. A policy may learn to create support, remove support,
use fluids, climb, traverse, or decline to move. Those outcomes must emerge
from interacting with game physics rather than being chosen from authored
descent solution names.

Important practical limitation: partial observability and a finite action
budget make arbitrary creative solutions hard. Evaluate progress and failure,
not just whether a preselected escape was completed.

## Evaluation matrix
1. One-block ledge: locomotion control and zero damage.
2. Tree trunk: generic starting substrate, no oak-specific knowledge.
3. Descending terraces: repeated decisions with varying terrain.
4. Isolated platform + initially held blocks: geometry mutation may help.
5. Isolated platform + initially equipped tool: geometry mutation may help.
6. Vertical water or climbable column: distinct medium-specific controllers.
7. Unknown chunks and hazardous landings: explicit uncertainty and risk.
8. Critical health (1 HP): preserve damage-risk assessment; never assume
   risky movement is free.
9. Held-out seeds, heights, geometries and inventory mixes.

Record the outcome distribution across seeds: survival rate, fraction reaching
lower stable ground, median decisions, total observed vertical displacement,
blocks broken/placed, verified inventory changes, fall damage, no-op attempts,
unique action compositions, and intervention rate.

## Baselines and controls
- Scripted safe geometric descent controller (assisted)
- Random legal motor choice
- Variable-candidate Q policy, trained and frozen (non-LLM)
- Existing 15-action survival controller (cannot choose generic block edits)
- Optional privileged planning control, tagged separately (never silently
  substituted into the non-LLM experiment)

Checkpoints for the new candidate use `craftle.motor-q.v1.candidate` and must
never overwrite `craftle.targeted.dqn.v1`.

## Promotion gates
- Executor tests, then Mineflayer in-game acceptance for each generic actuator.
- Exact observed-outcome receipts for every block/inventory mutation.
- A real Minecraft training run with reward and action attribution.
- Held-out frozen evaluation with no hidden curriculum scripts.
- Evidence that a learned composition transfers to multiple terrain types.
- Demonstrate and separately report any human-authored intervention.

Current implementation state:
- `src/motor-affordances.js`: generic argument-level candidate enumeration.
- `src/motor-q-policy.js`: experimental variable-candidate learned scorer.
- `src/chat-motor.js`: safe output primitive, no language generation.
- `src/unified-descent.js`: geometric reference candidate planner.
- `src/descent-executor.js`: one-block embodied attempt with outcome checks.
- Other Minecraft actions remain partially wired or unverified in a live server.

## November 2026: negative results and planning-assisted control

The initial candidate-policy trials found 0/240 training and 0/20 frozen chasm
successes, even after balancing exploration and adding generic local-state
novelty. The frozen policy disproportionately selected `wait` and exhausted
its horizon without reaching a goal. A generic bounded search independently
found and successfully replayed a sequence of four atomic actions in the
small span-3 chasm. This establishes feasibility in the *toy physics*, not
Minecraft or independent learned construction.

The next experimental arm uses search-generated examples to train the
same candidate-value network through pairwise imitation. It is explicitly
`planning_assisted`, **not** a legitimate claim of emergent unassisted
reinforcement learning. Comparing held-out frozen results with placement
removed is mandatory. The standalone RL result remains the unassisted
baseline and must not be overwritten.

A general planner is not itself a hand-authored bridge recipe, but privileged
full simulator forks give this arm an informational advantage not available to
a real Mineflayer agent. Future work must restrict a learned world model to
agent-generated observation/action histories before testing model-based
planning in Minecraft. Report planner teacher provenance and separate
simulation performance from real Minecraft block-change receipts.

## Motor Q v3 outcomes and compositional evaluation

Local synthetic results reported by the experiment runner: 27/27 regression
tests; original eastward planner-assisted demonstrations transfer to all
four rotations (18/18 each), to span-4 (18/18), and to one-block inventory
(18/18). The same frozen policy achieves 0/18 on an obstructed eastward
chasm and 0/18 on obstructed westward chasm. The obstruction is independently
known to be removable via atomic `dig` after ordinary placement and movement.

The new `benchmark-compositional-motor.js` is a **different experimental
arm**: the baseline gets eastward open-world generic search examples only;
the mixed arm gets eastward open and obstructed search examples. Neither
gets a named construction/excavation recipe, but both receive privileged
teacher demonstrations. Compare frozen policies across unseen directions,
resource scarcity and no-dig/no-place ablations. Treat loss on open tasks as
catastrophic interference and report the teacher's successful demonstration
coverage explicitly. No mixed-arm results are currently verified.

## Repeated excavation evidence and delayed-obstruction holdout

Reported synthetic results: all 30 selected tests passed. The frozen mixed
planner-assisted learner achieved 18/18 on each held-out two-layer east/west
barrier and 18/18 on a three-layer north barrier. The mean trajectory used
one placement plus exactly two or three digs respectively; no-dig control
achieved zero. These outcomes are evidence of repeated reactive primitive
selection within the known generator, not independent invention.

The next held-out evaluation varies `obstacleOffset` to move the barrier
beyond one or two traversable platform cells. Training demonstrations remain
offset zero. It also combines offset two and depth two in a rotated world.
This rules out some fixed-position action sequences and records failure traces,
but the entire task is still a deliberately simplified artificial world.
Do not claim the new offset results until they have been executed.

## Perception versus affordance — verified counterfactual attribution

User-run synthetic counterfactual evaluation of 24 matched pairs found mixed
planner-assisted frozen model:
- 24/24 correct dig (blocked) vs move (clear) when the affordance menu
  is recomputed.
- 0/24 action switches when the stale blocked-world candidate menu is held
  fixed despite changing only block perception.
- Mean forward-movement Q increase of ~0.4059 when obstruction is made
  perceptually absent, compared to ~0.000233 for east-only baseline.
- All 24 stale dig preferences are removed by revalidating candidates against
  the changed observation, recovering move in 24/24 pairs.

Thus *learned value sensitivity and affordance grounding both matter*; a
raw Q-network alone has **not** demonstrated reliable fixed-menu selection.

A new, **synthetic-only** `motor-freshness-guard.js` prototype checks a
proposed candidate's identity against a freshly enumerated menu and observed
preconditions immediately before simulated execution. It returns executor
outcomes rather than treating a proposal as an achieved action, never chooses
a substitute for a rejected stale candidate, and does not touch the live
Turesla controller. Newly committed tests await user execution. This is a
research fixture: the actual Mineflayer/authoritative-server integration
still requires server-issued ticks and observational receipts, source-of-truth
block changes, safe reach checks, and tested race-condition handling.
