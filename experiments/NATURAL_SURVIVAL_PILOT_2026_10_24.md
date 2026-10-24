# Natural survival pilot, 2026-10-24

Code: 958a283eb93cb043cae8a3ad924fbbe6ffe03e99.
Run: https://github.com/dylandlr/craftle/actions/runs/40110155216

Changes: scripted food reserve target of eight hunger points; 20-second food-target attempt deadline; 30-second cooldown after failed paths or expired attempts; reset target memory between lives. Unit suite: 73 passed. Controlled food-loop regression also passed in run 40110155168.

| Seed | Seconds | Actions | Deaths | Unique 4-block horizontal cells | Max inventory stacks | Runtime errors |
| --- | --- | --- | --- | --- | --- | --- |
| 20261202 | 180.006 | 94 | 0 | 55 | 0 | 0 |
| 20261203 | 180.038 | 88 | 0 | 31 | 0 | 0 |
| 20261204 | 180.264 | 95 | 0 | 67 | 0 | 0 |

These are three-minute, single-replicate trials, not day/night survival tests. No items were collected in any natural trial. The functioning controlled hunt-and-eat loop has not translated into reliable natural food acquisition. Coverage is descriptive; no comparison establishes a causal improvement from these code changes.

Videos contain timestamped sampled rendered POV, with frames, action logs and server diagnostics. Contact sheets spanning each trial were inspected; no claim of frame-by-frame review is made.

Next competence gate: distinguish target absence from inaccessible targets in telemetry; add food-source search and plant-food interactions; verify food acquisition on untouched natural seeds before prolonged training or claims of autonomous survival. Scripted reference knowledge remains separate from learned-agent treatments.
