# Matched-option replication and reward-v2 follow-up

Evidence: successful matched-control run https://github.com/dylandlr/craftle/actions/runs/40149319364
All 6 jobs and aggregator passed. Matched start/contract/duration checks passed. Each run ~180 seconds. The neural policy is the *previous frozen v1 checkpoint* (376 updates), not the newly launched v2 learner.

| World seed | Treatment | 4-block cells | Measured meals | Deaths |
|---|---|---:|---:|---:|
| 20261206 | scripted | 90 | 1 | 0 |
| 20261206 | random | 109 | 0 | 0 |
| 20261206 | frozen neural | 36 | 0 | 0 |
| 20261207 | scripted | 82 | 1 | 0 |
| 20261207 | random | 61 | 0 | 0 |
| 20261207 | frozen neural | 68 | 0 | 0 |

Interpretation: scripted completed the meal outcome in both environments. Random explored farther than scripted on the first seed and frozen neural explored farther than random on the second. No treatment won all metrics; spatial exploration alone is not survival competence. Neural completed no meals under this checkpoint. Two seeds cannot establish robust superiority.

New neural training trial https://github.com/dylandlr/craftle/actions/runs/40149817784 uses option reward v2, not trained/evaluated yet at this documentation point. The v2 coefficients change extrinsic proxy rewards: hunger recovery +0.5 per point, inventory stack increases +0.3, novel cells +0.15, damage −0.7/point, step −0.03, terminal death penalty unchanged. Original v1 available by default. This is a *reward change*, not more informative food vision or newly discovered skill primitives.

Next gate: complete v2 pilot, inspect real footage and event logs, and compare frozen v1 vs frozen v2 checkpoints alongside scripted and random agents under same option commitment duration and fresh held-out world seeds. Report observed food inventory/hunger recovery and action timing; never compare raw reward totals across the two reward specifications.
