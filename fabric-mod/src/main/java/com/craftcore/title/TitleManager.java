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
        public Map<String, String> titleExpiries = new HashMap<>();

        public PlayerTitleData() {}
    }

    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, PlayerTitleData> playerTitles = new ConcurrentHashMap<>();

    static {
        try {
            configPath = com.craftcore.util.FabricPathUtil.getShopConfigDir().resolve("titles.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "titles.json");
        }
        load();
    }

    public static synchronized void checkExpiries(String username) {
        if (username == null) return;
        String key = username.toLowerCase();
        PlayerTitleData data = playerTitles.get(key);
        if (data == null || data.titleExpiries == null || data.titleExpiries.isEmpty()) return;

        String nowIso = java.time.Instant.now().toString();
        List<String> expired = new ArrayList<>();
        for (Map.Entry<String, String> entry : data.titleExpiries.entrySet()) {
            if (entry.getValue() != null && entry.getValue().compareTo(nowIso) <= 0) {
                expired.add(entry.getKey());
            }
        }

        if (!expired.isEmpty()) {
            boolean modified = false;
            for (String title : expired) {
                data.unlockedTitles.remove(title);
                data.titleExpiries.remove(title);
                if (title.equals(data.activeTitle)) {
                    data.activeTitle = "";
                }
                modified = true;
            }
            if (modified) {
                save();
            }
        }
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Map<String, PlayerTitleData> loaded = GSON.fromJson(reader, new TypeToken<Map<String, PlayerTitleData>>(){}.getType());
                if (loaded != null) {
                    playerTitles.clear();
                    for (Map.Entry<String, PlayerTitleData> entry : loaded.entrySet()) {
                        PlayerTitleData data = entry.getValue();
                        if (data.titleExpiries == null) {
                            data.titleExpiries = new HashMap<>();
                        }
                        playerTitles.put(entry.getKey().toLowerCase(), data);
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
        checkExpiries(username);
        if (data.unlockedTitles.add(title)) {
            if (data.activeTitle == null || data.activeTitle.isEmpty()) {
                data.activeTitle = title;
            }
            save();
        }
    }

    public static synchronized String getActiveTitle(String username) {
        if (username == null) return "";
        checkExpiries(username);
        PlayerTitleData data = playerTitles.get(username.toLowerCase());
        return data != null && data.activeTitle != null ? data.activeTitle : "";
    }

    public static synchronized boolean setActiveTitle(String username, String title) {
        if (username == null) return false;
        String key = username.toLowerCase();
        checkExpiries(username);
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
        checkExpiries(username);
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

    public static String sanitizeTitleText(String text) {
        if (text == null) return "";
        String cleaned = text.replaceAll("(?i)§[kr]", "");
        if (cleaned.length() > 32) {
            cleaned = cleaned.substring(0, 32);
        }
        return cleaned;
    }

    public static synchronized void setTitle(String username, String text, String color, boolean bold) {
        String cleanText = sanitizeTitleText(text);
        String titleStr = (color != null ? color : "") + (bold ? "§l" : "") + cleanText;
        unlockTitle(username, titleStr);
        setActiveTitle(username, titleStr);
    }
}
