# Craftle acceleration plan (2026-10-21)

Goal: retain Craftle's eight-agent experimental design while reusing existing, maintained Minecraft tooling.

## Phase A: make the repository runnable
- Copy the complete v0.9 source package onto this branch, not just workflow files.
- Pin tested Minecraft protocol/version and Node dependencies, commit lockfile.
- Run `npm test`, `npm run plan`, and a manually dispatched server smoke test. Never call a telemetry MP4 gameplay footage.

## Phase B: real visual capture (highest priority)
- Evaluate [prismarine-viewer](https://github.com/PrismarineJS/prismarine-viewer): its upstream README explicitly links first-person, record-as-video, and stream-to-Python examples.
- Create a dedicated viewport for each agent; capture actual rendered first-person frames with frame timestamps, agent_id, camera pose, seed and game tick.
- Encode separate agent POV videos and one spectator montage using FFmpeg. Overlay the event and decision timeline in postprocessing rather than faking screenshots from logs.
- Acceptance: at least 8 simultaneously connected agents; a verified nonempty video for each; time alignment with actual server ticks; no simulated visuals mislabeled as captured video.

## Phase C: behavior and action toolkit
- Continue Mineflayer core + mineflayer-pathfinder; test mineflayer-collectblock, mineflayer-auto-eat and mineflayer-pvp as isolated optional plugins.
- Evaluate [Mindcraft](https://github.com/mindcraft-bots/mindcraft) agent profiles, prompts, and multi-agent coordination patterns. Do not wholesale merge or allow generated shell code in unsandboxed CI.
- Evaluate [Odyssey](https://github.com/zju-vipa/odyssey) composable skill taxonomy as inspiration and possible baseline.

## Phase D: training and benchmarks
- Evaluate [MineStudio](https://github.com/CraftJarvis/MineStudio), which publishes dataset structures, benchmark suites, a simulator, pretrained VPT policy models, and a POV RecordCallback.
- Bridge MineStudio data to Craftle through versioned trajectory schemas (tick, frame pointer, observation masks, action, reward, training checkpoint).
- Keep MineStudio simulator experiments distinct from native Java multiplayer trials until action/observation adapters are validated. Its dependencies include older Java and specialized rendering setup.
- [MineDojo](https://github.com/MineDojo/MineDojo) wiki data may bootstrap the *preloaded* knowledge graph; learned-graph agents must not receive that information.
- Baselines: scripted, pretrained zero-shot (without Minecraft task fine-tuning), SFT, RL, and nonparametric reusable-skills policy. Match evaluation seeds and action budgets.

## CI and operations
- Pull requests: unit tests, plan invariants, artifact-schema validation, recording fixture.
- Manual: disposable Minecraft server + real POV capture smoke test; collect full diagnostics after failure.
- Nightly only after smoke reliability: 8-agent multi-seed short-run matrix and small retention-limited video highlights.
- GPU fine-tuning on separately provisioned runners, triggered from workflow_dispatch; GitHub Actions tracks provenance and artifact IDs.
- Pin third-party actions and Docker image digests after compatibility validation. Restrict workflow token permissions, sandbox generated code, never disclose secrets in artifacts.

## References
- Mineflayer: https://github.com/PrismarineJS/mineflayer
- Prismarine Viewer: https://github.com/PrismarineJS/prismarine-viewer
- Pathfinder: https://github.com/PrismarineJS/mineflayer-pathfinder
- Mindcraft: https://github.com/mindcraft-bots/mindcraft
- MineStudio: https://github.com/CraftJarvis/MineStudio
- Odyssey: https://github.com/zju-vipa/odyssey
- MineDojo: https://github.com/MineDojo/MineDojo
- Docker server: https://github.com/itzg/docker-minecraft-server
