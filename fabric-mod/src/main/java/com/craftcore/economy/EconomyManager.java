package com.craftcore.economy;

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

public class EconomyManager {
    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static class PlayerData {
        public double balance = 0.0;
        public int stonesSoldToday = 0;
        public int trashSoldToday = 0;
        public String lastResetDate = "";
        public int upgradedShopSlots = 0;
    }

    private static Map<String, PlayerData> dataMap = new ConcurrentHashMap<>();
    private static String currentDateOverride = null;

    static {
        try {
            configPath = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir()
                    .resolve("craft-core-shop").resolve("economy.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "economy.json");
        }
        load();
    }

    public static synchronized void setConfigPath(Path path) {
        configPath = path;
        load();
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Map<String, PlayerData> loaded = GSON.fromJson(reader, new TypeToken<Map<String, PlayerData>>(){}.getType());
                if (loaded != null) {
                    dataMap = new ConcurrentHashMap<>(loaded);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load economy: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            try {
                Files.createDirectories(configPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                    GSON.toJson(dataMap, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save economy: " + e.getMessage());
            }
        }
    }

    public static synchronized void clearAll() {
        dataMap.clear();
        save();
    }

    public static synchronized java.util.List<java.util.Map.Entry<String, PlayerData>> getTopWealthPlayers(int limit) {
        java.util.List<java.util.Map.Entry<String, PlayerData>> sorted = new java.util.ArrayList<>(dataMap.entrySet());
        sorted.sort((e1, e2) -> Double.compare(e2.getValue().balance, e1.getValue().balance));
        if (sorted.size() > limit) {
            return sorted.subList(0, limit);
        }
        return sorted;
    }

    public static void setCurrentDateOverride(String date) {
        currentDateOverride = date;
    }

    private static String getCurrentDate() {
        return currentDateOverride != null ? currentDateOverride : java.time.LocalDate.now().toString();
    }

    private static PlayerData getOrCreate(String username) {
        PlayerData data = dataMap.computeIfAbsent(username, k -> new PlayerData());
        String today = getCurrentDate();
        if (!today.equals(data.lastResetDate)) {
            data.stonesSoldToday = 0;
            data.trashSoldToday = 0;
            data.lastResetDate = today;
        }
        return data;
    }

    public static synchronized double getBalance(String username) {
        PlayerData data = getOrCreate(username);
        return data.balance;
    }

    public static synchronized void setBalance(String username, double amount) {
        PlayerData data = getOrCreate(username);
        data.balance = Math.max(0, amount);
        save();
    }

    public static synchronized boolean addMoney(String username, double amount) {
        if (username == null || username.trim().isEmpty()) return false;
        if (amount <= 0) return false;
        PlayerData data = getOrCreate(username);
        data.balance += amount;
        save();
        return true;
    }

    public static synchronized boolean removeMoney(String username, double amount) {
        if (username == null || username.trim().isEmpty()) return false;
        if (amount <= 0) return false;
        PlayerData data = getOrCreate(username);
        if (data.balance < amount) {
            return false;
        }
        data.balance -= amount;
        save();
        return true;
    }

    public static synchronized int getUpgradedShopSlots(String username) {
        PlayerData data = getOrCreate(username);
        return data.upgradedShopSlots;
    }

    public static synchronized void incrementUpgradedShopSlots(String username) {
        PlayerData data = getOrCreate(username);
        data.upgradedShopSlots++;
        save();
    }

    public static int getUpgradeCost(int currentLimit) {
        int nextSlot = currentLimit + 1;
        if (nextSlot <= 20) {
            return 10000;
        } else if (nextSlot <= 25) {
            return 25000;
        } else {
            return 50000;
        }
    }

    public static synchronized boolean upgradeShopLimit(String username) {
        if (username == null || username.trim().isEmpty()) return false;
        int currentSlots = 15 + getUpgradedShopSlots(username);
        double cost = getUpgradeCost(currentSlots);
        double balance = getBalance(username);
        if (balance < cost) {
            return false;
        }
        if (removeMoney(username, cost)) {
            incrementUpgradedShopSlots(username);
            return true;
        }
        return false;
    }

    public static synchronized int getDailyStonesSold(String username) {
        PlayerData data = getOrCreate(username);
        return data.stonesSoldToday;
    }

    public static synchronized int getDailyTrashSold(String username) {
        PlayerData data = getOrCreate(username);
        return data.trashSoldToday;
    }

    public static synchronized void resetDailyLimits(String username) {
        PlayerData data = getOrCreate(username);
        data.stonesSoldToday = 0;
        data.trashSoldToday = 0;
        save();
    }

    private static void incrementDailyStonesSold(String username, int amount) {
        PlayerData data = getOrCreate(username);
        data.stonesSoldToday += amount;
        save();
    }

    private static void incrementDailyTrashSold(String username, int amount) {
        PlayerData data = getOrCreate(username);
        data.trashSoldToday += amount;
        save();
    }

    public static boolean isStone(String itemId) {
        if (itemId == null) return false;
        String clean = itemId.replace("minecraft:", "").toLowerCase();
        return clean.equals("stone") || clean.equals("cobblestone") || clean.equals("deepslate")
            || clean.equals("cobbled_deepslate") || clean.equals("diorite") || clean.equals("granite")
            || clean.equals("andesite") || clean.equals("polished_deepslate") || clean.equals("polished_diorite")
            || clean.equals("polished_granite") || clean.equals("polished_andesite");
    }

    public static class SellResult {
        public final int soldCount;
        public final double moneyEarned;
        public final int rejectedCount;

        public SellResult(int soldCount, double moneyEarned, int rejectedCount) {
            this.soldCount = soldCount;
            this.moneyEarned = moneyEarned;
            this.rejectedCount = rejectedCount;
        }
    }

    public static synchronized SellResult sellItem(String username, String itemId, int amount) {
        if (amount <= 0) {
            return new SellResult(0, 0, amount);
        }
        double rate = 0;
        boolean isStone = false;
        boolean isTrash = false;
        
        String cleanId = itemId.contains(":") ? itemId.toLowerCase() : "minecraft:" + itemId.toLowerCase();
        switch (cleanId) {
            case "minecraft:coal":
                rate = 10;
                break;
            case "minecraft:copper_ingot":
                rate = 20;
                break;
            case "minecraft:iron_ingot":
                rate = 50;
                break;
            case "minecraft:diamond":
                rate = 500;
                break;
            case "minecraft:netherite_scrap":
                rate = 2000;
                break;
            default:
                if (isStone(cleanId)) {
                    rate = 2;
                    isStone = true;
                } else {
                    rate = 0.5;
                    isTrash = true;
                }
                break;
        }
        
        int limitRemaining = Integer.MAX_VALUE;
        if (isStone) {
            limitRemaining = 80 - getDailyStonesSold(username);
        } else if (isTrash) {
            limitRemaining = 80 - getDailyTrashSold(username);
        }
        
        if (limitRemaining <= 0 && (isStone || isTrash)) {
            return new SellResult(0, 0, amount);
        }
        
        int toSell = Math.min(amount, limitRemaining);
        int rejected = amount - toSell;
        double earned = toSell * rate;
        
        if (toSell > 0) {
            if (isStone) {
                incrementDailyStonesSold(username, toSell);
            } else if (isTrash) {
                incrementDailyTrashSold(username, toSell);
            }
            addMoney(username, earned);
        }
        
        return new SellResult(toSell, earned, rejected);
    }
}
