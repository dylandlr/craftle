package org.craftle.camera;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.option.Perspective;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Camera-only local telemetry subscriber for the expendable Craftle filming server.
 * No packets or commands are sent to Minecraft or Turesla.
 */
public final class CraftleCameraDirector implements ClientModInitializer {
    private static final Logger LOG = LoggerFactory.getLogger("CraftleCameraDirector");
    private static final URI ENDPOINT = URI.create("http://127.0.0.1:3011/api/density");
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(1))
            .build();
    private static final AtomicBoolean IN_FLIGHT = new AtomicBoolean(false);
    private static final double DENSE_ENTER = 0.52;
    private static final double DENSE_EXIT = 0.32;
    private KeyBinding toggle;
    private boolean enabled = true;
    private boolean dense = false;
    private long tick = 0;
    private long lastDataAt = 0;

    @Override
    public void onInitializeClient() {
        toggle = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.craftle.camera.toggle",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_F8,
                "category.craftle.camera"
        ));
        ClientTickEvents.END_CLIENT_TICK.register(this::onTick);
        CraftleResearchHud.install();
        LOG.info("Craftle camera director installed; F8 toggles automatic perspective");
    }

    static boolean filmingServer(MinecraftClient client) {
        if (client.world == null || client.player == null) return false;
        var info = client.getCurrentServerEntry();
        if (info == null || info.address == null) return false;
        String address = info.address.toLowerCase(java.util.Locale.ROOT).trim();
        return address.equals("127.0.0.1:25575") || address.equals("localhost:25575");
    }

    private void onTick(MinecraftClient client) {
        while (toggle.wasPressed()) {
            enabled = !enabled;
            if (client.player != null) {
                client.player.sendMessage(Text.literal(
                        "Craftle camera auto-switch: " + (enabled ? "ON" : "OFF")), true);
            }
        }

        // Never affect a production server, normal gameplay or Flashback replay editor.
        if (!enabled || !filmingServer(client)) return;
        tick++;
        if (tick % 40 != 0 || !IN_FLIGHT.compareAndSet(false, true)) return;

        HttpRequest request = HttpRequest.newBuilder(ENDPOINT)
                .GET().timeout(Duration.ofSeconds(2)).build();
        HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .whenComplete((response, error) -> {
                    IN_FLIGHT.set(false);
                    if (error != null || response == null || response.statusCode() != 200) return;
                    try {
                        JsonObject wrapper = JsonParser.parseString(response.body()).getAsJsonObject();
                        if (!wrapper.has("available") || !wrapper.get("available").getAsBoolean()) return;
                        JsonObject info = wrapper.getAsJsonObject("density");
                        if (info == null || !info.has("occupancyRatio")) return;
                        double ratio = info.get("occupancyRatio").getAsDouble();
                        if (!Double.isFinite(ratio) || ratio < 0 || ratio > 1) return;
                        Instant sampledAt = Instant.parse(info.get("timestamp").getAsString());
                        long age = Math.abs(Duration.between(sampledAt, Instant.now()).getSeconds());
                        if (age > 8) return; // do not apply stale camera guidance
                        client.execute(() -> {
                            if (!enabled || !filmingServer(client)) return;
                            if (!dense && ratio >= DENSE_ENTER) dense = true;
                            else if (dense && ratio <= DENSE_EXIT) dense = false;
                            Perspective wanted = dense ? Perspective.THIRD_PERSON_BACK : Perspective.FIRST_PERSON;
                            if (client.options.getPerspective() != wanted) {
                                client.options.setPerspective(wanted);
                                LOG.info("Native POV switched to {} at block-density {} (camera only)",
                                        wanted, String.format(java.util.Locale.ROOT, "%.2f", ratio));
                            }
                            lastDataAt = System.currentTimeMillis();
                        });
                    } catch (RuntimeException ignored) {
                        // No camera override for missing or malformed telemetry.
                    }
                });
    }
}
