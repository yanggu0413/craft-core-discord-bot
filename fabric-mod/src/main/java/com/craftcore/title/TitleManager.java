package com.craftcore.title;

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

public class TitleManager {

    public static class TitleData {
        public String titleText;
        public String colorCode; // e.g. "§c", "§6", "§b", "§d", "§a", "§e", "§f"
        public boolean isBold;

        public TitleData(String titleText, String colorCode, boolean isBold) {
            this.titleText = titleText;
            this.colorCode = colorCode != null ? colorCode : "§c";
            this.isBold = isBold;
        }

        public String getFormattedPrefix() {
            if (titleText == null || titleText.trim().isEmpty()) {
                return "";
            }
            String cleanText = titleText.trim();
            if (!cleanText.startsWith("[")) {
                cleanText = "[" + cleanText;
            }
            if (!cleanText.endsWith("]")) {
                cleanText = cleanText + "]";
            }
            String color = colorCode != null ? colorCode : "§c";
            String boldStr = isBold ? "§l" : "";
            return color + boldStr + cleanText + "§r ";
        }
    }

    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, TitleData> titlesMap = new ConcurrentHashMap<>();

    static {
        try {
            configPath = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir()
                    .resolve("craft-core-shop").resolve("titles.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "titles.json");
        }
        load();

        // Default fallback: im_little_rory => §c§l[服主]
        if (!titlesMap.containsKey("im_little_rory")) {
            titlesMap.put("im_little_rory", new TitleData("[服主]", "§c", true));
            save();
        }
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Map<String, TitleData> loaded = GSON.fromJson(reader, new TypeToken<Map<String, TitleData>>(){}.getType());
                if (loaded != null) {
                    titlesMap.clear();
                    for (Map.Entry<String, TitleData> entry : loaded.entrySet()) {
                        if (entry.getKey() != null && entry.getValue() != null) {
                            titlesMap.put(entry.getKey().toLowerCase(), entry.getValue());
                        }
                    }
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load titles.json: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            try {
                Files.createDirectories(configPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                    GSON.toJson(titlesMap, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save titles.json: " + e.getMessage());
            }
        }
    }

    public static synchronized String getTitlePrefix(String username) {
        if (username == null) return "";
        TitleData data = titlesMap.get(username.toLowerCase());
        if (data != null) {
            return data.getFormattedPrefix();
        }
        return "";
    }

    public static synchronized void setTitle(String username, String titleText, String colorCode, boolean isBold) {
        if (username == null || username.trim().isEmpty()) return;
        String key = username.toLowerCase();
        if (titleText == null || titleText.trim().isEmpty()) {
            titlesMap.remove(key);
        } else {
            titlesMap.put(key, new TitleData(titleText.trim(), colorCode, isBold));
        }
        save();
    }

    public static synchronized void removeTitle(String username) {
        if (username == null) return;
        titlesMap.remove(username.toLowerCase());
        save();
    }

    public static synchronized Map<String, TitleData> getAllTitles() {
        return new ConcurrentHashMap<>(titlesMap);
    }
}
