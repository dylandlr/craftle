# Matched-interface control pilot

Audit run 40128601705 verified 94 real transitions, 376 saved gradient updates, 95 choices (70 forage, 14 explore, 11 retreat). This proves update accounting, not competence.

New modes CRAFTLE_OPTION_POLICY=training|frozen|random|scripted use the same seven structured features, food availability mask, four assisted options and decision interval. Scripted option policy uses only the declared fields (unlike the richer legacy reference's reserve policy). Frozen evaluation requires an existing neural checkpoint and cannot save or update it. Random/scripted controls neither load nor overwrite weights. CRAFTLE_OPTION_SEED seeds a deterministic PRNG for initialization/choices/replay; checkpoints do not preserve PRNG or replay state and therefore are not exact training resumptions.

The control workflow evaluates scripted/random/frozen policies for 180 seconds on fresh worlds with held-out seeds 20261206/20261207. Frozen weights come from successful training audit 40128601705. No further training occurs in this evaluation. Each server sets spawnRadius=0, time=1000 and clear weather before the bot joins. World evolution remains stochastic. Initial positions, sensor/action contract and observed durations are checked; mismatched starts/durations are explicitly excluded from paired interpretation. This pilot has one run per treatment/seed and cannot establish significance or reliable generalization.

Evidence includes real sampled POV, metrics, immutable checkpoint hashes and control.json. Comparison reports contain independent meals/deaths/spatial coverage, not just internal training reward. Social state/actions, learned skill discovery, sleep consolidation and emergent institutions remain future work.

## Completed first matched control pilot

[Run 40139918704](https://github.com/dylandlr/craftle/actions/runs/40139918704) passed all six trials and the comparison job. Unit CI passed all 96 tests. Both seed groups passed exact initial-position equality, shared-contract and duration checks. Frozen checkpoint SHA-256 was unchanged before/after evaluation; its update count remained 376. Random/scripted update counts remained zero.

| Seed | Policy | Cells | Meals | Deaths |
| --- | --- | --- | --- | --- |
| 20261206 | scripted | 88 | 1 | 0 |
| 20261206 | random | 72 | 0 | 0 |
| 20261206 | frozen neural | 44 | 0 | 0 |
| 20261207 | scripted | 68 | 1 | 0 |
| 20261207 | random | 65 | 0 | 0 |
| 20261207 | frozen neural | 55 | 0 | 0 |

Each run lasted approximately 180 seconds. Initial positions were (0.5,72,0.5) for seed 20261206 and (16.5,84,-47.5) for seed 20261207. These checks match observed starts, not subsequent stochastic world trajectories.

The frozen neural checkpoint had less spatial coverage than random on both seeds and no meals, while the scripted controller ate on both. This is negative pilot evidence for the present checkpoint; it does not establish that DQN cannot learn the task. Training was only 94 transitions/376 replay gradient updates. No broad statistical or emergent-intelligence claim is justified.

[Comparison JSON](https://github.com/dylandlr/craftle/actions/runs/40139918704/artifacts/12578511603). All six video/log artifacts are attached to that run. Metrics and comparison logs were read; no full-video visual review is claimed for these six recordings.

Next learning priorities: expose observable nearby food/threat opportunity features through a versioned contract, examine interrupted-option credit assignment and memory needs, and run replicated multi-world training and controlled tuning before another multi-hour investment. Seeds 20261206/20261207 have now informed development and must not be called untouched final-test seeds again. Add new confirmation seeds for later claims. Continue to keep scripted assisted capabilities distinct from learned decision-making.
