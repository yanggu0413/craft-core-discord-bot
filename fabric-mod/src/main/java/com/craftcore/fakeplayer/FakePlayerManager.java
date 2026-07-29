package com.craftcore.fakeplayer;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
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
            configPath = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir()
                    .resolve("craft-core-shop").resolve("fake_players.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "fake_players.json");
        }
        load();
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
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
                System.err.println("[CraftCore] Failed to load fake players: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            try {
                Files.createDirectories(configPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                    GSON.toJson(fakePlayers, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save fake players: " + e.getMessage());
            }
        }
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
                System.err.println("[CraftCore] Failed to record fake player positions: " + t.getMessage());
            }
        }, 1, 1, TimeUnit.MINUTES);
    }

    public static void scheduleAutoReconnect(MinecraftServer server) {
        startPositionRecorder(server);
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.schedule(() -> {
            try {
                List<String> botsToReconnect = new ArrayList<>();
                synchronized (FakePlayerManager.class) {
                    for (Map.Entry<String, FakePlayerEntry> entry : fakePlayers.entrySet()) {
                        String botName = entry.getKey();
                        FakePlayerEntry botData = entry.getValue();
                        if (botData.enabled) {
                            ServerPlayer existing = server.getPlayerList().getPlayerByName(botName);
                            if (existing == null) {
                                botsToReconnect.add(botName);
                            }
                        }
                    }
                }

                if (botsToReconnect.isEmpty()) {
                    System.out.println("[CraftCore] No fake players to auto-reconnect.");
                    scheduler.shutdown();
                    return;
                }

                System.out.println("[CraftCore] Auto-reconnecting " + botsToReconnect.size() + " fake player(s) at saved positions...");
                for (int i = 0; i < botsToReconnect.size(); i++) {
                    final String botName = botsToReconnect.get(i);
                    scheduler.schedule(() -> {
                        server.execute(() -> {
                            try {
                                ServerPlayer checkPlayer = server.getPlayerList().getPlayerByName(botName);
                                if (checkPlayer == null) {
                                    var source = server.createCommandSourceStack();
                                    FakePlayerEntry botData = fakePlayers.get(botName.toLowerCase());

                                    if (botData != null && botData.x != null && botData.y != null && botData.z != null) {
                                        String dim = botData.dimension != null ? botData.dimension : "minecraft:overworld";
                                        float yaw = botData.yaw != null ? botData.yaw : 0.0f;
                                        float pitch = botData.pitch != null ? botData.pitch : 0.0f;

                                        // 1. Try Carpet Carpet Mod direct spawn at coordinates
                                        String carpetSpawnCmd = String.format(java.util.Locale.US, "player %s spawn at %.2f %.2f %.2f facing %.2f %.2f in %s",
                                                botName, botData.x, botData.y, botData.z, yaw, pitch, dim);
                                        server.getCommands().performPrefixedCommand(source, carpetSpawnCmd);

                                        // 2. Fallback TP to ensure exact position & rotation
                                        String tpCmd = String.format(java.util.Locale.US, "execute in %s run tp %s %.2f %.2f %.2f %.2f %.2f",
                                                dim, botName, botData.x, botData.y, botData.z, yaw, pitch);
                                        server.getCommands().performPrefixedCommand(source, tpCmd);

                                        System.out.println("[CraftCore] Auto-reconnected bot " + botName + " at recorded position: " + carpetSpawnCmd);
                                    } else {
                                        server.getCommands().performPrefixedCommand(source, "player " + botName + " spawn");
                                        System.out.println("[CraftCore] Auto-reconnected bot " + botName + " at default spawn.");
                                    }
                                }
                            } catch (Throwable t) {
                                System.err.println("[CraftCore] Failed to auto-reconnect bot " + botName + ": " + t.getMessage());
                            }
                        });
                    }, (long) i * 500, TimeUnit.MILLISECONDS);
                }

                scheduler.schedule(scheduler::shutdown, (long) botsToReconnect.size() * 500 + 1000, TimeUnit.MILLISECONDS);

            } catch (Throwable t) {
                System.err.println("[CraftCore] Error during fake player auto-reconnect: " + t.getMessage());
                scheduler.shutdown();
            }
        }, 5, TimeUnit.SECONDS);
    }
}
