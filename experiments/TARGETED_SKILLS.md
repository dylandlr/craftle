# Targeted skills pilot v1

## Purpose and supplied knowledge

The existing four-option survival controller stays available as the assisted baseline. A separate `targeted_survival_options` treatment exposes narrower skills and candidate targets. Mineflayer handles navigation and interaction mechanics. Semantic food categories, crop maturity, hostile categories, edible-food filtering, pathfinding and target visibility remain supplied scripted knowledge. This is not vision-only perception, discovered recipes, or learned low-level control. Voyager remains a reference for separating skills and higher-level choices; no LLM or pretrained skills are imported.

## Observation and action contract

`craftle.target-observation.v1` produces 44 network inputs: eight health/hunger/inventory/threat/movement features plus nine features for each of four nearby visible candidate targets. Food inventory includes item quantities and hunger points, rather than stack count alone. Candidate features identify drop/plant/animal type, distance, relative XYZ, visibility and reachability. Entity candidates are within 24 blocks. Crop search is bounded to 16 candidate positions and the final observation is capped at four targets. Nearest candidates win; ties use target identity. Missing visibility support fails closed.

Fifteen discrete actions: eat, explore, retreat; and approach, harvest, or attack for each of four slots. The execution command carries the selected target's entity/block identity, not a slot to reinterpret later. Unavailable candidates and out-of-reach harvest/attack actions are masked. Full hunger masks eating. Retreat is available only when the bounded threat observation contains a hostile.

Approaching an animal does not attack it. Harvesting does not trigger eating. Target selection is performed by the policy; the actuator does not silently substitute another target. Item pickup remains automatic Minecraft behavior when a navigation action brings the player into pickup range. Eating still selects an edible inventory item by scripted rules. Exploration and retreat still supply movement heuristics.

## Learning and checkpoint isolation

The existing small DQN now accepts an explicit input/action/schema contract; its default seven-input/four-option checkpoint remains unchanged. Targeted checkpoints use `craftle.targeted.dqn.v1` at `recordings/targeted/policy.json` (override `CRAFTLE_TARGET_CHECKPOINT`). Loading an old option checkpoint fails. Training, frozen, random and scripted modes share observations/actions; controls never save network weights.

V1 uses one decision per eligible 1.8-second callback, with async actions able to lengthen intervals. It discounts per decision, not per wall-clock second. A matching eat decision receives one reward for observed hunger recovery, with duplicate and old-decision credit rejected. Damage costs 0.7 per health point; a transition costs 0.03; death costs 5. There is no spatial novelty reward in this pilot. Attack/dig calls are attempts and earn no success reward. Food acquisition must obtain delayed value through subsequent eating. Shutdown truncates a pending decision; replay/target-network/PRNG state is not persisted. Persistent goals and memory remain future work.

## Live validation

`targeted-skills.yml` runs training, random and scripted treatments in separate prepared vanilla 1.21.1 crop arenas. Crops and induced hunger are explicit interventions. Spawn protection is disabled so the non-operator bot can interact. The pilot preserves full POV, annotation, runtime logs, timestamped Docker server logs and non-secret server settings. Server-side RCON queries of foodLevel, Health and Inventory every ten seconds provide independent snapshots; they are not exact per-action causal traces. A single arena and short training budget do not establish generalization or learning superiority. No meals is a valid negative result, not an infrastructure error.

Local tests verify candidate filtering, masks and quantities; identity across slot reordering; explicit approach versus attack; selected crop execution with native vector coordinates; death cancellation; checkpoint isolation/frozen weights; and once-only eating credit. Baseline tests remain intact. Live results are pending at implementation time.

## Prior server evidence inspected

Run 40160090520 (previous broad-option treatment) used Paper 1.21.1 build 133 with zero initialized plugins. Server logs report Turesla joining at 03:58:46 and disconnecting at 04:01:48, with no logged death or crash. They do not log ordinary meals, attacks or pickups. Separate agent telemetry reports 180.115 seconds, no meals, no inventory stacks and no runtime errors. The cold-start checkpoint audit reports 26 transitions, 104 updates and successful promotion checks. This confirms execution/accounting, not improved survival or skill discovery. Artifact 12586681355 contains the evidence. Do not compare this Paper natural-world episode directly with the prepared vanilla targeted arena as a matched learning experiment.
