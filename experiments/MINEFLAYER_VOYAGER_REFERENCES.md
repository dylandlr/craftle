# Craftle architectural references: Mineflayer and Voyager

Canonical upstream repositories:
- https://github.com/PrismarineJS/mineflayer (Minecraft bot API; MIT)
- https://github.com/MineDojo/Voyager (LLM-based lifelong embodied Minecraft agent; MIT)

## Adopt, adapt, or avoid

| Upstream | Mechanism | Craftle treatment |
|---|---|---|
| Mineflayer | Embodiment, physics-backed actions, chat, inventory, crafting and world events | **Adopt** as actuator and instrumented environment interface |
| Mineflayer plugins | Pathfinder, item collection, food handling and combat | **Adopt selectively** for privileged scripted survival reference; expose bounded primitives for learner |
| Voyager | Executable skill library with retrieval and reuse | **Adapt** into learned option policies, trajectories and validated action macros, with provenance and outcome metrics |
| Voyager | Automatic curriculum / task proposal | **Adapt** into non-LLM novelty, learning-progress and competence-driven task selection |
| Voyager | Iterative execution and environment feedback | **Adapt** into real transitions, terminal/death signals, replay and learned world dynamics |
| Voyager | LLM prompts, GPT-generated code and pretrained knowledge | **Exclude from no-LLM treatment**; retain only as separately labeled LLM reference |

## Experimental firewall
- Do not copy Voyager's existing Minecraft task recipes or seed a no-LLM agent with the contents of its pretrained skill library: that would compromise discovery claims.
- Mineflayer scripted reference may use privileged game state; vision-only learner cannot. Label sensing differences and report both matched-sensor and privileged-control baselines.
- Mineflayer API modules are mechanics and actions, not evidence of learned intelligence.
- Before vendoring or cloning code, inspect licenses, versions, security, dependency compatibility and the minimum necessary subset. Prefer pinned dependencies or isolated source-reference checkout over copying entire codebases.
- Preserve v1 original Q-learning/reward configuration and all long-run evidence; v2 and reference treatment require own version identifiers and held-out seeds.

## Near-term implementation order
1. Make scripted survival reference pass end-to-end Minecraft CI and obtain real full POV video + action trace.
2. Define one versioned Mineflayer action and observation contract for scripted, random, RL and future social agents.
3. Compare scripted reference with learner on independent survival/spatial-coverage metrics. Do not compare unlike reward scales.
4. Add RL-discoverable option skills: an option is an initiation model, learned intra-option policy, termination condition and evidence of success. Avoid hard-coded survival scripts in learned policy.
5. Implement experience replay/consolidation with REAL vs REPLAY_OF_REAL vs IMAGINED provenance, allowing journal/nap/meditate as costly learned meta-actions.
6. Expand to multi-agent cooperation, communication, technological discovery and institutions after one autonomous agent has measurable competence.

## Verification caveat
These upstream repositories are references. No claim is made here that Voyager or its skill library has been installed, cloned or integrated into the live Craftle runtime.
