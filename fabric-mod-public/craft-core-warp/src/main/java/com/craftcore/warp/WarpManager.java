package com.craftcore.warp;

import com.craftcore.data.AsyncSaveExecutor;
import com.craftcore.util.FabricPathUtil;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

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
        public String type = "normal";
        public String desc = "";

        public Warp(String name, double x, double y, double z, float yaw, float pitch, String dimension) {
            this.name = name;
            this.x = x;
            this.y = y;
            this.z = z;
            this.yaw = yaw;
            this.pitch = pitch;
            this.dimension = dimension;
            this.type = "normal";
            this.desc = "";
        }

        public Warp(String name, double x, double y, double z, float yaw, float pitch, String dimension, String type, String desc) {
            this.name = name;
            this.x = x;
            this.y = y;
            this.z = z;
            this.yaw = yaw;
            this.pitch = pitch;
            this.dimension = dimension;
            this.type = type != null && !type.trim().isEmpty() ? type : "normal";
            this.desc = desc != null ? desc : "";
        }
    }

    private static final Path CONFIG_PATH = FabricPathUtil.getDataFile("warps.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, Warp> warps = new ConcurrentHashMap<>();

    static {
        load();
    }

    public static synchronized void load() {
        if (CONFIG_PATH != null && Files.exists(CONFIG_PATH)) {
            try (BufferedReader reader = Files.newBufferedReader(CONFIG_PATH)) {
                Map<String, Warp> loaded = GSON.fromJson(reader, new TypeToken<Map<String, Warp>>(){}.getType());
                if (loaded != null) {
                    warps.clear();
                    for (Map.Entry<String, Warp> entry : loaded.entrySet()) {
                        Warp w = entry.getValue();
                        if (w.type == null || w.type.trim().isEmpty()) w.type = "normal";
                        if (w.desc == null) w.desc = "";
                        warps.put(entry.getKey().toLowerCase(), w);
                    }
                }
            } catch (IOException e) {
                System.err.println("[CraftCore-Warp] Failed to load warps.json: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (CONFIG_PATH != null) {
            try {
                if (CONFIG_PATH.getParent() != null) {
                    Files.createDirectories(CONFIG_PATH.getParent());
                }
                try (BufferedWriter writer = Files.newBufferedWriter(CONFIG_PATH)) {
                    GSON.toJson(warps, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore-Warp] Failed to save warps.json: " + e.getMessage());
            }
        }
    }

    public static synchronized boolean addWarp(String name, double x, double y, double z, float yaw, float pitch, String dimension) {
        return addWarp(name, x, y, z, yaw, pitch, dimension, "normal", "");
    }

    public static synchronized boolean addWarp(String name, double x, double y, double z, float yaw, float pitch, String dimension, String type, String desc) {
        warps.put(name.toLowerCase(), new Warp(name, x, y, z, yaw, pitch, dimension, type, desc));
        AsyncSaveExecutor.submit(WarpManager::save);
        return true;
    }

    public static synchronized boolean removeWarp(String name) {
        if (warps.containsKey(name.toLowerCase())) {
            warps.remove(name.toLowerCase());
            AsyncSaveExecutor.submit(WarpManager::save);
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
