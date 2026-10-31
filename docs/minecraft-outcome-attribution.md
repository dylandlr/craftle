# Minecraft outcome attribution — isolated observation ledger

This is an **offline read-only** comparator. It does not listen to the live bot, modify the world, train Turesla, or alter any checkpoint.

Capture an observation *before* a high-level action and another *after* it. Each observation has a monotonic server-tick or otherwise consistently measured tick, position, health, food, per-item inventory counts, and optionally observed block names keyed by coordinates. The ledger records decision ID, elapsed ticks, changed blocks where both before and after were observed, inventory deltas, movement, health and food changes.

## Integrity limits
- Observed differences are **not proof of causation**. External drops, auto-eat, other agents, despawns, and unrelated events can account for changes. Therefore measured changes default to `unknown`, not `verified_success`.
- A successful `bot.dig` Promise is not enough to verify harvesting or inventory gain; validation requires corroborating source events and action-to-target matching in the next milestone.
- Missing blocks in the after-observation are **not** interpreted as air or destruction. Both before and after block observations must be present.
- `timed_out` / `interrupted` are truncations. Explicit environment termination (death) is a terminal failure.
- The `tick` field must be produced by one consistent time source; `setInterval` invocations are not Minecraft server ticks.
- The evidence record here is not yet System B's `{kind,name,action,evidenceSource}` interface; an explicit provenance-aware bridge is required before writing knowledge. It can feed the three-system outcome loop only after converting captured Minecraft observations into the targeted 44-feature input schema.
- Never attribute passive plugin auto-eat to a learned agent action.

## Next milestone
Implement a Mineflayer-side, disabled-by-default observer that correlates `decisionId`, action start/end, candidate target IDs, source events, and server tick/time timestamps. Include failure modes for overlapping events, stale block observations, auto-eat, death/respawn, and disconnect. Run on an isolated copy of the vanilla world before activating any changes to the live learner.
