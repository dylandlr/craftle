# Craftle spectator chunk recovery (Fabric 1.21.1)

This optional **client-only** mod addresses the filming spectator's terrain-render stalls without changing the vanilla Minecraft server, server gamerules, Mineflayer, or Turesla's training run.

## State of implementation

- Client-only Fabric entrypoint, no server-side installation.
- Samples once a second while **spectating another entity**, not while playing normally.
- Heuristic: the current camera chunk must be received by the client **and** `WorldRenderer.isTerrainRenderComplete()` must stay false for 12 seconds.
- Camera moving more than one chunk between samples or changing dimension resets the detector.
- At most 3 attempts per persistent incident, with 45 seconds cooldown.
- Logs suspected stalls and renderer state to `latest.log`.
- **Automatic renderer reload is disabled by default.** Pass `-Dcraftle.chunkRecovery.auto=true` as a Java JVM argument after diagnostic validation.
- Calling `WorldRenderer.reload()` is intended to match the terrain-renderer reload effect of F3+A; this is not keyboard simulation and does not change loaded server chunks.

**Limitation:** `isTerrainRenderComplete()` is a render-queue signal, not proof chunks are visibly missing; and a missing chunk whose data never reached the client will not trigger this heuristic. The detection needs in-game validation before default enabling.

## Build

Requires Java 21, Gradle and Minecraft 1.21.1. This PR does not include a Gradle wrapper binary, and no jar has been built or verified here.

From `client-mod/chunk-recovery` run `gradle build` with a compatible Gradle version (or generate a wrapper using your installed Gradle, then `.\\gradlew.bat build`). The output should be under `build/libs/`.

## Installation

Install Fabric Loader for **Minecraft Java 1.21.1** in a *separate filming spectator client installation*, and install a matching Fabric API 1.21.1 jar. Put the **built remapped mod jar** in that client's `mods` folder. Do not install on the server or Turesla's agent container.

First record a session with default monitoring only and review `latest.log` for `CraftleChunkRecovery`. If logs show the persistent renderer stall coincides with the visible terrain hole, enable `-Dcraftle.chunkRecovery.auto=true` as a Minecraft **JVM argument** in that client's launcher profile. Don't set it as a server property or a Docker environment variable.

If the reload fires at inappropriate times, disable the JVM flag and capture a log and F3 screenshot. Never turn on `spectatorsGenerateChunks` as part of these installation steps.

## Verification goals (not yet completed)

1. Build and launch on Minecraft/Fabric 1.21.1, without mapping errors.
2. Confirm no reload in survival mode, when not following an entity, on world changes or ordinary transient chunk loads.
3. Correlate logged suspect/backlog with actual missing terrain seen in the spectator.
4. Verify reloading repairs the terrain without changing the server spawn/tick/chunk-loading state.
5. Confirm no interference with Turesla's policy inputs, world state or checkpoint.
