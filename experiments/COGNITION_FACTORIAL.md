# Craftle factorial cognition treatments v1

Each condition uses the **same underlying vision-capable LLM, prompt baseline, tool executor, decision budget, world seed and first-person camera**, differing only in the enabled intervention flags.

| Agent | Foveal crop | Self-motion visit grid | Hypothesis recall |
| --- | --- | --- | --- |
| agent_001 | off | off | off |
| agent_002 | on | off | off |
| agent_003 | off | on | off |
| agent_004 | on | on | off |
| agent_005 | off | off | on |
| agent_006 | on | off | on |
| agent_007 | off | on | on |
| agent_008 | on | on | on |
| agent_009 | off | off | off (baseline replicate) |

The visual factor appends a center crop of the **same real first-person RGB frame** as a second image; it does not use privileged targeting. The map factor summarizes eight-block visitation cells using only the agent's own position, **not terrain blocks or pathfinding knowledge**. The knowledge factor stores the model's own **unverified hypotheses and lessons**, never verified Minecraft facts.

**Design caveat:** this is a modular prompt/memory ablation, not a learned cognitive map, actual triple-based knowledge graph, or foveated high-resolution renderer. Claim those only after they have been implemented and verified. Token/image budgets can differ with enabled factors and must be reported.

Execute **one agent per fresh, isolated world**. For example, use `CRAFTLE_AGENT_IDS=agent_004 CRAFTLE_BEHAVIOR=llm_agent`, with identical model, server seed, and decision limits. Never test the entire factorial group in a shared world when making causal effect claims. The ninth run independently replicates baseline; stochastic repetitions still need multiple seeds.

TAMU VPN-gated runs remain deferred until authorized connectivity is available. Existing deterministic mock LLM tests prove integration only, not cognition or survival success.
