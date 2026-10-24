# Matched-interface control pilot

Audit run 40128601705 verified 94 real transitions, 376 saved gradient updates, 95 choices (70 forage, 14 explore, 11 retreat). This proves update accounting, not competence.

New modes CRAFTLE_OPTION_POLICY=training|frozen|random|scripted use the same seven structured features, food availability mask, four assisted options and decision interval. Scripted option policy uses only the declared fields (unlike the richer legacy reference's reserve policy). Frozen evaluation requires an existing neural checkpoint and cannot save or update it. Random/scripted controls neither load nor overwrite weights. CRAFTLE_OPTION_SEED seeds a deterministic PRNG for initialization/choices/replay; checkpoints do not preserve PRNG or replay state and therefore are not exact training resumptions.

The control workflow evaluates scripted/random/frozen policies for 180 seconds on fresh worlds with held-out seeds 20261206/20261207. Frozen weights come from successful training audit 40128601705. No further training occurs in this evaluation. Each server sets spawnRadius=0, time=1000 and clear weather before the bot joins. World evolution remains stochastic. Initial positions, sensor/action contract and observed durations are checked; mismatched starts/durations are explicitly excluded from paired interpretation. This pilot has one run per treatment/seed and cannot establish significance or reliable generalization.

Evidence includes real sampled POV, metrics, immutable checkpoint hashes and control.json. Comparison reports contain independent meals/deaths/spatial coverage, not just internal training reward. Social state/actions, learned skill discovery, sleep consolidation and emergent institutions remain future work.
