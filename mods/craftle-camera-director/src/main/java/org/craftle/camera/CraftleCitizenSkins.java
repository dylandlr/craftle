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
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import com.google.gson.JsonArray;

/** Spectator-only, read-only local skin override; fallback to vanilla if unavailable. */
public final class CraftleCitizenSkins {
    private static final HttpClient HTTP=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build();
    private static final URI ROSTER=URI.create("http://127.0.0.1:3011/api/citizens");
    private static final AtomicBoolean ROSTER_FLIGHT=new AtomicBoolean(false);
    private static final Map<String,String> citizenIds=new ConcurrentHashMap<>();
    private static final Map<String,SkinTextures> loaded=new ConcurrentHashMap<>();
    private static final Map<String,Long> attempts=new ConcurrentHashMap<>();
    private static final Map<String,Boolean> inFlight=new ConcurrentHashMap<>();
    private static long lastRosterAttempt=0;
    private CraftleCitizenSkins(){}
    public static SkinTextures skinFor(String username){
        MinecraftClient client=MinecraftClient.getInstance();
        if(!CraftleCameraDirector.filmingServer(client)||username==null)return null;
        if(System.currentTimeMillis()-lastRosterAttempt>15000)refreshRoster();
        String id=citizenIds.get(username);
        if(id==null)return null;
        SkinTextures cached=loaded.get(id);
        if(cached==null&&System.currentTimeMillis()-attempts.getOrDefault(id,0L)>8000)fetch(client,id);
        return cached;
    }
    private static void refreshRoster(){
        if(!ROSTER_FLIGHT.compareAndSet(false,true))return;
        lastRosterAttempt=System.currentTimeMillis();
        HTTP.sendAsync(HttpRequest.newBuilder(ROSTER).GET().timeout(Duration.ofSeconds(2)).build(),
            HttpResponse.BodyHandlers.ofString()).whenComplete((res,error)->{
              ROSTER_FLIGHT.set(false);
              if(error!=null||res==null||res.statusCode()!=200)return;
              try{
                JsonArray citizens=JsonParser.parseString(res.body()).getAsJsonObject().getAsJsonArray("citizens");
                if(citizens==null)return;
                Map<String,String> next=new ConcurrentHashMap<>();
                for(var e:citizens){
                    JsonObject citizen=e.getAsJsonObject();
                    String name=citizen.get("name").getAsString(),id=citizen.get("id").getAsString();
                    if(name.matches("[A-Za-z0-9_]{1,16}")&&id.matches("[A-Za-z0-9_-]{1,32}"))next.put(name,id);
                }
                citizenIds.clear();citizenIds.putAll(next);
              }catch(Exception ignored){}
            });
    }
    private static void fetch(MinecraftClient client,String id){
        if(inFlight.putIfAbsent(id,true)!=null)return;
        attempts.put(id,System.currentTimeMillis());
        URI png=URI.create("http://127.0.0.1:3011/api/citizens/"+id+"/skin.png");
        URI meta=URI.create("http://127.0.0.1:3011/api/citizens/"+id);
        HTTP.sendAsync(HttpRequest.newBuilder(png).GET().timeout(Duration.ofSeconds(3)).build(),
            HttpResponse.BodyHandlers.ofByteArray()).thenCombine(
          HTTP.sendAsync(HttpRequest.newBuilder(meta).GET().timeout(Duration.ofSeconds(3)).build(),
            HttpResponse.BodyHandlers.ofString()),(image,info)->{
                if(image.statusCode()!=200||info.statusCode()!=200||image.body().length>65536)return null;
                return new Object[]{image.body(),info.body()};
            }).whenComplete((value,error)->{
                inFlight.remove(id);
                if(error!=null||value==null)return;
                client.execute(()->{
                    if(!CraftleCameraDirector.filmingServer(client))return;
                    try{
                        NativeImage decoded=NativeImage.read(new ByteArrayInputStream((byte[])value[0]));
                        if(decoded.getWidth()!=64||decoded.getHeight()!=64){decoded.close();return;}
                        JsonObject data=JsonParser.parseString((String)value[1]).getAsJsonObject();
                        JsonObject appearance=data.getAsJsonObject("appearance");
                        String model=appearance!=null&&appearance.has("model")?appearance.get("model").getAsString():"classic";
                        Identifier texture=Identifier.of("craftle_camera_director","citizens/"+id.toLowerCase(java.util.Locale.ROOT));
                        client.getTextureManager().registerTexture(texture,new NativeImageBackedTexture(decoded));
                        loaded.put(id,new SkinTextures(texture,null,null,null,
                          "slim".equals(model)?SkinTextures.Model.SLIM:SkinTextures.Model.WIDE,false));
                    }catch(Exception ignored){}
                });
            });
    }
}
