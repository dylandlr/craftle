# DQN resumable training state (v1)

New option DQN snapshots retain the legacy outer `craftle.options.dqn.v1` policy schema while adding `trainingState` (`craftle.dqn.training-state.v1`), including the 512-transition replay ring, target-network weights, and seeded xorshift RNG state. The online network and cumulative update count remain under the original keys, so existing frozen evaluators can still load legacy checkpoints lacking `trainingState`.

A deterministic local regression runs 30 updates, serializes the state, resumes with an unrelated supplied seed, then compares network weights, target network, replay contents, RNG state, chosen options and subsequent update sequence. Corrupt replay payloads are rejected.

**Scope:** This provides deterministic DQN-step continuation after a completed episode when using `seededOptionRandom`. It is **not** full simulation-state resumability. The Mineflayer world, memory of visited cells, in-flight action, pending reward attribution, controller decision serial, and agent's time-dependent observation state are not included. Cross-run episode boundaries should terminate or truncate pending options explicitly; resuming mid-action requires an additional controller-level snapshot contract. GitHub cache retention is not durable storage.

For Voyager comparisons, model inference remains isolated: API credentials, model provenance and token cost must be provided explicitly. `voyager-native` is an external experiment; adapting it into Craftle requires a documented tool/interface port. Nothing in this change runs Voyager or an LLM.
