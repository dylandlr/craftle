package org.craftle.observer;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.block.Block;
import org.bukkit.entity.Item;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockDropItemEvent;
import org.bukkit.event.entity.EntityPickupItemEvent;
import org.bukkit.event.entity.FoodLevelChangeEvent;
import org.bukkit.event.player.PlayerItemConsumeEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public final class CraftleObserver extends JavaPlugin implements Listener {
  private BufferedWriter out;
  private final AtomicLong sequence = new AtomicLong();
  private final String bootId = UUID.randomUUID().toString();
  private long bootNano;
  private String experimentId;

  private static String quote(String value) {
    if (value == null) return "null";
    StringBuilder sb = new StringBuilder("\"");
    for (char c : value.toCharArray()) {
      switch (c) {
        case '"' -> sb.append("\\\"");
        case '\\' -> sb.append("\\\\");
        case '\n' -> sb.append("\\n");
        case '\r' -> sb.append("\\r");
        case '\t' -> sb.append("\\t");
        default -> { if (c < 32) sb.append(String.format("\\u%04x", (int)c)); else sb.append(c); }
      }
    }
    return sb.append('"').toString();
  }

  private String pos(Location loc) {
    return ",\"world\":" + quote(loc.getWorld().getKey().toString()) +
      ",\"x\":" + loc.getBlockX() + ",\"y\":" + loc.getBlockY() + ",\"z\":" + loc.getBlockZ();
  }

  private synchronized void write(String event, Player player, String fields) {
    long wall = System.currentTimeMillis();
    long monotonic = System.nanoTime() - bootNano;
    String row = "{\"schema\":\"craftle.server-event.v1\",\"experimentId\":" + quote(experimentId) +
      ",\"serverBootId\":" + quote(bootId) + ",\"sequence\":" + sequence.incrementAndGet() +
      ",\"unixTimeMs\":" + wall + ",\"monotonicNsSinceBoot\":" + monotonic +
      ",\"serverTick\":" + Bukkit.getCurrentTick() + ",\"event\":" + quote(event) +
      ",\"playerUuid\":" + quote(player == null ? null : player.getUniqueId().toString()) +
      ",\"playerName\":" + quote(player == null ? null : player.getName()) + fields + "}\n";
    try { out.write(row); out.flush(); } catch (IOException e) { getLogger().severe("Observer logging failed: " + e); }
  }

  private String inventory(Player p) {
    StringBuilder sb = new StringBuilder("[");
    boolean first = true;
    for (ItemStack stack : p.getInventory().getStorageContents()) {
      if (stack == null || stack.getType().isAir()) continue;
      if (!first) sb.append(',');
      first = false;
      sb.append("{\"item\":").append(quote(stack.getType().getKey().toString()))
        .append(",\"count\":").append(stack.getAmount()).append('}');
    }
    return sb.append(']').toString();
  }

  private int inventoryCount(Player p, String key) {
    int total = 0;
    for (ItemStack stack : p.getInventory().getStorageContents()) {
      if (stack != null && stack.getType().getKey().toString().equals(key)) total += stack.getAmount();
    }
    return total;
  }

  @Override public void onEnable() {
    bootNano = System.nanoTime();
    experimentId = System.getenv().getOrDefault("CRAFTLE_EXPERIMENT_ID", "unspecified");
    try {
      Path path = getDataFolder().toPath().resolve("events.jsonl");
      Files.createDirectories(path.getParent());
      out = Files.newBufferedWriter(path, StandardCharsets.UTF_8,
        StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    } catch(IOException e) { throw new IllegalStateException("Cannot open server event log",e); }
    Bukkit.getPluginManager().registerEvents(this,this);
    write("observer_boot",null,",\"implementation\":" + quote(Bukkit.getVersion()));
    new BukkitRunnable() {
      @Override public void run() {
        for (Player p : Bukkit.getOnlinePlayers()) {
          write("player_state_sample",p,",\"foodLevel\":" + p.getFoodLevel() +
            ",\"health\":" + p.getHealth() + ",\"inventory\":" + inventory(p));
        }
      }
    }.runTaskTimer(this,20L,20L);
  }

  @Override public void onDisable() {
    if(out != null) {
      write("observer_shutdown",null,"");
      try { out.close(); } catch(IOException e) { getLogger().warning("Cannot close event log: " + e); }
    }
  }
  @EventHandler(priority=EventPriority.MONITOR, ignoreCancelled=true)
  public void onJoin(PlayerJoinEvent event) {
    Player p=event.getPlayer();
    write("player_join",p,",\"foodLevel\":" + p.getFoodLevel() + ",\"inventory\":" + inventory(p));
  }
  @EventHandler(priority=EventPriority.MONITOR, ignoreCancelled=true)
  public void onBreak(BlockBreakEvent e) {
    Block b=e.getBlock();
    write("block_break_event",e.getPlayer(),pos(b.getLocation()) +
      ",\"block\":" + quote(b.getBlockData().getAsString()) + ",\"phase\":\"event_before_world_mutation\"");
  }
  @EventHandler(priority=EventPriority.MONITOR, ignoreCancelled=true)
  public void onDrop(BlockDropItemEvent e) {
    write("block_drops_event",e.getPlayer(),pos(e.getBlock().getLocation()) +
      ",\"drops\":" + e.getItems().stream().map(i -> "{\"entityUuid\":" +
         quote(i.getUniqueId().toString()) + ",\"item\":" + quote(i.getItemStack().getType().getKey().toString()) +
         ",\"count\":" + i.getItemStack().getAmount() + "}").reduce("[",(a,b)-> a.equals("[")?a+b:a+","+b) + "]");
  }
  @EventHandler(priority=EventPriority.MONITOR, ignoreCancelled=true)
  public void onPickup(EntityPickupItemEvent e) {
    if(!(e.getEntity() instanceof Player p)) return;
    Item item=e.getItem();
    final String pickupUuid = item.getUniqueId().toString();
    final String pickedItem = item.getItemStack().getType().getKey().toString();
    final int beforeCount = inventoryCount(p, pickedItem);
    write("item_pickup_event",p,",\"itemEntityUuid\":" + quote(item.getUniqueId().toString()) +
      ",\"item\":" + quote(item.getItemStack().getType().getKey().toString()) +
      ",\"count\":" + item.getItemStack().getAmount() +
      ",\"phase\":\"event_before_inventory_mutation\"");
  }
  @EventHandler(priority=EventPriority.MONITOR, ignoreCancelled=true)
  public void onConsume(PlayerItemConsumeEvent e) {
    write("item_consume_event",e.getPlayer(),",\"item\":" +
      quote(e.getItem().getType().getKey().toString()) + ",\"phase\":\"event_before_consumption_resolution\"");
  }
  @EventHandler(priority=EventPriority.MONITOR, ignoreCancelled=true)
  public void onFood(FoodLevelChangeEvent e) {
    if(!(e.getEntity() instanceof Player p))return;
    write("food_level_change_event",p,",\"previousFood\":" + p.getFoodLevel() +
      ",\"proposedFood\":" + e.getFoodLevel() + ",\"phase\":\"event_before_food_state_mutation\"");
  }
}
