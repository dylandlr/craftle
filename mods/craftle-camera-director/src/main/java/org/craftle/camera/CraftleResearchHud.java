package org.craftle.camera;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

/** Read-only spectator HUD, drawn client-side; not a Minecraft server mod. */
public final class CraftleResearchHud {
    private static final URI ENDPOINT=URI.create("http://127.0.0.1:3011/api/hud/state");
    private static final HttpClient HTTP=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build();
    private static final AtomicBoolean IN_FLIGHT=new AtomicBoolean(false);
    private static volatile JsonObject state;
    private static volatile long receivedAt=0;
    private static volatile boolean enabled=true;
    private static long ticks=0;
    private static KeyBinding toggle;
    private static KeyBinding perceptionToggle;
    private static volatile boolean showPolicyPerception=false;

    public static void install(){
        toggle=KeyBindingHelper.registerKeyBinding(new KeyBinding("key.craftle.hud.toggle",
                InputUtil.Type.KEYSYM,GLFW.GLFW_KEY_F9,"category.craftle.camera"));
        perceptionToggle=KeyBindingHelper.registerKeyBinding(new KeyBinding("key.craftle.hud.perception",
                InputUtil.Type.KEYSYM,GLFW.GLFW_KEY_F10,"category.craftle.camera"));
        ClientTickEvents.END_CLIENT_TICK.register(client->{
            while(perceptionToggle.wasPressed())showPolicyPerception=!showPolicyPerception;
            while(toggle.wasPressed()){
                enabled=!enabled;
                if(client.player!=null)client.player.sendMessage(
                   Text.literal("Craftle Research HUD: "+(enabled?"ON":"OFF")),true);
            }
            if(!CraftleCameraDirector.filmingServer(client))return;
            if(++ticks%20!=0||!IN_FLIGHT.compareAndSet(false,true))return;
            HTTP.sendAsync(HttpRequest.newBuilder(ENDPOINT).GET()
              .timeout(Duration.ofSeconds(2)).build(),HttpResponse.BodyHandlers.ofString())
              .whenComplete((response,error)->{
                IN_FLIGHT.set(false);
                if(error!=null||response==null||response.statusCode()!=200)return;
                try{
                    JsonObject data=JsonParser.parseString(response.body()).getAsJsonObject();
                    if("craftle.native-hud.v1".equals(value(data,"schema",""))){
                        state=data;receivedAt=System.currentTimeMillis();
                    }
                }catch(Exception ignored){}
              });
        });
        HudRenderCallback.EVENT.register((ctx,tickDelta)->render(ctx));
    }
    private static String value(JsonObject object,String key,String fallback){
        if(object==null||!object.has(key)||object.get(key).isJsonNull())return fallback;
        try{return object.get(key).getAsString();}catch(Exception ex){return fallback;}
    }
    private static String nested(JsonObject object,String parent,String key,String fallback){
        try{return value(object.getAsJsonObject(parent),key,fallback);}catch(Exception e){return fallback;}
    }
    private static void render(DrawContext ctx){
        MinecraftClient client=MinecraftClient.getInstance();
        if(!enabled||!CraftleCameraDirector.filmingServer(client)||client.options.hudHidden)return;
        int x=8,y=8,w=228;
        ctx.fill(x-4,y-4,x+w,y+(showPolicyPerception?143:90),0xb915202e);
        ctx.drawTextWithShadow(client.textRenderer,Text.literal("CRAFTLE  /  CITIZEN OBSERVER"),x,y,0x8bd7fa);
        JsonObject s=state;
        if(s==null||System.currentTimeMillis()-receivedAt>4500){
            ctx.drawTextWithShadow(client.textRenderer,Text.literal("TELEMETRY OFFLINE / STALE"),x,y+14,0xffab8e);return;
        }
        String action=value(s,"action","?");
        String id=value(s,"decisionId","?");
        ctx.drawTextWithShadow(client.textRenderer,Text.literal("HP "+value(s,"health","?")+
           "  FOOD "+value(s,"food","?")+"   DECISION #"+id),x,y+14,0xffffff);
        ctx.drawTextWithShadow(client.textRenderer,Text.literal("DQN: "+action),x,y+27,0xa7ecc7);
        ctx.drawTextWithShadow(client.textRenderer,Text.literal("REWARD "+value(s,"reward","?")+
           "   UPDATES "+value(s,"updates","?")),x,y+40,0xffffff);
        ctx.drawTextWithShadow(client.textRenderer,Text.literal("FOOTING: "+nested(s,"density","underfoot","unknown")),x,y+53,0xe9c682);
        ctx.drawTextWithShadow(client.textRenderer,Text.literal("NAV: "+nested(s,"latestNavigation","status","—")+
           "   TARGETS "+(s.has("targets")?s.getAsJsonArray("targets").size():0)),x,y+66,0xffffff);
        ctx.drawTextWithShadow(client.textRenderer,Text.literal("F9 HUD  |  F10 perception  |  F8 POV"),x,y+79,0x9fb1c7);
        if(showPolicyPerception){
            JsonObject view=s.has("perception")&&s.get("perception").isJsonObject()
                 ?s.getAsJsonObject("perception"):null;
            ctx.drawTextWithShadow(client.textRenderer,Text.literal("DQN TARGETS (NOT CAMERA VISION)"),x,y+96,0x8bd7fa);
            ctx.drawTextWithShadow(client.textRenderer,Text.literal("Policy targets: "+value(view,"targetCount","?")),x,y+110,0xffffff);
            ctx.drawTextWithShadow(client.textRenderer,Text.literal("Terrain is OBSERVER-ONLY"),x,y+124,0xe9c682);
        }
    }
}
