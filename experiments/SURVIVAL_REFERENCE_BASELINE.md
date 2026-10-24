# Scripted Mineflayer reference: live baseline

The reference is a privileged, hand-scripted controller. It is not evidence of emergent or learned survival.

## First successful recorded trial

- Code: `d98db5d4cc68b5c017585bba0098de5017751a9f`.
- [Run 40077861559](https://github.com/dylandlr/craftle/actions/runs/40077861559), Minecraft Paper 1.21.1, survival mode, normal difficulty, seed 20261201.
- 90.018 seconds observed; 48 controller actions; zero deaths and zero reported runtime errors.
- 18 unique horizontal 4-block cells; sampled horizontal path length about 394.7 blocks. Path length includes revisits.
- No inventory stacks. All 48 decisions were labeled `forage`, which currently chooses exploration waypoints, not food collection.
- 555 saved rendered first-person frames span 88.262 seconds. Timestamp-based MP4 is 88.4 seconds; maximum frame gap is 1.703 seconds. Capture is sampled and begins after initialization, so it is not continuous full-frame-rate client video.
- Artifacts include MP4, original JPEG frames and timestamps, action/pose logs, server logs, summary JSON, video timing JSON, and a contact sheet.
- Unit suite at this commit: 63 tests passed.

The original smoke attempt (run 40029186158) never reached Minecraft: a CommonJS named-export import failed. Loading Pathfinder through its default export fixed that failure.

## Interpretation

This establishes a functioning navigation/recording/instrumentation pipeline on one seed for a short period. It does not establish hunger management, food acquisition, combat, crafting, or reliable long-term survival. No deaths occurred, so the live run does not validate death/respawn behavior.

A nine-frame contact sheet spanning the trial was inspected. It shows coastal forest terrain and changes in view. This sampled inspection is not a review of every video frame.

## Follow-up corrections

The next revision preserves a navigation goal until arrival, path failure, sustained lack of progress, or timeout; pauses actions while dead; and invalidates pending asynchronous commands across life boundaries. Regression tests exercise the lifecycle with delayed consumption. Inventory snapshots are now included in action telemetry, and the report counts stationary action intervals.

Those changes require their own CI/live run results before performance claims. Do not interpret comparisons between these short runs as causal evidence: action selection and world timing are not controlled replicates.

## Next competence gate

1. Obtain and consume food through real world interactions; verify inventory deltas and hunger recovery.
2. Add bounded material gathering and basic crafting to the scripted reference.
3. Validate death/respawn in a controlled fixture and retain all event history.
4. Compare multiple fresh seeds and a longer day/night window with the same external metrics and complete sampled POV.
5. Give non-LLM policies the same declared observation/action contract; keep assisted actions and scripted/imported knowledge labeled.

[Mineflayer and Voyager reference boundaries](MINEFLAYER_VOYAGER_REFERENCES.md) remain in force.
