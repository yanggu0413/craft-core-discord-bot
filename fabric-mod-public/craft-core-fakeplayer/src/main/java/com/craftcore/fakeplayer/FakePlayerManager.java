package com.craftcore.fakeplayer;

import com.craftcore.data.AsyncSaveExecutor;
import com.craftcore.util.FabricPathUtil;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.ItemStack;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class FakePlayerManager {
    public static class FakePlayerEntry {
        public String owner;
        public boolean enabled;
        public String dimension;
        public Double x;
        public Double y;
        public Double z;
        public Float yaw;
        public Float pitch;

        public FakePlayerEntry(String owner, boolean enabled) {
            this.owner = owner;
            this.enabled = enabled;
        }

        public void setLocation(String dimension, double x, double y, double z, float yaw, float pitch) {
            this.dimension = dimension;
            this.x = x;
            this.y = y;
            this.z = z;
            this.yaw = yaw;
            this.pitch = pitch;
        }
    }

    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, FakePlayerEntry> fakePlayers = new ConcurrentHashMap<>();

    static {
        try {
            configPath = FabricPathUtil.getDataFile("fake_players.json");
        } catch (Throwable t) {
            configPath = Path.of("config", "craft-core", "data", "fake_players.json");
        }
        load();
    }

    public static synchronized void load() {
        if (configPath == null) {
            try {
                configPath = FabricPathUtil.getDataFile("fake_players.json");
            } catch (Throwable t) {
                configPath = Path.of("config", "craft-core", "data", "fake_players.json");
            }
        }
        if (Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                JsonElement element = JsonParser.parseReader(reader);
                if (element != null && element.isJsonObject()) {
                    fakePlayers.clear();
                    JsonObject root = element.getAsJsonObject();
                    for (Map.Entry<String, JsonElement> entry : root.entrySet()) {
                        String botName = entry.getKey().toLowerCase();
                        JsonElement val = entry.getValue();
                        if (val.isJsonPrimitive()) {
                            fakePlayers.put(botName, new FakePlayerEntry(val.getAsString(), true));
                        } else if (val.isJsonObject()) {
                            JsonObject obj = val.getAsJsonObject();
                            String owner = obj.has("owner") ? obj.get("owner").getAsString() : "Unknown";
                            boolean enabled = !obj.has("enabled") || obj.get("enabled").getAsBoolean();
                            FakePlayerEntry botEntry = new FakePlayerEntry(owner, enabled);

                            if (obj.has("dimension") && !obj.get("dimension").isJsonNull()) {
                                botEntry.dimension = obj.get("dimension").getAsString();
                            }
                            if (obj.has("x") && !obj.get("x").isJsonNull()) {
                                botEntry.x = obj.get("x").getAsDouble();
                            }
                            if (obj.has("y") && !obj.get("y").isJsonNull()) {
                                botEntry.y = obj.get("y").getAsDouble();
                            }
                            if (obj.has("z") && !obj.get("z").isJsonNull()) {
                                botEntry.z = obj.get("z").getAsDouble();
                            }
                            if (obj.has("yaw") && !obj.get("yaw").isJsonNull()) {
                                botEntry.yaw = obj.get("yaw").getAsFloat();
                            }
                            if (obj.has("pitch") && !obj.get("pitch").isJsonNull()) {
                                botEntry.pitch = obj.get("pitch").getAsFloat();
                            }
                            fakePlayers.put(botName, botEntry);
                        }
                    }
                }
            } catch (Exception e) {
                System.err.println("[CraftCore-FakePlayer] Failed to load fake players: " + e.getMessage());
            }
        }
    }

    public static void save() {
        Map<String, FakePlayerEntry> snapshot = new ConcurrentHashMap<>(fakePlayers);
        AsyncSaveExecutor.submit(() -> {
            if (configPath != null) {
                try {
                    Files.createDirectories(configPath.getParent());
                    try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                        GSON.toJson(snapshot, writer);
                    }
                } catch (IOException e) {
                    System.err.println("[CraftCore-FakePlayer] Failed to save fake players: " + e.getMessage());
                }
            }
        });
    }

    public static synchronized void saveAllCurrentPositions(MinecraftServer server) {
        if (server == null || server.getPlayerList() == null) return;
        boolean changed = false;
        for (Map.Entry<String, FakePlayerEntry> entry : fakePlayers.entrySet()) {
            String botName = entry.getKey();
            ServerPlayer sp = server.getPlayerList().getPlayerByName(botName);
            if (sp != null) {
                String dim = sp.level().dimension().identifier().toString();
                entry.getValue().setLocation(dim, sp.getX(), sp.getY(), sp.getZ(), sp.getYRot(), sp.getXRot());
                changed = true;
            }
        }
        if (changed) {
            save();
        }
    }

    public static synchronized void register(String botName, String owner) {
        register(botName, owner, true);
    }

    public static synchronized void register(String botName, String owner, boolean enabled) {
        if (botName == null || botName.trim().isEmpty()) return;
        fakePlayers.put(botName.toLowerCase(), new FakePlayerEntry(owner, enabled));
        save();
    }

    public static void dropFakePlayerItems(ServerPlayer player) {
        if (player == null || player.level() == null) return;
        try {
            Inventory inv = player.getInventory();
            for (int i = 0; i < inv.getContainerSize(); i++) {
                ItemStack stack = inv.getItem(i);
                if (!stack.isEmpty()) {
                    player.spawnAtLocation((ServerLevel) player.level(), stack);
                    inv.setItem(i, ItemStack.EMPTY);
                }
            }
        } catch (Throwable t) {
            System.err.println("[CraftCore-FakePlayer] Error dropping fake player items: " + t.getMessage());
        }
    }

    public static synchronized void unregister(String botName) {
        if (botName == null || botName.trim().isEmpty()) return;
        fakePlayers.remove(botName.toLowerCase());
        save();
    }

    public static synchronized void setBotEnabled(String botName, String owner, boolean enabled) {
        if (botName == null || botName.trim().isEmpty()) return;
        String key = botName.toLowerCase();
        FakePlayerEntry entry = fakePlayers.get(key);
        if (entry != null) {
            entry.enabled = enabled;
            if (owner != null && !owner.isEmpty()) {
                entry.owner = owner;
            }
        } else {
            fakePlayers.put(key, new FakePlayerEntry(owner != null ? owner : "Unknown", enabled));
        }
        save();
    }

    public static synchronized String getOwner(String botName) {
        if (botName == null) return null;
        FakePlayerEntry entry = fakePlayers.get(botName.toLowerCase());
        return entry != null ? entry.owner : null;
    }

    public static synchronized Map<String, String> getAllFakePlayers() {
        Map<String, String> result = new ConcurrentHashMap<>();
        for (Map.Entry<String, FakePlayerEntry> entry : fakePlayers.entrySet()) {
            result.put(entry.getKey(), entry.getValue().owner);
        }
        return result;
    }

    public static synchronized Map<String, FakePlayerEntry> getFakePlayerEntries() {
        return new ConcurrentHashMap<>(fakePlayers);
    }

    public static int getActiveBotsCount(String owner, MinecraftServer server) {
        if (owner == null || server == null || server.getPlayerList() == null) return 0;
        int count = 0;
        for (Map.Entry<String, FakePlayerEntry> entry : fakePlayers.entrySet()) {
            if (entry.getValue().owner.equalsIgnoreCase(owner)) {
                if (server.getPlayerList().getPlayerByName(entry.getKey()) != null) {
                    count++;
                }
            }
        }
        return count;
    }

    private static ScheduledExecutorService positionRecorderScheduler;

    public static void startPositionRecorder(MinecraftServer server) {
        if (positionRecorderScheduler != null && !positionRecorderScheduler.isShutdown()) {
            return;
        }
        positionRecorderScheduler = Executors.newSingleThreadScheduledExecutor();
        positionRecorderScheduler.scheduleAtFixedRate(() -> {
            try {
                if (server == null || server.getPlayerList() == null) return;
                server.execute(() -> saveAllCurrentPositions(server));
            } catch (Throwable t) {
                System.err.println("[CraftCore-FakePlayer] Failed to record fake player positions: " + t.getMessage());
            }
        }, 1, 1, TimeUnit.MINUTES);
    }

    public static boolean isFakePlayer(ServerPlayer player) {
        if (player == null) return false;
        String name = player.getName().getString().toLowerCase();
        if (fakePlayers.containsKey(name)) return true;
        String className = player.getClass().getName();
        return className.contains("FakePlayer") || className.contains("EntityPlayerMPFake");
    }

    public static void scheduleAutoReconnect(MinecraftServer server) {
        startPositionRecorder(server);
        System.out.println("[CraftCore-FakePlayer] Position recorder started for active fake players.");
    }

    public static Path getConfigPath() {
        return configPath;
    }
}
