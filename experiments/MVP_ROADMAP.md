# Craftle scope: one-agent MVP (v1)

## Core objective
Build **one autonomous intelligent Minecraft agent** that acts from the same first-person visual observations a human player would see. The agent must implement observe → updateBeliefs → selectGoal → plan → act → reflect. The rendered first-person camera must feed the agent policy, not merely generate a video.

## MVP treatments
1. **agent_001: learned first-person agent**. Standard vision (foveatedVision=false, cognitiveMap=false, knowledgeGraph=false). Initial policy can be small CNN + recurrent state or a vision encoder + MLP; learning/training must be demonstrated, not claimed.
2. **scripted_block_control**. Goal-directed, stateful scripted intelligent agent, allowed to inspect Mineflayer block state. It is a *separate control with privileged observations*; it is not a fair test of visual architecture in isolation.

Run one agent at a time in a *fresh isolated world* per trial. Use identical world-seed sets, Minecraft build, game mode, time limit, starting inventory, difficulty, deterministic spawn policy and recorded world settings. Match spawn and record mob/weather variations; paired seeds do not make stochastic worlds identical. Never overwrite previously completed trials.

## MVP implementation order
- [x] Shared observe/updateBeliefs/selectGoal/plan/act/reflect interface (contract only).
- [x] Scripted reference goal selection and live Mineflayer integration (await live behavioral validation).
- [x] Define and unit-test an RGB-only observation contract, plus offline MP4-to-RGB decoding for recorded footage.
- [x] Add experimental live Prismarine Viewer JPEG-over-TCP to RGB observation streaming and an opt-in RGB-only brightness-policy action probe (await live CI validation).
- [ ] Validate the live renderer-to-policy-to-Minecraft loop in a real one-agent run with true arrival timestamps; replace heuristic probe with a trained policy and capture end-to-end evidence.
- [x] Add an RGB-only policy boundary and a validated discrete action schema (policy-to-Minecraft adapter; live frame input pending).
- [ ] Extend allowed proprioception (inventory, own motion) and synchronize with real captured frames.
- [x] Add initial PyTorch RGB CNN behavioral-cloning training script and checkpoint export (not yet CI/live evaluated).
- [ ] Implement live checkpoint loading and inference with the Minecraft visual action interface.
- [ ] Add repeatable training and held-out paired-seed evaluation against separately run scripted control.
- [ ] Inspect footage, decisions, displacement, survival, task completion and policy ablations.

## Acceptance criteria
- One complete first-person agent run driven by policy inference on RGB observations (not direct block queries).
- Audit logs proving which sensory fields the policy consumed, its decisions, the associated frame, action and reward.
- Paired held-out trials of the learned agent and scripted control in separate fresh worlds, multiple seeds/repetitions, summarized with per-seed differences.
- Metrics and failures reported even if learned policy performs worse.

## Stretch goals (after MVP)
- Additional six factorial configurations plus baseline replication, keeping the existing eight-way design.
- Foveated vision, cognitive mapping and knowledge graph ablations; factorial interactions.
- Nine simultaneous agents in one shared world, cooperation/competition and temporally aligned 3×3 replay.
- Expanded survival, crafting, communication, social intelligence and multi-agent learning.

The nine-agent shared-world recorder is **existing research infrastructure**, not an MVP prerequisite. The earlier camera sweeps / block-query navigation are diagnostics, **not** examples of learned first-person visual intelligence.
