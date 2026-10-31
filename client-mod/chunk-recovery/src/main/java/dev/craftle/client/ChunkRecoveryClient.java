package dev.craftle.client;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.util.math.ChunkPos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Client-only. Doesn't alter server gamerules, server chunks, AI observation, or Mineflayer.
 * Deliberately conservative: unknown/unreceived chunks are NOT used as proof of render desync.
 */
public final class ChunkRecoveryClient implements ClientModInitializer {
    private static final Logger LOG = LoggerFactory.getLogger("CraftleChunkRecovery");
    private static final RecoveryGate GATE = new RecoveryGate(12_000, 45_000);
    private static final boolean AUTO = Boolean.getBoolean("craftle.chunkRecovery.auto");
    private static long lastSample = 0;
    private static int previousX = Integer.MIN_VALUE, previousZ = Integer.MIN_VALUE;
    private static String previousWorld = "";

    @Override public void onInitializeClient() {
        LOG.info("Craftle chunk recovery installed: auto={} (disabled by default)", AUTO);
        ClientTickEvents.END_CLIENT_TICK.register(ChunkRecoveryClient::tick);
    }

    private static void tick(MinecraftClient client) {
        if (client.world == null || client.player == null || client.getCameraEntity() == null) {
            GATE.reset(); previousX = Integer.MIN_VALUE; previousWorld = ""; return;
        }
        long now = System.currentTimeMillis();
        if (now - lastSample < 1000) return;
        lastSample = now;
        // Spectator only; never alter gameplay or agent client.
        if (!client.player.isSpectator() || client.getCameraEntity() == client.player) {
            GATE.reset(); return;
        }
        ChunkPos cameraChunk = client.getCameraEntity().getChunkPos();
        String world = client.world.getRegistryKey().getValue().toString();
        if (!world.equals(previousWorld) || Math.abs(cameraChunk.x - previousX) > 1
                || Math.abs(cameraChunk.z - previousZ) > 1) {
            previousWorld = world; previousX = cameraChunk.x; previousZ = cameraChunk.z;
            GATE.reset(); return;
        }
        // World chunk data loaded locally + renderer persistently incomplete is a
        // conservative *suspect* signal, NOT proof the current view is visually missing.
        boolean received = client.world.getChunkManager().isChunkLoaded(cameraChunk.x, cameraChunk.z);
        boolean renderComplete = client.worldRenderer.isTerrainRenderComplete();
        boolean suspect = received && !renderComplete;
        if (suspect) LOG.debug("spectator terrain suspect x={} z={} received={} renderComplete={}",
                cameraChunk.x, cameraChunk.z, received, renderComplete);
        if (GATE.sample(now, suspect)) {
            LOG.warn("persistent spectator terrain backlog: cameraChunk={}, auto={}, debugChunks={}",
                    cameraChunk, AUTO, client.worldRenderer.getChunksDebugString());
            if (AUTO) {
                // Same client renderer reload primitive used by F3+A; no keyboard automation.
                client.worldRenderer.reload();
                LOG.warn("client-side terrain renderer reloaded");
            }
        }
    }
}
