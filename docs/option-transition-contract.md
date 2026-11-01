# Option transition contract (offline prototype)

This PR extends the pure SMDP target reference with a self-contained option transition builder.

- Explicit run ID and option ID, start/end *authoritative server tick* supplied by caller.
- Sparse tick-indexed reward observations with evidence provenance.
- Exact discounted reward accumulation across elapsed ticks (zero where no event).
- Environment terminal vs option interruption semantics.
- Masks are validated; empty successor mask refuses bootstrap and requires an executive recovery contract.
- Finishing produces immutable-semantics transition data with duration, reward, bootstrap and target.

**Not yet connected to live Turesla.** In particular, Mineflayer controller iterations are not verified authoritative server ticks. No consumer should invent server ticks from wall time. An integration needs a server observer or explicitly labeled clock estimate.

Run `node --test test/smdp-target.test.js test/option-transition.test.js`.

Future hardening: cap per-option duration to avoid excessive arrays, enforce run-tick monotonicity across options, make failed finish validation side-effect-free, and compute reward components with source event identifiers. Current reward events may record observed associations rather than causal success. Preserve v1 checkpoints and use new experiment IDs before v3 runtime rollout.
