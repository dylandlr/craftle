package dev.craftle.observer;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.io.BufferedWriter;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

public final class CraftleServerObserver implements ModInitializer {
  private final Gson gson = new Gson();
  private final String serverRunId = UUID.randomUUID().toString();
  private long tickIndex = 0;
  private Path logPath;
  private BufferedWriter writer;
  private final BlockingQueue<String> pending = new ArrayBlockingQueue<>(8192);
  private Thread logThread;
  private volatile boolean writing = false;
  private long droppedEvents = 0;
  private final Map<UUID, Snapshot> previous = new HashMap<>();

  private record Slot(String item,int count,String components) {}
  private record Snapshot(double x,double y,double z,float health,int hunger,int inventoryHash,boolean dead,List<Slot> inventory) {}

  @Override public void onInitialize() {
    ServerLifecycleEvents.SERVER_STARTED.register(server -> {
      try {
        Path dir = Path.of("craftle-observer");
        Files.createDirectories(dir);
        logPath = dir.resolve("server-events.jsonl");
        writer = Files.newBufferedWriter(logPath, StandardCharsets.UTF_8,
          StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        writing = true;
        logThread = new Thread(this::drainEvents, "craftle-observer-writer");
        logThread.setDaemon(true);
        logThread.start();
        emit("server_observer_started", server, null, null);
      } catch (IOException error) {
        throw new IllegalStateException("Craftle observer could not create its output file", error);
      }
    });
    ServerTickEvents.END_SERVER_TICK.register(this::tick);
    ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
      emit("server_observer_stopping", server, null, null);
      writing = false;
      if(logThread != null) {
        try { logThread.join(10000L); } catch(InterruptedException ex) { Thread.currentThread().interrupt(); }
      }
      if(logThread != null && logThread.isAlive()) {
        throw new IllegalStateException("Craftle writer did not drain during shutdown");
      }
      writer = null;
    });
  }
  private List<Slot> inventorySlots(ServerPlayerEntity player) {
    List<Slot> slots = new ArrayList<>();
    for(int index=0; index<player.getInventory().size(); index++) {
      ItemStack stack=player.getInventory().getStack(index);
      slots.add(new Slot(Registries.ITEM.getId(stack.getItem()).toString(),stack.getCount(),stack.getComponents().toString()));
    }
    return slots;
  }
  private int inventoryFingerprint(ServerPlayerEntity player) {
    int result=1;
    for(int slot=0;slot<player.getInventory().size();slot++){
      ItemStack stack=player.getInventory().getStack(slot);
      result=31*result+Objects.hash(Registries.ITEM.getId(stack.getItem()).toString(),stack.getCount(),stack.isEmpty());
    }
    return result;
  }
  private void tick(MinecraftServer server) {
    if(writer==null)return;
    tickIndex++;
    if(tickIndex%20==0)emit("server_tick_heartbeat",server,null,null);
    Set<UUID> online=new HashSet<>();
    for(ServerPlayerEntity player:server.getPlayerManager().getPlayerList()){
      UUID id=player.getUuid();online.add(id);
      Snapshot now=new Snapshot(player.getX(),player.getY(),player.getZ(),player.getHealth(),
        player.getHungerManager().getFoodLevel(),inventoryFingerprint(player),player.isDead(),inventorySlots(player));
      Snapshot prior=previous.put(id,now);
      if(prior==null)emit("player_observed",server,player,now);
      if(prior!=null){
        if(now.health!=prior.health)emit("player_health_changed",server,player,now);
        if(now.hunger!=prior.hunger)emit("player_hunger_changed",server,player,now);
        if(!now.inventory.equals(prior.inventory)) emitInventoryChanges(server,player,prior,now);
        if(now.dead&&!prior.dead)emit("player_death_state_observed",server,player,now);
        if(tickIndex%20==0&&(now.x!=prior.x||now.y!=prior.y||now.z!=prior.z))
          emit("player_position_sample",server,player,now);
      }
    }
    previous.keySet().retainAll(online);
  }
  private void emitInventoryChanges(MinecraftServer server,ServerPlayerEntity player,Snapshot prior,Snapshot now) {
    for(int i=0;i<now.inventory.size();i++) {
      Slot before=prior.inventory.get(i), after=now.inventory.get(i);
      if(before.equals(after))continue;
      JsonObject detail=new JsonObject();
      detail.addProperty("slot",i);
      detail.addProperty("beforeItem",before.item());
      detail.addProperty("beforeCount",before.count());
      detail.addProperty("beforeComponents",before.components());
      detail.addProperty("afterItem",after.item());
      detail.addProperty("afterCount",after.count());
      detail.addProperty("afterComponents",after.components());
      detail.addProperty("observationType","end_of_tick_slot_delta");
      emit("player_inventory_slot_changed",server,player,now,detail);
    }
    emit("player_inventory_changed",server,player,now);
  }
  private void drainEvents() {
    try {
      while(writing || !pending.isEmpty()) {
        String line=pending.poll(250,TimeUnit.MILLISECONDS);
        if(line!=null) { writer.write(line); writer.newLine(); }
        if(pending.isEmpty())writer.flush();
      }
      writer.flush();
      writer.close();
    } catch(Exception error) {
      System.err.println("[craftle-observer] writer failure: " + error);
      writing=false;
    }
  }
  private void emit(String type,MinecraftServer server,ServerPlayerEntity player,Snapshot state) {
    emit(type,server,player,state,null);
  }
  private void emit(String type,MinecraftServer server,ServerPlayerEntity player,Snapshot state,JsonObject detail) {
    if(writer==null)return;
    JsonObject row=new JsonObject();
    row.addProperty("schema","craftle.server-event.v1");
    row.addProperty("type",type);
    row.addProperty("serverRunId",serverRunId);
    row.addProperty("tickIndex",tickIndex);
    row.addProperty("serverGameTime",server.getOverworld().getTime());
    row.addProperty("world","minecraft:overworld");
    row.addProperty("wallTime",System.currentTimeMillis());
    if(player!=null){
      row.addProperty("playerUuid",player.getUuidAsString());
      row.addProperty("playerName",player.getGameProfile().getName());
      row.addProperty("dimension",player.getWorld().getRegistryKey().getValue().toString());
    }
    if(state!=null){
      row.addProperty("x",state.x);row.addProperty("y",state.y);row.addProperty("z",state.z);
      row.addProperty("health",state.health);row.addProperty("food",state.hunger);
      row.addProperty("inventoryFingerprint",state.inventoryHash);
      row.addProperty("dead",state.dead);
    }
    if(detail!=null)row.add("detail",detail);
    if(!pending.offer(gson.toJson(row))) {
      droppedEvents++;
      if(droppedEvents==1 || droppedEvents%1000==0) System.err.println("[craftle-observer] EVENT LOSS: queue full, dropped=" + droppedEvents);
    }
  }
}
