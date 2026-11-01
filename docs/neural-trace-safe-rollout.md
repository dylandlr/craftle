# Neural-first explainability — safe trace rollout

The running Turesla container was confirmed with `CRAFTLE_DECISION_TRACE=0` and `CRAFTLE_TARGET_REWARD_VERSION=v1`. Existing `decision_trace_v1` log rows came from older sessions. Do not assume older Q-values explain current behavior.

This PR connects any **new** decision traces to the observer console as `observer_neural_decision`, with an explanation of masked options, Q-values, greedy selection vs epsilon exploration, and forced-choice scenarios. Observer chat remains spectator-only. No model reward or checkpoint changes.

## Read-only preflight on the existing live agent

```powershell
git fetch origin
git switch -c feat/neural-trace-safe-rollout --track origin/feat/neural-trace-safe-rollout
node --test test/observer-neural-traces.test.js

docker compose -f deploy/filming/compose.yml --profile learning exec agent node /app/scripts/neural-trace-preflight.js
```

The Docker image may not have the newly committed preflight script until rebuilt; **do not rebuild the agent merely for this check**. As a fallback:

```powershell
docker compose -f deploy/filming/compose.yml --profile learning exec agent printenv CRAFTLE_DECISION_TRACE
docker compose -f deploy/filming/compose.yml --profile learning exec agent printenv CRAFTLE_TARGET_REWARD_VERSION
docker compose -f deploy/filming/compose.yml --profile learning exec agent sh -lc "ls -lah /state/agent/continuous"
```

The explanatory commentator can be recreated independently:

```powershell
docker compose -f deploy/filming/compose.yml --profile commentary up -d --no-deps commentary
docker compose -f deploy/filming/compose.yml --profile commentary exec commentary node /app/scripts/observer-control.js verbose
docker compose -f deploy/filming/compose.yml --profile commentary logs -f commentary
```

## Enabling actual new traces (planned controlled restart)

A running process cannot gain `CRAFTLE_DECISION_TRACE=1` from an observer-only change. Before an intentional restart, audit the actual checkpoint paths from agent startup logs / session scripts; copy the checkpoint and metadata with integrity hashes, preserve log and Docker volumes, and record the image/commit, world seed, and training configuration. Then set `CRAFTLE_DECISION_TRACE=1` and deliberately recreate only the agent service, verifying checkpoint resume and new trace generation. **This PR does not perform that restart or enable it by default**. Changing the compose default globally without preserving run identity would obscure the experimental baseline.

Use `docker compose ... config` to confirm planned effective variables before any recreation. Trace logs can be large and may affect throughput and storage.
