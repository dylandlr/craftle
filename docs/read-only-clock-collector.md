# Opt-in Minecraft gametime sampling

This observer service does not alter the learner or Minecraft world. It connects to the existing Minecraft RCON endpoint and sends only `time query gametime`, recording timestamp-bracketed samples in `deploy/filming/state/observer/server-clock.jsonl`.

```powershell
git fetch origin
git switch -c feat/read-only-server-clock-collector --track origin/feat/read-only-server-clock-collector
node --test test/minecraft-clock-rcon.test.js test/server-tick-clock.test.js
docker compose -f deploy/filming/compose.yml --profile clock up -d --no-deps clock
docker compose -f deploy/filming/compose.yml --profile clock logs -f clock
Get-Content .\deploy\filming\state\observer\server-clock.jsonl -Tail 5
```

The service is opt-in via profile `clock`, uses a distinct read-only code mount and observer output directory; it neither recreates the agent nor connects its telemetry to the DQN. If your existing Minecraft service is not healthy, start it separately; do not reset volumes.

Each sample records request and completion wall timestamps plus returned `gameTime`, `worldId`, epoch and asynchronous-query uncertainty. Due to RCON latency, these do not prove the precise Minecraft tick of any action. The next milestone is replaying recorded game events with clock brackets and explicit timestamp uncertainty.

The collector code has not yet been tested against the user's live RCON server.
