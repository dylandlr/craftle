# Craftle spectator UI and opt-in navigation recovery evidence

## Why the recording looked wrong
The previous observer actionbar used an oversized gold string containing XYZ coordinates, reward, update counts and decision IDs; the client truncated it. In-game chat also repeated almost-identical DQN selections. This change gives the spectator a **colored, concise status line plus a spectator-targeted bossbar**, and only sends a human-friendly chat note when something meaningful changes.

- HP: red; food: gold/orange; action/intent: aqua; warnings: yellow; progress: green.
- The HUD and chat are **RCON commands addressed to the spectator username only**, never Turesla. They are not observations consumed by the targeted DQN.
- The bossbar is targeted via `bossbar set craftle:observer players <spectator>`. It is not a global scoreboard, not a packet added to Turesla's sensory input and not a visible block/entity. This is a server UI primitive; verify it actually renders on your chosen client during a spectator attachment.
- Vanilla Minecraft controls text rendering via the client's Chat Settings / GUI Scale. Servers cannot set the spectator's chat font size. Increase chat scale, width and opacity locally for readability.
- The agent still receives Mineflayer semantic world state, not visual frames. We **keep camera pixels out of the DQN**. A future visual-learner experiment must be a separate, documented observation schema and training arm.

## Roll out the spectator-only services (no agent restart)

From Craftle's checkout on this branch:

```powershell
git fetch origin
git switch -c feat/spectator-ui-recovery-integration --track origin/feat/spectator-ui-recovery-integration
node --test test/observer-presentation.test.js
docker compose -f deploy/filming/compose.yml --profile hud --profile commentary up -d --no-deps hud commentary
```

This refreshes just the human-facing spectator services. It does **not** apply the navigation feature to the running agent. Confirm `CRAFTLE_CAMERA_USERNAME=dyl_is_here` (or your actual spectator username) in your environment; never use the agent's username.

### Change commentary live

```powershell
docker compose -f deploy/filming/compose.yml --profile commentary exec commentary node /app/scripts/observer-control.js minimal
docker compose -f deploy/filming/compose.yml --profile commentary exec commentary node /app/scripts/observer-control.js normal
docker compose -f deploy/filming/compose.yml --profile commentary exec commentary node /app/scripts/observer-control.js verbose
docker compose -f deploy/filming/compose.yml --profile commentary exec commentary node /app/scripts/observer-control.js off
docker compose -f deploy/filming/compose.yml --profile commentary logs -f commentary
```

The `verbose` command writes full selected source-event JSON to the commentator's server-console output; the original `/state/agent/continuous/agent.log` JSONL remains the complete canonical diagnostic record regardless of UI verbosity.

## Navigation impossibility in the live world

`CRAFTLE_NAVIGATION_RECOVERY_LEARNING=1` is **off by default**. When set and when the agent container is deliberately rebuilt/restarted, the existing `recoverTrap` route chooser additionally records:
- `navigation_impossibility_observed` when the current search produces no usable route.
- `navigation_recovery_attempt` when a selected real trap-recovery path is issued.
- `navigation_recovery_outcome` when subsequent observations reveal whether the selected destination got closer or whether pathfinding is active.
- `navigation_recovery_goal_tabling_recommended` if the recovery attempt budget is exhausted.

The system **does not yet integrate this outcome into the DQN replay or automatically table an active executive objective**. This is a grounded real-world instrumented bridge that preserves the old agent's movement policy. For a true three-system live learner, we still need a versioned OptionEpisode result schema and carefully staged active policy activation. Do not rebuild/restart live Turesla or enable this flag until its active checkpoint has been frozen and the control experiment is preserved.

## Caveats

The current 'tick' in targeted-survival.js is a controller-step counter, **not** an authoritative Minecraft server tick. Thus recovery duration measures observation steps only; it must not be treated as server-time credit until we have a server tick correlation. Route availability based on current pathfinder movement is suggestive, not a verified completed route. Recovery outcome remains temporal association, not proof of causation. Server RCON spectator messages remain invisible to the agent through the declared DQN observation; the server log may still include RCON diagnostics.
