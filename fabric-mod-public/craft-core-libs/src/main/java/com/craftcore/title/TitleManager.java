package com.craftcore.title;

import com.craftcore.data.JsonDataStore;
import com.google.gson.reflect.TypeToken;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class TitleManager {

    public static class TitleData {
        public Map<String, Set<String>> unlockedTitles = new ConcurrentHashMap<>();
        public Map<String, String> activeTitles = new ConcurrentHashMap<>();
    }

    private static final String DATA_FILE = "titles.json";
    private static TitleData data;

    static {
        load();
    }

    public static synchronized void load() {
        data = JsonDataStore.loadData(DATA_FILE, TitleData.class, new TitleData());
        if (data.unlockedTitles == null) data.unlockedTitles = new ConcurrentHashMap<>();
        if (data.activeTitles == null) data.activeTitles = new ConcurrentHashMap<>();
    }

    public static synchronized void save() {
        JsonDataStore.saveDataAsync(DATA_FILE, data);
    }

    public static synchronized boolean unlockTitle(String username, String title) {
        if (username == null || title == null) return false;
        String key = username.toLowerCase();
        Set<String> titles = data.unlockedTitles.computeIfAbsent(key, k -> ConcurrentHashMap.newKeySet());
        boolean added = titles.add(title);
        if (added) {
            if (!data.activeTitles.containsKey(key)) {
                data.activeTitles.put(key, title);
            }
            save();
        }
        return added;
    }

    public static Set<String> getUnlockedTitles(String username) {
        if (username == null) return Collections.emptySet();
        Set<String> set = data.unlockedTitles.get(username.toLowerCase());
        return set != null ? new HashSet<>(set) : Collections.emptySet();
    }

    public static String getActiveTitle(String username) {
        if (username == null) return "";
        return data.activeTitles.getOrDefault(username.toLowerCase(), "");
    }

    public static synchronized void setActiveTitle(String username, String title) {
        if (username == null) return;
        String key = username.toLowerCase();
        if (title == null || title.isEmpty() || title.equalsIgnoreCase("none")) {
            data.activeTitles.remove(key);
        } else {
            data.activeTitles.put(key, title);
        }
        save();
    }

    public static String getTitlePrefix(String username) {
        String active = getActiveTitle(username);
        if (active != null && !active.isEmpty()) {
            return active + " ";
        }
        return "";
    }
}
