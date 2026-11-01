# Neural decision audit

Read-only diagnostics of the latest neural decisions. No checkpoint, model, environment, or reward changes.

Run from repository root:

```powershell
node scripts/audit-neural-decisions.js deploy/filming/state/agent/continuous/agent.log 200 > neural-audit.json
```

The log may be multiple GB; the script streams instead of loading the entire file into memory, but runtime is proportional to log length. It prints counts of greedy, epsilon, forced, starving and no-target decisions, and the latest eligible Q-values with nearby navigation/reward events. No identifiable private data is sent anywhere.

Interpretation caveats: agent decision IDs reset on restarts; the associated navigation events may be context not causal proof. `target_transition` is logged for the **previous** pending action and matches by ID within the current segment. The script reports which transitions were found, not claims of successful outcomes.

Concrete source-code findings:

* `src/target-opportunities.js`: explore always eligible, retreat eligible iff nearest hostile distance is under 24, eat only with actual food inventory.
* `src/targeted-controller.js`: v1 reward = verified eat credit + negative health change times 0.7 - 0.03; no explicit route, displacement, or progress term; duration hardcoded to steps=1.
* `src/option-dqn.js`: epsilon defaults to 0.3, gamma=0.95, 512 replay transitions, four minibatch-style sampled SGD updates per new observation, target weights updated every 100 updates.

Recommendations, **not yet changes**: add executable feasibility to action masking; record option duration and verified action outcome; study reward attribution and exploration schedule with controlled comparisons. Preserve current v1 and checkpoint for baseline.
