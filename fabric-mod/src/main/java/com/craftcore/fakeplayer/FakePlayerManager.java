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

        public FakePlayerEntry(String owner, boolean enabled) {
            this.owner = owner;
            this.enabled = enabled;
        }
    }

    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, FakePlayerEntry> fakePlayers = new ConcurrentHashMap<>(); // Key: botName, Value: FakePlayerEntry

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
                            // Backward compatibility: "botname": "owner"
                            fakePlayers.put(botName, new FakePlayerEntry(val.getAsString(), true));
                        } else if (val.isJsonObject()) {
                            JsonObject obj = val.getAsJsonObject();
                            String owner = obj.has("owner") ? obj.get("owner").getAsString() : "Unknown";
                            boolean enabled = !obj.has("enabled") || obj.get("enabled").getAsBoolean();
                            fakePlayers.put(botName, new FakePlayerEntry(owner, enabled));
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

    public static void scheduleAutoReconnect(MinecraftServer server) {
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

                System.out.println("[CraftCore] Auto-reconnecting " + botsToReconnect.size() + " fake player(s) with 0.5s interval...");
                for (int i = 0; i < botsToReconnect.size(); i++) {
                    final String botName = botsToReconnect.get(i);
                    scheduler.schedule(() -> {
                        server.execute(() -> {
                            try {
                                ServerPlayer checkPlayer = server.getPlayerList().getPlayerByName(botName);
                                if (checkPlayer == null) {
                                    var source = server.createCommandSourceStack();
                                    server.getCommands().performPrefixedCommand(source, "player " + botName + " spawn");
                                    System.out.println("[CraftCore] Auto-reconnected fake player bot: " + botName);
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
