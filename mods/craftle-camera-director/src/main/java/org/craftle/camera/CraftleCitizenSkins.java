package org.craftle.camera;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.util.Identifier;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

/** Spectator-only, read-only local skin override; fallback to vanilla if unavailable. */
public final class CraftleCitizenSkins {
    private static final HttpClient HTTP=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build();
    private static final URI PNG=URI.create("http://127.0.0.1:3011/api/citizens/agent_001/skin.png");
    private static final URI META=URI.create("http://127.0.0.1:3011/api/citizens/agent_001");
    private static final AtomicBoolean LOADING=new AtomicBoolean(false);
    private static volatile SkinTextures loaded;
    private static long lastAttempt=0;
    private CraftleCitizenSkins(){}
    public static SkinTextures skinFor(String username){
        MinecraftClient client=MinecraftClient.getInstance();
        if(!"Turesla".equals(username)||!CraftleCameraDirector.filmingServer(client))return null;
        if(loaded==null&&System.currentTimeMillis()-lastAttempt>8000)fetch(client);
        return loaded;
    }
    private static void fetch(MinecraftClient client){
        if(!LOADING.compareAndSet(false,true))return;
        lastAttempt=System.currentTimeMillis();
        HTTP.sendAsync(HttpRequest.newBuilder(PNG).GET().timeout(Duration.ofSeconds(3)).build(),
            HttpResponse.BodyHandlers.ofByteArray()).thenCombine(
          HTTP.sendAsync(HttpRequest.newBuilder(META).GET().timeout(Duration.ofSeconds(3)).build(),
            HttpResponse.BodyHandlers.ofString()),(image,info)->{
                if(image.statusCode()!=200||info.statusCode()!=200||image.body().length>65536)return null;
                return new Object[]{image.body(),info.body()};
            }).whenComplete((value,error)->{
                LOADING.set(false);
                if(error!=null||value==null)return;
                client.execute(()->{
                    if(!CraftleCameraDirector.filmingServer(client))return;
                    try {
                        NativeImage decoded=NativeImage.read(new ByteArrayInputStream((byte[])value[0]));
                        if(decoded.getWidth()!=64||decoded.getHeight()!=64){decoded.close();return;}
                        JsonObject data=JsonParser.parseString((String)value[1]).getAsJsonObject();
                        JsonObject appearance=data.getAsJsonObject("appearance");
                        String model=appearance!=null&&appearance.has("model")?appearance.get("model").getAsString():"classic";
                        Identifier texture=Identifier.of("craftle_camera_director","citizens/turesla");
                        client.getTextureManager().registerTexture(texture,new NativeImageBackedTexture(decoded));
                        loaded=new SkinTextures(texture,null,null,null,
                          "slim".equals(model)?SkinTextures.Model.SLIM:SkinTextures.Model.WIDE,false);
                    }catch(Exception ignored){/* Vanilla skin remains intact */ }
                });
            });
    }
}
