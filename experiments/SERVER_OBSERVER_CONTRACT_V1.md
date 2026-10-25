# Craftle server-authoritative experiment observer v1 (design contract)

## Why ordinary Minecraft logs are insufficient
Vanilla `logs/latest.log` logs operational events but not a complete per-action record of all block harvests, item pickups, food consumption, inventory changes and causality. Docker log timestamps date console messages; RCON polls capture the state at polling time, **not the original event time**.

## Required read-only server event source
Implement an experiment-only observer for Paper 1.21.1 first (Bukkit/Paper APIs): BlockBreakEvent, BlockDropItemEvent, PlayerHarvestBlockEvent, EntityPickupItemEvent, PlayerItemConsumeEvent, FoodLevelChangeEvent, and preferably inventory slot changes. A parallel Fabric observer is necessary to measure genuine vanilla-implementation transfer; do not call Paper a modded Create server or identical to Mojang vanilla.

Each event record:
- schema, experimentId, serverBootId, eventSequence, world/dimension, player UUID;
- wallClockUnixMs from **server JVM clock**; monotonicNanoTime relative to serverBootId;
- serverTick (monotonic application tick counter), server implementation/build/version;
- event type, block coordinates/blockstate, item registry ID and count, item entity UUID where applicable;
- before/after food or inventory state *when obtainable and semantically valid*;
- event status (pre-action, completed, cancelled), event type provenance, and raw packet/server event ordering.

Never claim event timestamps are exact physics execution moments: handler invocation time is an observation point; don't infer sub-tick causality from ns clock precision. Timestamp wall-clock and tick independently. Store server events append-only JSONL, with flush and final SHA256, in GitHub artifact.

## Agent/server correlation
Record independent command-issued and command-finished telemetry with agent decisionId and agent monotonic clock, not assigned a server event ID retroactively. Match based on actor UUID, target block coordinates, item entity identity, window/tick range and unique candidate. Mark none or multiple as unassociated/ambiguous. Never merge on wall time alone; allow clock offset/calibration uncertainty.

## Acquisition experiment
1. Prove agent initial inventory empty from server snapshot **after spawn**.
2. Start with visible mature carrots and berries, no food given, and track all subsequent resource gains.
3. Run frozen neural, random, scripted, auto-eat modes, each on a fresh identical seeded environment.
4. Record first acquisition, independent server pickups, consumption and final hunger; keep plugin auto-eat completions separate from hunger recovery.
5. Only credit resource-acquisition RL rewards from verified observations after establishing a validated association contract. Until then, keep reward observation-only.
6. Repeat across seeds and held-out worlds; prepared arena alone cannot demonstrate generalization.

## Avoid false evidence
- Vanilla world is not Paper, and neither supports Forge/NeoForge Create mods by default.
- Paper events can be cancelled and pre-state callbacks may precede mutation; verify completed outcomes via post-tick state.
- Food level can change from exhaustion/damage or commands, not just eating.
- Timestamp precision does not imply timestamp accuracy.
- RCON `time query gametime` is sampled at command execution, not the historical tick of an action.
