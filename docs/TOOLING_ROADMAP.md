# Craftle acceleration plan (2026-10-21)

Goal: retain Craftle's eight-agent experimental design while reusing existing, maintained Minecraft tooling.

## Current priority: Mineflayer body and Voyager reference architecture (2026-10-23)

Use both upstream projects as primary implementation references. The immediate milestone remains a recorded, measured scripted survival loop; then introduce learned decisions through the same capability interface. The phases below are the earlier roadmap, not evidence that those capabilities have all been implemented.

| Reference | Reuse or adapt | Keep explicit |
| --- | --- | --- |
| [Mineflayer](https://github.com/PrismarineJS/mineflayer) | Bot lifecycle, primitive controls, inventory interactions, world events, and plugin interfaces. | Craftle already declares Mineflayer `^4.35.0` and Pathfinder `^2.4.5`; declared ranges are not exact installed versions. |
| [Voyager](https://github.com/MineDojo/Voyager) | Environment bridge, structured observation/event batches, execution feedback, persistent skill library, and curriculum/verification interfaces. | Its published decision system uses an LLM. A no-LLM Craftle agent needs learned or explicitly scripted replacements for those decisions. |

### Source inspection and reproducible reuse

Reviewed upstream branch heads: Mineflayer `7b4bb8d2b56be9cdb832474af873acd37e609746`; Voyager `55e45a880755d0c8c66ca7fb5fe7962ac8974f89`. These are reference snapshots, not tested Craftle dependency pins. Before implementation, read the relevant files at the recorded commit and retain any required license notices for copied code.

- Mineflayer [API](https://github.com/PrismarineJS/mineflayer/blob/7b4bb8d2b56be9cdb832474af873acd37e609746/docs/api.md) and [package metadata](https://github.com/PrismarineJS/mineflayer/blob/7b4bb8d2b56be9cdb832474af873acd37e609746/package.json).
- Voyager [Mineflayer bridge](https://github.com/MineDojo/Voyager/blob/55e45a880755d0c8c66ca7fb5fe7962ac8974f89/voyager/env/mineflayer/index.js), [observation batching](https://github.com/MineDojo/Voyager/blob/55e45a880755d0c8c66ca7fb5fe7962ac8974f89/voyager/env/mineflayer/lib/observation/base.js), [control primitives](https://github.com/MineDojo/Voyager/tree/55e45a880755d0c8c66ca7fb5fe7962ac8974f89/voyager/control_primitives), and [skill manager](https://github.com/MineDojo/Voyager/blob/55e45a880755d0c8c66ca7fb5fe7962ac8974f89/voyager/agents/skill.py).

Clone either repository into a separate reference checkout when local inspection, comparison, or adaptation requires it. Record its commit and the files adapted; do not merge either repository wholesale into Craftle. No clone or upstream runtime installation was needed for this documentation review.

Compatibility needs a dedicated check: the reviewed Mineflayer package requires Node >=22, while Voyager's README documents testing with Minecraft/Fabric 1.19 and its bridge declares older dependency ranges. Do not treat a Voyager checkout as a drop-in replacement for the current Craftle server or dependencies.

### Capability and knowledge boundary

Expose bounded, parameterized actions with completion/error events: move, look, attack, dig, place, equip, consume, inventory/crafting interaction, and chat. Treat pathfinding, collectblock, combat plugins, and recipe-resolving helpers as assisted capabilities whose built-in knowledge must be recorded. In particular, Voyager's `mineBlock(name)` searches block data and delegates collection; it is not a raw motor action.

Keep two action tiers where needed: primitive controls for control/skill discovery, and assisted actions for higher-level decision experiments. Compare policies within the same observation/action tier and report privileged block/entity/recipe access.

Every future skill record should identify its origin (`SCRIPTED`, `IMPORTED`, `IMITATED`, or `SELF_LEARNED`), dependencies, observation/action tier, training evidence, and held-out validation. Record the original provenance of demonstrations used for imitation. Voyager's supplied skill libraries and LLM-generated task knowledge belong only in explicitly labeled reference/teacher treatments. The from-scratch no-LLM treatment starts without those skills or pretrained Minecraft knowledge. Mineflayer mechanics and assisted plugins remain declared scaffolding.

Adapt Voyager's curriculum and critic *interfaces* to measurable goals, learning progress, and environment-side outcome checks. A learned curriculum, skill discovery system, and verifier are future work; referring to Voyager does not implement them.

### Next baseline acceptance gate

Record synchronized POV, actions, elapsed time, health/hunger, inventory deltas, spatial coverage, deaths/respawns, and stalled/failed actions. Review complete recordings alongside telemetry and evaluate on separate world seeds.

Current `src/survival-reference.js` navigates, retreats from detected threats, and consumes available inventory food. Its `forage` label currently selects exploration waypoints; it does not obtain food. Gathering, crafting, and combat must be implemented and verified before describing this reference as a complete autonomous survival loop.

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
- Voyager: https://github.com/MineDojo/Voyager
- Prismarine Viewer: https://github.com/PrismarineJS/prismarine-viewer
- Pathfinder: https://github.com/PrismarineJS/mineflayer-pathfinder
- Mindcraft: https://github.com/mindcraft-bots/mindcraft
- MineStudio: https://github.com/CraftJarvis/MineStudio
- Odyssey: https://github.com/zju-vipa/odyssey
- MineDojo: https://github.com/MineDojo/MineDojo
- Docker server: https://github.com/itzg/docker-minecraft-server
