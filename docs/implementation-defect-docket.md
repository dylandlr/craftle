# Craftle engineering defect docket — 2026-11-01

**Baseline:** live continuous Turesla training, reward v1, 44 features, 15 options, checkpoint preserved. Changes listed below are NOT active in the running learner unless separately deployed.

| ID | Severity | Status | Problem | Correctness / acceptance test |
|---|---|---|---|---|
| CRAFTLE-001 | P0 | In progress | `explore` always eligible even if route planner has no executable destination | Optional feasibility gate rejects no-route exploration; preserves safe fallback when all actions are blocked |
| CRAFTLE-002 | P0 | Open | v1 reward treats successful movement and no-route actions alike apart from health/eat | Record action started, goal issued, route result, observed displacement, and separate evidence-aligned reward v3 |
| CRAFTLE-003 | P0 | Open | Selected action need not execute; learning transition assumes a one-step option | Episode transition tied to action execution and elapsed ticks with interruption semantics |
| CRAFTLE-004 | P1 | In progress | Neural decision explanations previously ignored masked eligibility as an explicit input to performance diagnostics | Record eligibility/reason in trace; invariant test for mask and decision |
| CRAFTLE-005 | P1 | Open | Per-target action mask trusts visibility/distance, not planner reachability | Add verified route reachability and bounded cooldown of failed goals |
| CRAFTLE-006 | P1 | Open | Fixed epsilon 0.3 even after hundreds of thousands of SGD updates | Compare frozen epsilon 0 vs decaying schedules on held-out scenarios |
| CRAFTLE-007 | P1 | Open | DQN uses 512 replay items, 4 samples/decision, one hidden layer of 16 | Evaluate learning stability, target drift, catastrophic forgetting, compare buffers/double-DQN |
| CRAFTLE-008 | P1 | Open | Incomplete perception: missing food/terrain options lead to mask dominated by explore/retreat | Instrument detection recall and add recoverable affordances |
| CRAFTLE-009 | P1 | Open | Rewards based on relative health between decisions conflate outside events and actions | Add provenance and server-side outcome corroboration |
| CRAFTLE-010 | P2 | Open | DecisionId restarts per process and adjacent event attribution is ambiguous | Include unique session/run ID in all decision/transition/navigation events |
| CRAFTLE-011 | P2 | Open | Full chat trace exceeds Minecraft human reading rate | Use explicit page/drop telemetry and optional HUD diagnostics; retain source log |
| CRAFTLE-012 | P2 | Open | Spectator overlay still not a native mirrored player health/inventory UI | Fabric spectator-only client UI with independently sourced read-only telemetry |

## Prioritization

1. Capture quantitative baseline using `scripts/audit-neural-decisions.js`; record existing policy and held-out evaluation.
2. Fix action feasibility without falsifying world affordances. Never mask out all actions silently; preserve recovery as explicit fallback.
3. Integrate verified execution and option duration before altering reward shaping.
4. Run independent ablations for mask, epsilon, replay capacity, and v2/v3 rewards. Do not change multiple experimental variables together.

The first patch exposes an *optional* planning-feasibility signal in the observation/mask contract while keeping backward-compatible behavior by default. This must not be turned on until the live planner reports reliable feasibility. It is not equivalent to claiming the environment is impassable.
