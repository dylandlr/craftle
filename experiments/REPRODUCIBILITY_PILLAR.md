# Craftle Research Pillar 4: Reproducibility and Independent Evaluation

Four complementary pillars:
1. Emergent skill acquisition.
2. Independent learning without pretrained LLM knowledge.
3. Memory, replay and agent-selected consolidation.
4. **Reproducibility, causal controls and falsifiable evidence.**

## Experiment registration contract
Each trial should record: git SHA, exact source/config versions, observation/action contract, reward version, policy name, world seed and policy RNG seed, checkpoint hash, model update count, option commitment and interruption rules, duration, environment/server version, initial spawn, video timestamps, footage hash, log hash, metric hash, software dependency lockfile, and environmental changes (fixtures, teleportation, time/weather adjustments). The v1 manifest tool already emits a conservative subset; missing data must remain visible, not invented.

## Control families
- Privileged Mineflayer survival reference: survival competence ceiling with richer sensors and scripted skills.
- Matched structured-observation scripted-option controller: matched assisted-option interface.
- Matched random controller: chance baseline.
- Frozen neural policy: learning results without further updates.
- Training neural policy: ongoing adaptation.
- Future vision-only control: lower-information condition, not directly interchangeable with privileged controls.
- Future no-replay vs replay/dreaming agent: controlled consolidation ablation.

Never compare rewards from different specifications directly. Use external task-grounded measures: deaths, meals with observed hunger recovery, survival time, inventory/production, unique horizontal cells, failed paths, useful skills, progression and effect of changes after repeated hazards. Every treatment needs complete uninterrupted video or documented frame/timestamp gaps; video playback speed must correspond to capture time.

## Trial design
Pre-register hypothesis and minimum worthwhile effect, training/evaluation seed split, action/time/computation budget, stopping rules, independent repeated runs, and analysis procedure. Keep fixed original baselines and separately version every reward/action/observation change. Historical development/evaluation seeds are not truly untouched confirmation seeds anymore.

Compare same start, seed, game rules, time, difficulty, observation/action contract and option duration when making matched treatment claims. When random gameplay dynamics diverge, record that and use replicated independent world samples. Provide paired differences and uncertainty intervals, not just the winning treatment. Include negative results and failed/invalidated runs.

## Provenance implementation
`scripts/experiment-manifest.js` emits schema `craftle.experiment.v1` and hashes evidence. `.github/workflows/option-controls.yml` attempts to archive it alongside each trial. The manifest does not claim exact deterministic replay: checkpoints currently omit full replay buffer and random state. A genuine exact-resumption benchmark would require preserving PRNG state, environment snapshot, replay contents and synchronized observations.

## Next gate
1. Verify current neural pilot succeeds with the fixed POV encoder.
2. Validate manifest generation and video integrity on actual control jobs.
3. Add replicated held-out train/eval seeds and common independent scoring.
4. Only then promote selected reward/policy settings to longer trials.
