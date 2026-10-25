# Deterministic outcome attribution v1

Implementation: `src/outcome-ledger.js`, connected to the Mineflayer survival controller.

Every observed event is emitted with monotonic sequence, life, active option ID, stage and evidence type. Close attribution intervals on switches/death/respawn/shutdown. Treat deduplicated event patterns as recorded evidence, never causal certainty.

- `attack_issued` / `plant_interaction_issued`: **attempt only**.
- `target_damaged`: direct bot source is stronger evidence than unknown source; source must come from real Mineflayer event.
- `target_death_observed`: death is observed but kill source is unknown.
- `item_pickup_observed`: observed pickup by this bot, source of item unknown.
- `food_consumed_observed`: verified hunger recovery only if afterFood > beforeFood.
- `navigation_result`: pathfinder result, not task completion.

**Scope:** This is deterministic evidence attribution to the *currently active option interval*, not causal proof of which earlier attack caused a later death or item. The current implementation is event-level, not a full entity-drop-inventory causal graph; Minecraft packets do not always provide causality. Unknowns remain unknown rather than made up.

**Training caution:** The current option DQN still derives reward from consecutive health/hunger/inventory/spatial observations, not this evidence ledger. Do NOT claim reward attribution has been switched to the ledger until that wiring is implemented and tested. This layer makes observations and offline analysis auditable first.

**Next gates:**
1. Verify unit CI and real Minecraft smoke instrumentation emits `deterministic_outcome` events.
2. Assign actual policy-decision IDs rather than only option-interval IDs, and make failed/timeout events explicit.
3. Build per-entity candidate chains while representing unknown-source transitions, inventory delta corroboration and network latency.
4. Introduce outcome-certified sparse reward v3 behind a feature flag and compare with unchanged v1/v2.
