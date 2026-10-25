# Craftle architecture review v0.4 — experimental intelligence platform

## Scientific claim boundary
Survival success, weight updates, emergence of skills, and general intelligence are distinct outcomes. Every claimed capability needs an explicit operational metric, comparator and evidence provenance.

## Tracks
1. Assisted four-option DQN (seven structured features, four scripted survival options): legacy preserved control.
2. Targeted-skill DQN (44 inputs, 15 actions): next learning treatment, with target candidates and low-level execution separated. It still inherits scripted semantic categories and pathfinding.
3. True first-person RGB policy: separate ambitious visual treatment. A recorded camera does not prove vision-driven action.
4. Optional LLM reference modules in repo: isolate completely from non-LLM experimental treatments.
5. Server environments: Paper development, Mojang vanilla reference, Create-compatible modded transfer test. Identical seeds alone do not equate world dynamics.

## P0 scientific integrity and live experiment
- Preserve checkpoints and lock immutable train/evaluation manifests. Pin server binary digest, version, dependency lockfile, renderer, world seed, difficulty, spawn position, starting inventory, game rules, observation schema, action schema, reward schema, git SHA, training state hash.
- Distinguish policy update counts, verified hunger recovery, actual food collection, independent inventory snapshots and scene/trajectory evidence.
- Reconcile action-attribution as decision ID -> command invocation ID -> server-observed event ID -> evidence certificate -> once-only reward -> exact transition/update. Time-window association alone is not proof of causality.
- Add exact training state snapshots: weights, target network, replay ring, sampling RNG, exploration RNG, optimization counters, relevant scheduler and pending transition, checksum, compatibility schema. Crash recovery must either restore complete state or explicitly reset the episode.
- Durable immutable checkpoint registry, not Actions cache alone. Never allow unvalidated state to overwrite blessed checkpoints.
- Held-out tests: matched sensor/action interface, frozen policy, scripted and random controls; multiple worlds, repetitions, confidence intervals and early stopping criteria. Paper→vanilla true transfer freezes Paper weights.
- Distinguish failed experiment infrastructure from honest behavioral failure.

## P1 learning competence
- Reconcile the targeted 44-input/15-action treatment with versioned observation access rules: self state, candidate targets, relative position, reachability and provenance of semantic classes.
- Validate primitive state machines separately: move, approach, attack, collect, harvest, eat, retreat, craft. Timeout, interrupted execution, cooldown, terminal checks, target identity; latency-adjusted decision time.
- Upgrade from one-step/short-option DQN to recurrent partial-observation baseline and duration-aware skill credit. Use scripted, random, behavior cloning and RL treatment where appropriate.
- Construct diagnostic tasks of progressively increasing difficulty with outcome verification; automatic curriculum should use competence progress (not arbitrary scripted task order).
- Reduce reward proxy hacking: penalize repeated nonproductive attempts, make item acquisition/recovery sparse and verified, test reward coefficient and ablations on held-out seeds.
- Perception: distinct RGB-only and structured sensor treatments, never mix privileged block/entity data with visual-only claims.

## P2 longer-horizon cognition
- Reusable learned option = initiation conditions + intra-option policy + termination model + demonstrated success distribution + versioned provenance.
- World dynamics/prediction with calibrated uncertainty and discovery of tool/resource affordances.
- Episodic memory, procedural memory and learned semantic associations. REAL, REPLAY_OF_REAL and IMAGINED are distinct provenance classes.
- Self-selected rest/journal/plan/replay actions consume time/resources and require counterfactual ablation to demonstrate value.
- Learned goals via competence-progress exploration, curiosity constrained against novelty loops, and homeostatic survival needs.
- Technology: action-conditioned experiments with ingredients, crafting grid, tools, stations, Create machines, outcome predictions. Fixed API recipes and hard-coded semantic knowledge are separate oracle treatment; observe technology discovery beyond supervised recipe lookup.

## P3 social/societal
- Multiagent observation contracts and shared-world clock; communication primitives, partner memory, trust, trade, cooperation and competition.
- Distinguish actual social reward effects from scripted social policy. Track resources, institutions, culture, child learning / inheritance only after single-agent competency.
- Governance, safety, faction dynamics and emergent division of labor as separate benchmark families.

## Stage gates
G0: CI and Minecraft telemetry healthy; videos span trials with valid clocks.
G1: two consecutive episodes resume exact checkpoint identity and valid update accounting (weights continuity already demonstrated at 104→208; full replay/RNG continuity not yet).
G2: 5+ repeated seed-paired frozen benchmark vs random, scripted and no-learning ablation, preregistered success metrics.
G3: targeted actions acquire food and recover hunger in independent natural worlds, with verified event-to-update evidence.
G4: learned skill transferable to new target/world without scripted solution substitution.
G5: multi-step skill composition (resources → crafting → technology), no imported pretrained Minecraft knowledge.
G6: genuine open-ended, independently replicated long-horizon discovery.

## Known present status
- Existing tested infrastructure: Mineflayer body, partial event ledger, DQN option selection, separate targeted controller, checkpoint weight continuity across two Paper episodes, POV recordings, scheduled short training, several experimental controls.
- Absent or incomplete: exact replay/RNG resumption, causal action→server event chain, proven superior frozen policy, true vision-driven autonomous behavior, learned primitive skills, memory consolidation, intrinsic curriculum, emergent crafting/technology, social RL.
- Repository includes LLM modules; they must not be enabled in non-LLM runs.
- Avoid treating 180-second hourly jobs as uninterrupted persistent simulation.
