package com.craftcore.config;

import com.craftcore.api.LangManager;
import com.craftcore.api.RebrandEngine;
import com.craftcore.util.FabricPathUtil;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class ConfigManager {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static ModConfig config = new ModConfig();

    public static synchronized void reset() {
        config = new ModConfig();
    }

    public static synchronized void loadConfig() {
        config = new ModConfig();
        Path configPath = FabricPathUtil.getCraftCoreConfigDir().resolve("config.json");
        if (Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                ModConfig loaded = GSON.fromJson(reader, ModConfig.class);
                if (loaded != null) {
                    config = loaded;
                }
            } catch (IOException e) {
                System.err.println("[CraftCore-Libs] Failed to load config.json: " + e.getMessage());
            }
        } else {
            saveConfig();
        }

        if (config != null) {
            RebrandEngine.update(config.server_name, config.prefix);
        }

        LangManager.load();
    }

    public static synchronized void saveConfig() {
        Path configPath = FabricPathUtil.getCraftCoreConfigDir().resolve("config.json");
        try {
            if (configPath.getParent() != null) {
                Files.createDirectories(configPath.getParent());
            }
            try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                GSON.toJson(config, writer);
            }
        } catch (IOException e) {
            System.err.println("[CraftCore-Libs] Failed to save config.json: " + e.getMessage());
        }
    }

    public static synchronized void reload() {
        loadConfig();
    }

    public static ModConfig getConfig() {
        if (config == null) {
            config = new ModConfig();
        }
        return config;
    }
}
