# Bounded option commitment

The learned controller can now keep executing an option for a bounded number of observation intervals. This addresses premature cancellation of scripted forage/navigation primitives. It is a foundation for temporally extended learned behavior; it does not demonstrate emergent skills.

Set `CRAFTLE_OPTION_COMMITMENT_STEPS=4` for a nominal 7.2 seconds at the current 1.8-second interval. Async primitive execution can extend wall time. The default remains 1 to preserve previous controls. The neural pilot enables 4.

Commitment ends at its horizon, blocked observations, a change in nearby-threat presence, an invalid action mask, or observed eating success. These conditions release the policy to choose again; they do not force a survival action. Death clears commitment and trains exactly once.

Rewards accrue from successive real observations with discount 0.95 per interval. DQN bootstraps with 0.95 raised to the number of intervals. Death adds a discounted terminal penalty; shutdown drops the time-truncated pending option as before. Choice logs include commitment length and continuation/boundary logs expose execution.

The original seven structured privileged inputs and four assisted options remain unchanged. Checkpoint weight shape stays compatible, but training dynamics differ. Do not compare four-step treatment runs with one-step controls as matched evidence; future comparisons must match horizon and interruption rules as well as spawn, observations and duration.

Mineflayer remains the actuator interface. Voyager remains a reference for separating reusable skills from high-level choice; this implementation does not use its LLM-generated skills or claim discovered skills.

Validation: 101 local tests pass, including discounted reward accumulation, duration-dependent bootstrap, interruption, checkpoint freezing, and death continuity. Live four-step training is configured in the neural pilot; its outcome must be inspected separately before claiming a behavioral improvement.
