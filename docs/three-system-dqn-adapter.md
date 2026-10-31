# Three-system DQN adapter (offline integration milestone)

This adapter connects the three-system offline loop to Craftle's actual `createOptionDQN` implementation with the targeted **44-input, 15-action** schema. It does not modify production Turesla or read/write checkpoints.

- System C owns an objective and keeps it active while an action episode is unresolved.
- System A selects a legal masked action, and learns **once** at episode settlement.
- System B receives independent, observation-grounded affordance evidence through the coordinator.
- Minecraft time is converted to legacy DQN decision quanta: `steps = max(1, ceil(elapsedTicks/36))` (36 ticks = 1.8 seconds at 20 TPS). The legacy DQN uses `gamma=0.95` per decision quantum; 36 is a modeling assumption to evaluate, not a measurement of actual elapsed policy opportunities.
- A timeout or interruption is treated as a **truncation**, not an environment terminal, and therefore bootstraps from the next observation. True episode termination must be explicitly labeled via `evidence.episodeTerminal === true`; the caller must provide a terminal-aware outcome.
- A valid 44-feature observation and action mask is required at each selection and nonterminal settlement.
- For now the policy still inherits semantic observations and scripted skill controls; this does not make it a model-free pixel learner.
- No automatic changing of epsilon, reward model, Instinct, curiosity, or Turesla's current checkpoint.

## Remaining before real Minecraft experiments

1. Build a dedicated Mineflayer **outcome adapter** that produces before/after observations, actual action durations, verified result evidence, and terminal flags.
2. Fix the offline coordinator's settlement atomicity: unexpected learner errors must not leave the executive portfolio or transition journal inconsistent.
3. Test recovery/checkpointing across process death and resumed experiments.
4. Run randomized and paired-seed tests comparing legacy fixed-interval DQN to episode-based DQN.
5. Preserve exact reward semantics and event provenance; never count action timing alone as verified success.

Run `node --test test/three-system-dqn-adapter.test.js` from the repository root.
