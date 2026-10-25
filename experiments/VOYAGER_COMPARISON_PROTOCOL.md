# Craftle comparative benchmark v0.1 — non-LLM vs LLM vs Voyager

## Scientific hypothesis
Randomly initialized RL agents can gain transferable Minecraft competence from environmental interaction, without imported Minecraft knowledge. Voyager is an external pretrained LLM baseline, NOT an equivalent no-prior-knowledge treatment.

## Treatments
- random (matched sensors, action contracts)
- scripted Mineflayer (same sensors and actions when feasible; privileged oracle separate)
- broad DQN 7/4 (frozen and online training)
- targeted DQN 44/15 (frozen and online training)
- Craftle first-person multimodal LLM baseline (existing llm_agent)
- Voyager native (external replication only)
- Voyager adapted (after explicit port and capability/sensor audit)

## Experimental families
**Family A, native replication:** Run upstream Voyager on its documented Fabric/1.19-compatible environment with supported dependencies, original API provisioning and recorded model version. Report as external reference, not in same matched leaderboard.

**Family B, matched interface:** All policies run on the same Minecraft server binary, seeds, game rules, spawn/inventory/health, wall-clock or tick budget, available sensor fields, target candidate access and action primitive inventory. Ported Voyager must use explicit audited sensor and tool adapters; report port diffs.

**Family C, asymmetric capabilities:** Measure maximum obtainable proficiency with each treatment's natural stack. Report resource/cost budgets rather than treating as fair isolated-architecture evaluation.

## Evidence contract
Version the following before collecting data: code commit and dependency hashes, image/server implementation/build/mod list, API/LLM model snapshot, agent-specific context window and pretraining disclosures, RGB/structured/privileged observation contract, action contract, reward contract, allowed external tools, starting world, spawn, inventory, server tick settings, real-time/tick budgets, random seeds, previous skill-memory imports, GPU/CPU resources and API token budgets.

**Prohibit contamination:** no pretrained Voyager skill-library import into non-LLM runs, no LLM-generated trajectories used to claim independent discovery, no reference agent memory shared across treatment groups. Native Voyager's original knowledge is labeled 'pretrained-language-prior'.

**Measurements:** independently verified hunger recovery, acquired food, unique items, crafted items, deaths, task success, novel reusable skills validated on held-out worlds, wall/tick duration, action attempts, execution faults, number of steps, data seen, LLM token/API cost and checkpoint growth. Preserve every agent's full POV, agent event stream, server snapshots, experimental manifest, checkpoint hashes, action→event evidence and failures.

## Compatibility gate for Voyager
As of review, upstream documents Python>=3.9, Node>=16.13, Fabric mods, GPT-4 and a tested Fabric 1.19 setup. Craftle currently uses Paper/vanilla 1.21.1; merely connecting upstream Voyager to this version is *not* guaranteed to work. Keep upstream version/environment immutable for native replication; adapted port uses isolated code and separate validation. Acquire explicit API credentials outside git and bound token/cost budget. Do not run paid inference by default.

## Research milestones and priorities
P0: Complete the queued pinned 208-update held-out DQN evaluation; freeze checkpoint and document independent outcomes. 
P0: Train targeted RL with action-level attribution to actual server observations. Establish at least one verified target→acquire→consume chain.
P0: Make complete replay/target-net/RNG training-state checkpoints and durable immutable artifact registry.
P1: Add held-out 5+ seeds x repeated trials and predeclare primary success criteria.
P1: Run mocked/zero-cost LLM integration test in existing Craftle tool contract; real cost-gated LLM benchmark with credentials.
P1: Reproduce native Voyager under documented compatible Minecraft with explicit model/skill-library provenance.
P2: Port/adapt Voyager to matched sensor/action contracts, log deviations from upstream.
P2: Introduce learned skill policies, learned initiation/termination, world model, episodic/procedural memory and learning-progress curriculum. Compare these modules by ablation.
P3: Novel crafting tasks, technology progression, generalization across Paper→vanilla→Create (Create is a modded condition, not vanilla), multiagent cognition and social learning.

## Stop/gate conditions
Fail an experiment on invalid server identity, partial sensors without disclosure, unauthorized external hints, incompatible model checkpoint, unobserved source of reward, missing video evidence or excess API spending. A task failure is a valid negative behavioral result, not infrastructure failure.

Claims of emergence require unseen-world skill composition beyond supplied scripted policy, replicated across seeds with uncertainty estimates. One successful episode is not sufficient.
