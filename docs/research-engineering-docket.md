# Craftle research engineering docket

## Accepted architecture direction (2026-10-30)

- Keep **Java** for unmodified vanilla Minecraft simulation.
- Keep **TypeScript/Node + Mineflayer** for world interaction, physics actions, observations, and filming.
- Introduce **Python/PyTorch** for model training, CUDA, tensor workloads, and evaluation. Start separately, with explicit versioned observation/action/transition transport.
- Retain and freeze the current handwritten JavaScript DQN/checkpoint as baseline. Any conversion requires parity tests.
- Benchmark small-to-large networks, model types, latency, GPU memory and learning outcomes. A dedicated GPU-enabled trainer container is a target, not current production functionality.
- Maintain the same physical controls between Instinct experiments; vary supplied knowledge independently.
- Keep camera/spectator and chunk diagnostics separate from learner feedback.
- Defer **Craftle Research View** design and implementation until experiment collection and comparisons are reliable.

## Work order

1. **Checkpoint safety**: verify live baseline frozen with SHA-256 manifest, never write treatment outputs to baseline files.
2. **Versioned schemas**: observation, action, reward and transition contract, explicit capability/instinct provenance.
3. **Isolated experiment runner**: separate world and state roots; hard reject reusing active filming roots; reproducible seeds and budgets; preflight before launch.
4. **Automatic capture**: immutable per-run manifest, outcome report, model hashes, logs and recorded footage.
5. **Matched comparisons**: duration-normalized metrics, repeated seeds, confidence intervals, matched-condition checks.
6. **Python model backend**: test CPU/GPU capability, network-size sweeps, PyTorch DQN with parity tests, then PPO/recurrent/world-model treatments.
7. **Learned motor control / curiosity / Instincts**: controlled ablations including food and water traversal.
8. **Filming reliability**: parallel infrastructure gate for chunk visibility and observer integrity.
9. **Research View**: only after reliable run registry, data provenance and comparisons.

## Status and integrity notes

PRs #9–#16 include separate, not necessarily merged work. Some are feature branches targeting main while PR #12 targets #11. Do not assume all changes are integrated by switching branches. Initial experiment planner and registry scripts are prototypes; they do not yet launch isolated Minecraft worlds or deliver valid causal comparisons. Turesla must never be reconfigured or restarted by a research runner without explicit operator action.
