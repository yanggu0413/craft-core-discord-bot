package com.craftcore.teleport;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
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

public class WarpManager {
    public static class Warp {
        public String name;
        public double x, y, z;
        public float yaw, pitch;
        public String dimension;

        public Warp(String name, double x, double y, double z, float yaw, float pitch, String dimension) {
            this.name = name;
            this.x = x;
            this.y = y;
            this.z = z;
            this.yaw = yaw;
            this.pitch = pitch;
            this.dimension = dimension;
        }
    }

    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, Warp> warps = new ConcurrentHashMap<>();

    static {
        try {
            configPath = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir()
                    .resolve("craft-core-shop").resolve("warps.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "warps.json");
        }
        load();
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Map<String, Warp> loaded = GSON.fromJson(reader, new TypeToken<Map<String, Warp>>(){}.getType());
                if (loaded != null) {
                    warps.clear();
                    warps.putAll(loaded);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load warps: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            try {
                Files.createDirectories(configPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                    GSON.toJson(warps, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save warps: " + e.getMessage());
            }
        }
    }

    public static synchronized boolean addWarp(String name, double x, double y, double z, float yaw, float pitch, String dimension) {
        warps.put(name.toLowerCase(), new Warp(name, x, y, z, yaw, pitch, dimension));
        save();
        return true;
    }

    public static synchronized boolean removeWarp(String name) {
        if (warps.containsKey(name.toLowerCase())) {
            warps.remove(name.toLowerCase());
            save();
            return true;
        }
        return false;
    }

    public static synchronized Warp getWarp(String name) {
        return warps.get(name.toLowerCase());
    }

    public static synchronized List<Warp> getWarps() {
        return new ArrayList<>(warps.values());
    }
}
