# Plant foraging and first natural-world meal

Runtime code: 27b9633c3ea3b65f1ef96306a21d0e5bf58ce1c0. All 79 unit tests pass. Scripted privileged Mineflayer reference; no learned-policy competence claim.

## Implementation
- Scan loaded blocks within 24 blocks for ripe sweet berries, mature carrots/potatoes, or melons. Preserve immature crops. Activate berry bushes rather than destroying them.
- Pursue edible drops before plant or animal targets. Retain bounded attempts/cooldowns.
- Search less-visited horizontal cells when no target is available. Search destinations use GoalXZ; precise known food targets retain GoalNear at their actual height.
- Count no-target searches, path failures, harvest actions, meals and measured hunger recoveries independently. Harvest command completion alone is not proof of inventory gain.

## Live evidence
[Latest fixture matrix](https://github.com/dylandlr/craftle/actions/runs/40111516661): natural smoke, animal food fixture, and plant fixture all passed.
The latest plant fixture harvested carrots and ripe berries, recorded three meals and three measured hunger recoveries, zero deaths and zero runtime errors. An earlier successful revision recorded four carrot meals from food meter 18 to 20. Potatoes and melons have unit coverage but no separate live fixture yet.
[Latest plant footage and logs](https://github.com/dylandlr/craftle/actions/runs/40111516661/artifacts/12566388031).

[Natural pilot](https://github.com/dylandlr/craftle/actions/runs/40111516668):

| Seed | Duration (s) | Spatial cells | Path failures | Inventory stacks max | Meals / measured recoveries | Deaths / runtime errors |
| --- | --- | --- | --- | --- | --- | --- |
| 20261202 | 180.003 | 96 | 0 | 2 | 1 / 1 | 0 / 0 |
| 20261203 | 180.023 | 86 | 0 | 0 | 0 / 0 | 0 / 0 |
| 20261204 | Completed; no inventory gain or meals | — | — | 0 | 0 / 0 | 0 / 0 |

In seed 20261202, the bot approached cows/sheep, acquired mutton, and ate it at 16:29:45.932Z on 2026-10-24. Its food meter rose from 18 to 20. No food, animals, terrain or hunger were supplied in that natural trial. [Recorded POV and evidence](https://github.com/dylandlr/craftle/actions/runs/40111516668/artifacts/12567135489).

The previous diagnostic run using fixed-height search goals had 72 path failures and four visited cells on seed 20261202. These runs have uncontrolled spawn positions and timing; this is descriptive debugging evidence, not a controlled causal estimate of improvement.

## Limits and next gate
- First natural meal is established; reliable multi-seed or day/night survival is not.
- Seed 20261203 detected potential food targets but did not acquire items within the trial. Investigate pursuit, reach and attack outcomes next.
- Fixture teleportation contaminates movement-distance metrics. Use fixtures to test interactions, not exploration ability.
- Contact sheets spanning successful plant and natural-meal footage were inspected. Full frame-by-frame review has not been performed.
- Do not promote another long learning run until the scripted baseline and independent evaluation criteria are adequate.

## Pursuit revision

The completed preceding pilot acquired/consumed food on one of three natural seeds. In revision a169e10e8b491f5ebfea52ecffd4f8db6956c3ac, the scripted controller retains its chosen animal while still prioritizing edible drops/plants, avoids resetting an unchanged pursuit goal, and requires line of sight before melee attacks. All 81 local tests and the new unit CI pass. The regression tests exercise nearest-animal order changes and an occluded nearby target.

[New three-seed pilot](https://github.com/dylandlr/craftle/actions/runs/40116141602) and [live interaction fixtures](https://github.com/dylandlr/craftle/actions/runs/40116141539) were in progress at this update. No improvement in acquisition rate is claimed yet.
