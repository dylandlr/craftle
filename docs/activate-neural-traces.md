# Activate real-time neural decision tracing safely

## Ground truth
The user confirmed `CRAFTLE_DECISION_TRACE=0` and `CRAFTLE_TARGET_REWARD_VERSION=v1` in the running container. Older `decision_trace_v1` entries are historical. The continuous runner reads the current policy at `/state/agent/continuous-policy.json` and appends to `/state/agent/continuous/agent.log`. Both are bind-mounted from `deploy/filming/state/agent` on the host.

This PR changes the **default value for the next container creation** to `CRAFTLE_DECISION_TRACE=1`, keeping `v1` unchanged. An explicit `CRAFTLE_DECISION_TRACE=0` in your shell or .env can still override that default. It does NOT change an already running process.

## Preflight and backup before any restart

From your Craftle repository root on Windows PowerShell:

```powershell
git fetch origin
git switch -c feat/activate-neural-traces-safely --track origin/feat/activate-neural-traces-safely
node scripts/backup-live-neural-trace.js
docker compose -f deploy/filming/compose.yml --profile learning config | Select-String "CRAFTLE_DECISION_TRACE|CRAFTLE_TARGET_REWARD_VERSION"
```

The backup script refuses to proceed if it cannot find or validate the active continuous checkpoint and log; it writes a new, uniquely named folder in `craftle-backups`, copies the policy and log without removing the originals, and writes hashes plus checkpoint update counts. It does not freeze a live writer, so its log copy is a bounded-time snapshot, not an atomic capture. **Do not proceed if the backup fails.**

If Compose displays 0, clear any shell override with `Remove-Item Env:CRAFTLE_DECISION_TRACE -ErrorAction SilentlyContinue` or explicitly set `$env:CRAFTLE_DECISION_TRACE='1'`, then check again.

Before changing a continuous run, record its container ID, image ID, and volume mapping:

```powershell
docker compose -f deploy/filming/compose.yml --profile learning ps agent
docker compose -f deploy/filming/compose.yml --profile learning config
```

## Controlled agent recreation — deliberate downtime

When ready to interrupt the run, first stop only the agent gracefully so it can save its latest model, then make **another** snapshot of the final stopped checkpoint:

```powershell
docker compose -f deploy/filming/compose.yml --profile learning stop -t 60 agent
node scripts/backup-live-neural-trace.js
docker compose -f deploy/filming/compose.yml --profile learning up -d --no-deps --build --force-recreate agent
```

This preserves the bind-mounted Minecraft world and the learner state path, but **does** end and restart Turesla's current process. Server, follower, and spectator services are not recreated by the command. Do not run until comfortable with a controlled agent interruption. A new process can have separate RNG/session continuity considerations; retain the pre/post checkpoint hashes to audit the restart.

Confirm immediately after:

```powershell
docker compose -f deploy/filming/compose.yml --profile learning exec agent printenv CRAFTLE_DECISION_TRACE
docker compose -f deploy/filming/compose.yml --profile learning exec agent printenv CRAFTLE_TARGET_REWARD_VERSION
docker compose -f deploy/filming/compose.yml --profile learning exec agent sh -lc "grep 'decision_trace_v1' /state/agent/continuous/agent.log | tail -n 1"
```

A historical trace may still be printed by the last command; verify its timestamp is **after the controlled restart**. To see observer analysis, run the separate commentator service and set its verbosity to verbose. Q-values are estimates of return, not probabilities or human-like thoughts.

If the local checkout has uncommitted edits, do not force-switch branches, reset the worktree, or delete untracked files. Use an alternative worktree if needed.
