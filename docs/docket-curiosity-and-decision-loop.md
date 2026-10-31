# Docket addendum: Curiosity and budget integration

- The decision-budget guard has passed two local unit tests, but is not yet connected to the Minecraft agent.
- Integrate at the targeted-survival policy decision boundary rather than counting simulation ticks or navigation retries.
- On budget exhaustion, stop future policy decisions; finalize transitions, checkpoints, logs and run status. Validate resume behavior in an isolated server.
- The original Turesla learning run must remain unaffected.
- Resume curiosity research from PR #9: concept encounter tracking exists, but the agent does not yet select or learn from experiments autonomously.
- Next curiosity milestone: maintain observation-grounded action/outcome evidence with repeat counts and confidence, without inserting Minecraft recipes or external semantic knowledge.
- Defer curiosity policy/reward changes until isolated paired trials and no-contamination audits are working.
