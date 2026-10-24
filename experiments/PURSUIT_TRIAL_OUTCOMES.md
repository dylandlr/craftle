# Pursuit trial outcomes

Revision a169e10e8b491f5ebfea52ecffd4f8db6956c3ac, run https://github.com/dylandlr/craftle/actions/runs/40116141602 . All three trials completed 180 seconds with zero deaths/runtime errors and zero inventory gains/meals. No-target searches: seed 20261202 56/97; seed 20261203 97/97; seed 20261204 96/96. NoPath counts respectively 1, 2, 0. Controlled animal and plant fixtures passed in run 40116141539. This does not establish improvement over the prior 1/3 natural-world acquisition result; spawn/timing are uncontrolled.

Next revision adds read-only server-event instrumentation for food-animal damage and deaths and self item pickups. Attack requests do not establish hits, deaths do not establish kills by this bot, and unknown source attribution remains unknown. Three new tests verify these distinctions and listener cleanup. Policy unchanged. Live evidence from the new instrumentation remains pending.
