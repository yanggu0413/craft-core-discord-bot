package com.craftcore.fakeplayer;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.minecraft.server.MinecraftServer;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class FakePlayerManager {
    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, String> fakePlayerOwners = new ConcurrentHashMap<>(); // Key: fp_name, Value: ownerName

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
                Map<String, String> loaded = GSON.fromJson(reader, new TypeToken<Map<String, String>>(){}.getType());
                if (loaded != null) {
                    fakePlayerOwners.clear();
                    fakePlayerOwners.putAll(loaded);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load fake players: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            try {
                Files.createDirectories(configPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                    GSON.toJson(fakePlayerOwners, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save fake players: " + e.getMessage());
            }
        }
    }

    public static synchronized void register(String botName, String owner) {
        fakePlayerOwners.put(botName.toLowerCase(), owner);
        save();
    }

    public static synchronized String getOwner(String botName) {
        return fakePlayerOwners.get(botName.toLowerCase());
    }

    public static synchronized Map<String, String> getAllFakePlayers() {
        return new ConcurrentHashMap<>(fakePlayerOwners);
    }

    public static int getActiveBotsCount(String owner, MinecraftServer server) {
        int count = 0;
        for (Map.Entry<String, String> entry : fakePlayerOwners.entrySet()) {
            if (entry.getValue().equalsIgnoreCase(owner)) {
                if (server.getPlayerList().getPlayerByName(entry.getKey()) != null) {
                    count++;
                }
            }
        }
        return count;
    }
}
