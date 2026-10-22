# Craftle MVP toolchain and rollout

**Authoritative environment:** Minecraft Java + Mineflayer bot interface, one fresh world per trial.
**First-person vision:** Prismarine Viewer headless JPEG-over-TCP -> decoded RGB24 -> validated observation -> policy. No block-state inputs in learned policies.
**Learning stack:** PyTorch for a small image encoder and behavioral-cloning baseline; evaluate policy on held-out paired world seeds. PPO and reward shaping only after replay and inference are reliable.
**Trajectory tooling:** Export exact RGB frame / action demonstrations as versioned manifest + .rgb blobs; adapt to MineStudio trajectory/training interfaces only after verifying its compatibility with our Minecraft/version and frame/action schemas. A brightness heuristic produces diagnostic examples, not expert demonstrations.
**Research resources:** MineDojo tasks/knowledge for curriculum inspiration; Voyager-inspired learned skill library later, after simple navigation; VPT/STEVE-1 as comparative visual baselines after one visual agent works.
**Reproducibility:** GitHub Actions smoke tests, per-action logs, frame hashes, dataset checks, held-out paired-seed evaluation, success/survival/displacement metrics.
**Separate privileged control:** Scripted intelligent controller operates on Mineflayer block data only in isolated control trials, with privileged-input status labeled.
**Deferred:** Multiple simultaneous agents, foveated vision, cognitive maps, knowledge graphs, social training and multi-agent RL.

Current integration caveat: the first-person RGB probe is *live and tested*, but its brightness policy is not trained. Dataset export stores probe-generated actions for pipeline verification; these must not be mislabeled as expert behavior or used as a supervised ground-truth optimal policy.
