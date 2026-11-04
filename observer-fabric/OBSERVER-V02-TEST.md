# Craftle observer v0.2 (isolated test plan)

The `feat/fabric-authoritative-server-observer` branch includes an **experimental** observer writer update. It has **not** yet been compiled or performance-tested in this chat. Do not copy the new JAR into the production vanilla Craftle server.

## Changes

* The main Minecraft thread enqueues JSONL events into a bounded queue (capacity 8192); a dedicated writer thread writes and flushes records. Queue overflow logs `EVENT LOSS` to server stderr rather than silently blocking Minecraft ticks.
* End-of-tick inventory comparisons now include `player_inventory_slot_changed` events with `detail.slot`, before/after item IDs, counts and component strings, while retaining legacy `player_inventory_changed` events.
* These are **observed tick-boundary deltas**, not proof of which action caused a change. An item gained and lost in the same tick might not be observed.
* In-memory queue data can be lost if the process terminates abnormally. This is a performance experiment; it is not yet a guaranteed no-loss audit log. Verify restart and shutdown behavior.

## Manual acceptance on the isolated test server only

From the repository root, after fetching the branch:

```powershell
cd observer-fabric
gradle build --console=plain
```

If build succeeds, back up the isolated test observer JAR before replacing it. Do **not** remove Fabric API or SpectatorPlus:

```powershell
cd test-server
docker compose cp minecraft-test:/data/mods/craftle-server-observer-0.1.0.jar "$env:TEMP\craftle-server-observer-v01.jar"
docker compose cp ..\build\libs\craftle-server-observer-0.1.0.jar minecraft-test:/data/mods/craftle-server-observer-0.1.0.jar
docker compose restart minecraft-test
docker compose logs --tail=100 minecraft-test
```

Connect a disposable survival test player, give items, change stack counts, and die once. Verify:

```powershell
docker compose exec -T minecraft-test sh -c "tail -n 100 /data/craftle-observer/server-events.jsonl" |
  Select-String "player_inventory_slot_changed|player_death_state_observed"
docker compose logs --since=10m minecraft-test |
  Select-String "EVENT LOSS|writer failure|ERROR|Exception|Done"
```

Check `serverRunId`, monotonic `tickIndex` per run, JSON parseability, before/after slot consistency, and expected event counts. For throughput, compare a no-observer baseline to v0.1 and v0.2 under equivalent isolated worlds and workload. Report max tick latency and queue overflow, not just average TPS.

Rollback if the updated mod fails:

```powershell
docker compose cp "$env:TEMP\craftle-server-observer-v01.jar" minecraft-test:/data/mods/craftle-server-observer-0.1.0.jar
docker compose restart minecraft-test
```

Record the outcome before deploying any additional audit mods. Existing spectator HUD has been visually confirmed working with the separate Fabric client on the isolated test world.
