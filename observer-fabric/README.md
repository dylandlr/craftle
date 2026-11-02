# Craftle server observer — experimental Fabric 1.21.1 prototype

**NOT deployed or compiled in CI yet.** Separate, opt-in server-side mod in `observer-fabric/`. Existing filming server is `TYPE: VANILLA`; this branch deliberately does NOT change it, its volumes or Turesla's checkpoint.

## Build on an isolated machine
Requires JDK 21 and Gradle (or create a wrapper in this new module); first validate exact Yarn 1.21.1 mappings and Fabric API compatibility.

```powershell
cd observer-fabric
gradle build
```

Produced mod should be under `observer-fabric/build/libs/` if successful. Build has NOT been performed in the connected environment. Test JS correlation in repo root: `node --test test/server-observer-correlation.test.js`.

Uses Fabric 1.21.1 Fabric API 0.116.9+1.21.1 and Yarn mappings 1.21.1+build.3. Confirm dependency resolution and compilation before experimenting with the server.

## Experimental deployment
1. Copy the existing `deploy/filming/state/server` folder **while Minecraft is stopped**, to a separate backup; store checksums. Never delete or reset volumes. Also preserve the model checkpoint and full telemetry.
2. Create a **separate** Fabric 1.21.1 test-world service, not the running filming service. Set `TYPE=FABRIC`, install matching Fabric API and the built mod in the test instance, use separate server data/ports. Minecraft Java 1.21.1 and Java 21 should match.
3. Validate vanilla-parity behavior, join/respawn, no unwanted world mutation, no effect on camera/spawning/learning. Do not switch the running experiment to Fabric without an explicit controlled comparative experiment.
4. Capture JSONL from server working directory `craftle-observer/server-events.jsonl`. Each event has `serverRunId`, monotonically increasing `tickIndex` within that server process, overworld gameTime, wall time, player UUID, dimension and relevant state snapshots.
5. Review overhead. Current prototype fingerprints all player inventories every server tick and flushes event lines synchronously; profiling and bounded/asynchronous IO are required before lengthy production runs.

## What this actually measures
- Server-authoritative **observation tick**, not exact action execution/impact time for changes detected by polling.
- Player position every 20 ticks when changed; health/hunger/inventory fingerprint changes as observed by tick polling.
- Inventory fingerprint is not a lossless inventory delta or proof of acquiring food, and hash collisions are possible.
- A death-state observation may be missed if death and respawn occur between polling phases. Native event hooks should be added for robust exact death and damage attribution.
- No option-to-server tick handshake exists yet. Client neural decision timestamps must not be assigned exact server ticks.
- `server-observer-correlation.js` only labels identity/timing associations; even a matching handshake won't prove causality. Never use this alone as verified reward.

## Next required engineering gates
- Compile the mod, run Minecraft 1.21.1 Fabric integration smoke test, and verify JSONL schema.
- Implement an acknowledged, authenticated, run/option-ID protocol whose processing tick is recorded by the server. Distinguish action intent, server acknowledgment, actual observable effect.
- Add native server event hooks for verified damage/death and inventory changes with provenance.
- Load-test no impact on simulation tick rate and validate exact event ordering. Keep RCON gametime as a secondary cross-check.
