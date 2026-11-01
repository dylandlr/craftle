# Observer explanations — verbose mode

This adds a **why/why-not** layer above the spectator presentation. The commentator joins observed target decisions, route failures, stalls and transitions into human-readable messages. Verbose explanations also go to the commentary container's console as `observer_explanation`, even when spectator chat suppresses repeated messages.

It explains **which actions were available, what the DQN selected, what the route planners found, and whether execution made progress**. It explicitly avoids inventing the DQN's internal thought process or claiming a route never exists in the world.

## Run on the observer (does not restart the agent)

```powershell
git fetch origin
git switch -c feat/observer-decision-explainability --track origin/feat/observer-decision-explainability
node --test test/observer-explainability.test.js

docker compose -f deploy/filming/compose.yml --profile commentary up -d --no-deps commentary
docker compose -f deploy/filming/compose.yml --profile commentary exec commentary node /app/scripts/observer-control.js verbose
docker compose -f deploy/filming/compose.yml --profile commentary logs -f commentary
```

For exact neural scores, `CRAFTLE_DECISION_TRACE=1` is separately required when the **agent** starts; enabling observer verbose alone cannot reconstruct past Q-values or omitted policy traces. Do not restart a protected continuous experiment just to enable decision trace. The observer should clearly state when this information is missing.

This is a server/chat observer explanation feature, **not** the native Fabric synchronized hotbar requested separately. Human-facing output is never an agent observation.
