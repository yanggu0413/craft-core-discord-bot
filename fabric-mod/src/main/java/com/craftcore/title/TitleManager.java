package com.craftcore.title;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class TitleManager {
    public static class PlayerTitleData {
        public String activeTitle = "";
        public Set<String> unlockedTitles = new HashSet<>();

        public PlayerTitleData() {}
    }

    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, PlayerTitleData> playerTitles = new ConcurrentHashMap<>();

    static {
        try {
            configPath = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir()
                    .resolve("craft-core-shop").resolve("titles.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "titles.json");
        }
        load();
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Map<String, PlayerTitleData> loaded = GSON.fromJson(reader, new TypeToken<Map<String, PlayerTitleData>>(){}.getType());
                if (loaded != null) {
                    playerTitles.clear();
                    for (Map.Entry<String, PlayerTitleData> entry : loaded.entrySet()) {
                        playerTitles.put(entry.getKey().toLowerCase(), entry.getValue());
                    }
                }
            } catch (Exception e) {
                System.err.println("[CraftCore] Failed to load titles.json: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            try {
                Files.createDirectories(configPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                    GSON.toJson(playerTitles, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save titles.json: " + e.getMessage());
            }
        }
    }

    public static synchronized void unlockTitle(String username, String title) {
        if (username == null || title == null) return;
        String key = username.toLowerCase();
        PlayerTitleData data = playerTitles.computeIfAbsent(key, k -> new PlayerTitleData());
        if (data.unlockedTitles.add(title)) {
            if (data.activeTitle == null || data.activeTitle.isEmpty()) {
                data.activeTitle = title;
            }
            save();
        }
    }

    public static synchronized String getActiveTitle(String username) {
        if (username == null) return "";
        PlayerTitleData data = playerTitles.get(username.toLowerCase());
        return data != null && data.activeTitle != null ? data.activeTitle : "";
    }

    public static synchronized boolean setActiveTitle(String username, String title) {
        if (username == null) return false;
        String key = username.toLowerCase();
        PlayerTitleData data = playerTitles.get(key);
        if (data != null && (title.isEmpty() || data.unlockedTitles.contains(title))) {
            data.activeTitle = title;
            save();
            return true;
        }
        return false;
    }

    public static synchronized Set<String> getUnlockedTitles(String username) {
        if (username == null) return Collections.emptySet();
        PlayerTitleData data = playerTitles.get(username.toLowerCase());
        return data != null ? new HashSet<>(data.unlockedTitles) : Collections.emptySet();
    }

    public static synchronized String getTitlePrefix(String username) {
        String active = getActiveTitle(username);
        return active.isEmpty() ? "" : active + " ";
    }

    public static synchronized void removeTitle(String username) {
        setActiveTitle(username, "");
    }

    public static synchronized void setTitle(String username, String text, String color, boolean bold) {
        String titleStr = (color != null ? color : "") + (bold ? "§l" : "") + text;
        unlockTitle(username, titleStr);
        setActiveTitle(username, titleStr);
    }
}
