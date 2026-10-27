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
    private static KeyBinding gazeToggle;
    private static volatile boolean showGaze=false;
    private static volatile boolean showPolicyPerception=false;

    public static void install(){
        toggle=KeyBindingHelper.registerKeyBinding(new KeyBinding("key.craftle.hud.toggle",
                InputUtil.Type.KEYSYM,GLFW.GLFW_KEY_F9,"category.craftle.camera"));
        perceptionToggle=KeyBindingHelper.registerKeyBinding(new KeyBinding("key.craftle.hud.perception",
                InputUtil.Type.KEYSYM,GLFW.GLFW_KEY_F10,"category.craftle.camera"));
        gazeToggle=KeyBindingHelper.registerKeyBinding(new KeyBinding("key.craftle.hud.gaze",
                InputUtil.Type.KEYSYM,GLFW.GLFW_KEY_F7,"category.craftle.camera"));
        ClientTickEvents.END_CLIENT_TICK.register(client->{
            while(gazeToggle.wasPressed())showGaze=!showGaze;
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
        ctx.drawTextWithShadow(client.textRenderer,Text.literal("F7 gaze  |  F9 HUD  |  F10 policy"),x,y+79,0x9fb1c7);
        if(showGaze){
            JsonObject g=s.has("gaze")&&s.get("gaze").isJsonObject()?s.getAsJsonObject("gaze"):null;
            int gx=ctx.getScaledWindowWidth()-176,gy=10,gw=164,gh=112;
            ctx.fill(gx-4,gy-4,gx+gw,gy+gh,0xd915202e);
            ctx.drawTextWithShadow(client.textRenderer,Text.literal("AGENT HEAD GAZE / F7"),gx,gy,0x8bd7fa);
            if(g==null){
                ctx.drawTextWithShadow(client.textRenderer,Text.literal("NO RECENT HEAD POSE"),gx,gy+18,0xffab8e);
            }else{
                try{
                    double yaw=Double.parseDouble(value(g,"yaw","0"));
                    double pitch=Double.parseDouble(value(g,"pitch","0"));
                    int cx=gx+80,cy=gy+59;
                    // Horizontal: raw camera heading on a wraparound yaw scale.
                    // Vertical: look elevation. NOT learned saliency, eye movement, or ray-hit evidence.
                    int rx=(int)Math.round(Math.sin(Math.toRadians(yaw))*53);
                    int ry=(int)Math.round(Math.max(-90,Math.min(90,pitch))/90.0*27);
                    ctx.fill(cx-55,cy-29,cx+56,cy+30,0x99303e50);
                    ctx.fill(cx-1,cy-29,cx+1,cy+30,0xff6c829a);
                    ctx.fill(cx-55,cy-1,cx+56,cy+1,0xff6c829a);
                    ctx.fill(cx+rx-4,cy+ry-1,cx+rx+5,cy+ry+2,0xff7be1ae);
                    ctx.fill(cx+rx-1,cy+ry-4,cx+rx+2,cy+ry+5,0xff7be1ae);
                    ctx.drawTextWithShadow(client.textRenderer,Text.literal("Y "+Math.round(yaw)+"  P "+Math.round(pitch)),gx,gy+94,0xffffff);
                }catch(NumberFormatException ignored){}
            }
        }
        if(showPolicyPerception){
            JsonObject view=s.has("perception")&&s.get("perception").isJsonObject()
                 ?s.getAsJsonObject("perception"):null;
            ctx.drawTextWithShadow(client.textRenderer,Text.literal("DQN TARGETS (NOT CAMERA VISION)"),x,y+96,0x8bd7fa);
            ctx.drawTextWithShadow(client.textRenderer,Text.literal("Policy targets: "+value(view,"targetCount","?")),x,y+110,0xffffff);
            ctx.drawTextWithShadow(client.textRenderer,Text.literal("Terrain is OBSERVER-ONLY"),x,y+124,0xe9c682);
        }
    }
}
