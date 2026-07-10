package com.craftcore.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.fabricmc.loader.api.FabricLoader;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

public class ConfigManager {
    private static final Path CONFIG_PATH = FabricLoader.getInstance().getConfigDir().resolve("craftcore.json");
    private static final Path PLAYER_PATH = FabricLoader.getInstance().getConfigDir().resolve("craftcore_players.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private static ModConfig config = new ModConfig();
    private static Map<String, String> playerLastOnline = new ConcurrentHashMap<>();

    public static synchronized void loadConfig() {
        if (Files.exists(CONFIG_PATH)) {
            try (BufferedReader reader = Files.newBufferedReader(CONFIG_PATH)) {
                ModConfig loaded = GSON.fromJson(reader, ModConfig.class);
                if (loaded != null) {
                    config = loaded;
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load config, using defaults: " + e.getMessage());
            }
        } else {
            saveConfig();
        }
    }

    public static synchronized void saveConfig() {
        try {
            Files.createDirectories(CONFIG_PATH.getParent());
            try (BufferedWriter writer = Files.newBufferedWriter(CONFIG_PATH)) {
                GSON.toJson(config, writer);
            }
        } catch (IOException e) {
            System.err.println("[CraftCore] Failed to save config: " + e.getMessage());
        }
    }

    public static synchronized void loadPlayers() {
        if (Files.exists(PLAYER_PATH)) {
            try (BufferedReader reader = Files.newBufferedReader(PLAYER_PATH)) {
                Map<String, String> loaded = GSON.fromJson(reader, new TypeToken<Map<String, String>>(){}.getType());
                if (loaded != null) {
                    playerLastOnline = new ConcurrentHashMap<>(loaded);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load players file: " + e.getMessage());
            }
        }
    }

    public static synchronized void savePlayers() {
        try {
            Files.createDirectories(PLAYER_PATH.getParent());
            try (BufferedWriter writer = Files.newBufferedWriter(PLAYER_PATH)) {
                GSON.toJson(playerLastOnline, writer);
            }
        } catch (IOException e) {
            System.err.println("[CraftCore] Failed to save players file: " + e.getMessage());
        }
    }

    public static ModConfig getConfig() {
        return config;
    }

    public static void updatePlayerLastOnline(String username) {
        playerLastOnline.put(username, Instant.now().toString());
        CompletableFuture.runAsync(ConfigManager::savePlayers);
    }

    public static String getPlayerLastOnline(String username) {
        return playerLastOnline.get(username);
    }
}
