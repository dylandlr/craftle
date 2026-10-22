# Non-LLM online-learning experiment (first baseline)

Set `CRAFTLE_AGENT_IDS=agent_001` and `CRAFTLE_BEHAVIOR=visual_online_rl`. This opt-in mode consumes rendered first-person RGB24 observations and an intrinsic reward from self-displacement, visual novelty and health changes. It receives no LLM requests, walkthroughs, Minecraft recipes, or privileged block queries.

The first version is **tabular Q-learning on coarse RGB features**, not deep reinforcement learning. Its four quadrant brightness features yield at most 256 distinguishable states, which will alias many completely different scenes. Novelty is based on the same coarse representation. It cannot be expected to defeat Minecraft as implemented. Its role is a genuinely learning, reproducible low-capability baseline against random actions, scripted control and future DQN/PPO agents.

Hyperparameters: `CRAFTLE_RL_EPSILON` (default 0.3); `CRAFTLE_RL_CHECKPOINT` (default `recordings/rl/agent-q.json`); `CRAFTLE_RECORD_FRAMES` (default 1200). Saved state survives process restarts if the checkpoint is retained. For a fresh-seed baseline use a new checkpoint path; to measure transfer explicitly reuse one and label the treatment as continued learning.

Reward contract: `0.5 * clipped self-displacement + 0.2 * first-visit-to-visual-state - 0.5 * lost health - 0.02`. This deliberately risks incentivizing pointless movement; it is an intrinsic-exploration proxy, **not** progress to the Ender Dragon. The algorithm observes the next RGB image and updates the preceding (state, action) value. Log rows `rl_action` and `rl_transition` include frame IDs, rewards, and displacement.

Next scientific steps: validate live Minecraft state transitions in CI; benchmark against random action selection using identical seeds; instrument survival/inventory milestones; replace visual quantization with a learned encoder and conduct DQN/PPO comparisons. Do not call this a trained CNN or claim successful survival, discovery or Minecraft completion without empirical evidence.
