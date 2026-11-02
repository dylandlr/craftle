# SpectatorPlus isolation trial (Minecraft 1.21.1)

**Scope:** The running persistent/filming Craftle server stays VANILLA and is not touched. This test belongs to the independent Fabric test server, currently exposed on localhost:25585. Do not point a spectator client at the production world as part of these tests. Do not copy test mod files into production mounts.

## Compatibility decision

Official SpectatorPlus Fabric version `fabric-1.2.1+mc1.21` declares **Minecraft 1.21**, not 1.21.1. The newer `fabric-1.2.2+mc1.21.3` declares 1.21.2 and 1.21.3. Neither release metadata alone proves compatibility with 1.21.1. https://modrinth.com/plugin/spectatorplus/version/pruX55yu

SpectatorPlus displays additional target HUD info only if installed **server-side**, because Minecraft does not normally send spectators the target hunger, XP, and hotbar contents. Install the matching mod on the **spectator client too** to test target HUD rendering. A Mineflayer target need not itself have the client mod to share server-authoritative hunger/hotbar data; screen mirroring of a client-only inventory is a distinct limitation. The documented inventory-open-key feature is Paper-only; do not promise that GUI mirroring works on Fabric. https://modrinth.com/plugin/spectatorplus

A mod listing 1.21 but not 1.21.1 must remain an opt-in compatibility experiment, not a production dependency. Avoid bundling source from GPL-3.0-or-later SpectatorPlus into Craftle without a legal licensing review. Study its behavior and public API/documentation for interoperability instead.

## Probe and test procedure

Run in PowerShell at the repository root:

```powershell
cd observer-fabric
.\test-spectatorplus.ps1
```

This inventories `minecraft-test` JARs and queries Modrinth v2 for explicitly compatible versions; it installs nothing by default. Metadata and SHA512 are checked before any install.

If an explicit Minecraft **1.21.1 Fabric** release is available:

```powershell
.\test-spectatorplus.ps1 -Install -RestartTestServer
```

If no explicit compatible release exists, **do not install by default**. On a disposable test server, opt into a potential incompatibility only with:

```powershell
.\test-spectatorplus.ps1 -Install -AllowUnlistedGameVersion -RestartTestServer
```

Check `docker compose -f test-server/compose.yml logs --tail=100 minecraft-test` for loader dependency problems. If the loader rejects the mod, rollback immediately rather than adding unrelated mods to compensate. Keep the observer and Fabric API JARs intact. Inspect the `dependencies` printed by the probe; fetch and verify any required Fabric dependency individually before re-test.

Rollback:

```powershell
.\test-spectatorplus.ps1 -Remove -RestartTestServer
```

**Spectator client:** use a completely separate Minecraft launcher profile with **Minecraft 1.21.1, Fabric Loader, Fabric API**, and the exact selected SpectatorPlus version. This repository script does not modify the Windows client. Do not install it in your normal gameplay/filming profile before it passes the test. Connect the test client to `localhost:25585`.

## Acceptance tests

1. Start isolated server; log confirms observer and SpectatorPlus loaded and no dependency/handshake crashes.
2. Connect *two disposable users*, a normal survival player and a spectator. `/gamemode spectator <observer>` via the server console/admin test command. Spectate the survival player.
3. Confirm target health, hotbar, selected item, hunger and XP displayed; do not confuse observer inventory with target inventory.
4. Give target items, damage, food, and XP; verify HUD updates and read the corresponding server JSONL events (inventory-hash-only until observer v0.2).
5. Test chest/crafting-table UI separately; explicitly record unsupported behaviors. Mineflayer does not present a regular player client GUI.
6. Check Fabric test server TPS/wallTime and `server_tick_heartbeat` before/after adding HUD; inspect logs for warnings.
7. Capture versions, JAR hash, configuration, screenshots and results. Never change production server, Turesla, checkpoints or spectator player.

Next: implement buffered JSONL output and detailed inventory slot deltas as a separate observer revision; measure with and without any optional audit or HUD mod.
