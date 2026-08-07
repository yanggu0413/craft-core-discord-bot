package com.craftcore.home;

import com.craftcore.api.EconomyAPI;
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
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class HomeManager {
    public static class Home {
        public String name;
        public double x, y, z;
        public float yaw, pitch;
        public String dimension;

        public Home(String name, double x, double y, double z, float yaw, float pitch, String dimension) {
            this.name = name;
            this.x = x;
            this.y = y;
            this.z = z;
            this.yaw = yaw;
            this.pitch = pitch;
            this.dimension = dimension;
        }
    }

    private static final Path CONFIG_PATH = FabricPathUtil.getDataFile("homes.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, Map<String, Home>> userHomes = new ConcurrentHashMap<>();

    static {
        load();
    }

    public static synchronized void load() {
        if (CONFIG_PATH != null && Files.exists(CONFIG_PATH)) {
            try (BufferedReader reader = Files.newBufferedReader(CONFIG_PATH)) {
                Map<String, Map<String, Home>> loaded = GSON.fromJson(reader, new TypeToken<Map<String, Map<String, Home>>>(){}.getType());
                if (loaded != null) {
                    userHomes.clear();
                    userHomes.putAll(loaded);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore-Home] Failed to load homes.json: " + e.getMessage());
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
                    GSON.toJson(userHomes, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore-Home] Failed to save homes.json: " + e.getMessage());
            }
        }
    }

    public static synchronized Map<String, Home> getPlayerHomes(String username) {
        Map<String, Home> homes = userHomes.get(username.toLowerCase());
        return homes != null ? new ConcurrentHashMap<>(homes) : new ConcurrentHashMap<>();
    }

    public static synchronized Home getHome(String username, String homeName) {
        Map<String, Home> homes = userHomes.get(username.toLowerCase());
        if (homes == null) return null;
        return homes.get(homeName.toLowerCase());
    }

    public static synchronized String setHome(String username, String homeName, double x, double y, double z, float yaw, float pitch, String dimension) {
        Map<String, Home> homes = userHomes.computeIfAbsent(username.toLowerCase(), k -> new ConcurrentHashMap<>());
        boolean isExisting = homes.containsKey(homeName.toLowerCase());

        if (!isExisting) {
            if (homes.size() >= 15) {
                return "上限為 15 個 Home，無法再建立！";
            }
            if (homes.size() >= 2) {
                double balance = EconomyAPI.getProvider().getBalance(username);
                if (balance < 300.0) {
                    return "金額不足！建立超過 2 個的家需要 $300 遊戲幣。";
                }
                if (!EconomyAPI.getProvider().removeMoney(username, 300.0)) {
                    return "扣款 $300 失敗！";
                }
            }
        }

        homes.put(homeName.toLowerCase(), new Home(homeName, x, y, z, yaw, pitch, dimension));
        AsyncSaveExecutor.submit(HomeManager::save);
        return "SUCCESS";
    }

    public static synchronized boolean deleteHome(String username, String homeName) {
        Map<String, Home> homes = userHomes.get(username.toLowerCase());
        if (homes != null && homes.containsKey(homeName.toLowerCase())) {
            homes.remove(homeName.toLowerCase());
            AsyncSaveExecutor.submit(HomeManager::save);
            return true;
        }
        return false;
    }

    public static synchronized void clearAll() {
        userHomes.clear();
    }
}
