# Failed engine goal cancellation

Run 40117992135 completed all three natural trials without deaths/runtime errors. Seed 20261202 acquired food and recorded one meal with measured hunger recovery; seeds 20261203/20261204 acquired none. Seed 20261203 reported 98 noPath events in 98 food searches. This is not reliable multi-seed survival.

Source inspection found that the noPath handler cleared controller goal state but left the underlying Pathfinder goal active. The fix explicitly cancels the engine goal and ignores repeated stale noPath events after controller cancellation. A regression test verifies one cancellation and one failure record for duplicate notifications, then fresh navigation on the next step. Fresh live validation remains required; no acquisition-rate improvement is claimed yet.
