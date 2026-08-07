package com.craftcore.economy;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.minecraft.server.level.ServerPlayer;
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
        public int dailyTaskSlayProgress = 0;
        public int dailyTaskGatherProgress = 0;
        public boolean dailyTaskSlayClaimed = false;
        public boolean dailyTaskGatherClaimed = false;
        public int lotteryKeys = 0;
        public String dailyTaskDate = "";
        public String uuid = "";
        public double dailyPaidAmount = 0.0;
        public java.util.List<String> offlineNotifications = new java.util.ArrayList<>();
    }

    private static Map<String, PlayerData> dataMap = new ConcurrentHashMap<>();
    private static String currentDateOverride = null;

    static {
        try {
            configPath = com.craftcore.util.FabricPathUtil.getShopConfigDir().resolve("economy.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "economy.json");
        }
        load();
    }

    public static synchronized void setConfigPath(Path path) {
        com.craftcore.util.AsyncSaveExecutor.flush();
        configPath = path;
        load();
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Map<String, PlayerData> loaded = GSON.fromJson(reader, new TypeToken<Map<String, PlayerData>>(){}.getType());
                if (loaded != null) {
                    ConcurrentHashMap<String, PlayerData> merged = new ConcurrentHashMap<>();
                    for (Map.Entry<String, PlayerData> entry : loaded.entrySet()) {
                        String key = entry.getKey();
                        PlayerData value = entry.getValue();
                        if (key == null || value == null) continue;
                        
                        String matchKey = null;
                        for (String existingKey : merged.keySet()) {
                            if (existingKey.equalsIgnoreCase(key)) {
                                matchKey = existingKey;
                                break;
                            }
                        }
                        
                        if (matchKey == null) {
                            merged.put(key, value);
                        } else {
                            PlayerData existingVal = merged.get(matchKey);
                            existingVal.balance += value.balance;
                            existingVal.stonesSoldToday = Math.max(existingVal.stonesSoldToday, value.stonesSoldToday);
                            existingVal.trashSoldToday = Math.max(existingVal.trashSoldToday, value.trashSoldToday);
                            existingVal.upgradedShopSlots = Math.max(existingVal.upgradedShopSlots, value.upgradedShopSlots);
                            existingVal.dailyTaskSlayProgress = Math.max(existingVal.dailyTaskSlayProgress, value.dailyTaskSlayProgress);
                            existingVal.dailyTaskGatherProgress = Math.max(existingVal.dailyTaskGatherProgress, value.dailyTaskGatherProgress);
                            existingVal.dailyTaskSlayClaimed = existingVal.dailyTaskSlayClaimed || value.dailyTaskSlayClaimed;
                            existingVal.dailyTaskGatherClaimed = existingVal.dailyTaskGatherClaimed || value.dailyTaskGatherClaimed;
                            existingVal.lotteryKeys += value.lotteryKeys;
                            existingVal.dailyPaidAmount += value.dailyPaidAmount;
                            if (existingVal.uuid == null || existingVal.uuid.isEmpty()) {
                                existingVal.uuid = value.uuid;
                            }
                            if (value.offlineNotifications != null) {
                                if (existingVal.offlineNotifications == null) {
                                    existingVal.offlineNotifications = new java.util.ArrayList<>();
                                }
                                for (String notif : value.offlineNotifications) {
                                    if (!existingVal.offlineNotifications.contains(notif)) {
                                        existingVal.offlineNotifications.add(notif);
                                    }
                                }
                            }
                        }
                    }
                    dataMap = merged;
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load economy: " + e.getMessage());
            }
        }
    }

    private static final Object SAVE_LOCK = new Object();

    public static void save() {
        if (configPath != null) {
            com.craftcore.util.AsyncSaveExecutor.submit(() -> {
                synchronized (SAVE_LOCK) {
                    try {
                        Path parent = configPath.getParent();
                        if (parent != null) {
                            Files.createDirectories(parent);
                        }
                        Path tempPath = configPath.resolveSibling(configPath.getFileName() + ".tmp");
                        try (BufferedWriter writer = Files.newBufferedWriter(tempPath)) {
                            GSON.toJson(dataMap, writer);
                        }
                        try {
                            Files.move(tempPath, configPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                        } catch (IOException moveEx) {
                            Files.move(tempPath, configPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                        }
                    } catch (IOException e) {
                        System.err.println("[CraftCore] Failed to save economy: " + e.getMessage());
                    }
                }
            });
        }
    }

    public static synchronized void clearAll() {
        com.craftcore.util.AsyncSaveExecutor.flush();
        dataMap.clear();
        save();
    }

    public static synchronized double getTotalMoney() {
        double total = 0.0;
        for (PlayerData data : dataMap.values()) {
            if (data != null && data.balance > 0) {
                total += data.balance;
            }
        }
        return total;
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

    public static String getCurrentDateOverride() {
        return currentDateOverride;
    }

    public static String getTaipeiDate() {
        if (currentDateOverride != null) {
            return currentDateOverride;
        }
        return java.time.ZonedDateTime.now(java.time.ZoneId.of("Asia/Taipei")).toLocalDate().toString();
    }

    private static String getCurrentDate() {
        return currentDateOverride != null ? currentDateOverride : java.time.LocalDate.now().toString();
    }

    private static PlayerData getOrCreate(String username) {
        String correctKey = username;
        if (username != null) {
            String cleanTarget = username.replaceAll("^\\.", "").toLowerCase();
            for (String key : dataMap.keySet()) {
                String cleanKey = key.replaceAll("^\\.", "").toLowerCase();
                if (cleanKey.equals(cleanTarget)) {
                    correctKey = key;
                    break;
                }
            }
        }
        PlayerData data = dataMap.computeIfAbsent(correctKey, k -> new PlayerData());
        if (data.offlineNotifications == null) {
            data.offlineNotifications = new java.util.ArrayList<>();
        }
        if (data.uuid == null) {
            data.uuid = "";
        }
        String today = getCurrentDate();
        if (!today.equals(data.lastResetDate)) {
            data.stonesSoldToday = 0;
            data.trashSoldToday = 0;
            data.dailyPaidAmount = 0.0;
            data.lastResetDate = today;
        }
        String todayTaipei = getTaipeiDate();
        if (!todayTaipei.equals(data.dailyTaskDate)) {
            data.dailyTaskSlayProgress = 0;
            data.dailyTaskGatherProgress = 0;
            data.dailyTaskSlayClaimed = false;
            data.dailyTaskGatherClaimed = false;
            data.dailyTaskDate = todayTaipei;
        }
        return data;
    }

    public static synchronized int getDailyTaskSlayProgress(String username) {
        PlayerData data = getOrCreate(username);
        return data.dailyTaskSlayProgress;
    }

    public static synchronized int getDailyTaskGatherProgress(String username) {
        PlayerData data = getOrCreate(username);
        return data.dailyTaskGatherProgress;
    }

    public static synchronized boolean getDailyTaskSlayClaimed(String username) {
        PlayerData data = getOrCreate(username);
        return data.dailyTaskSlayClaimed;
    }

    public static synchronized boolean getDailyTaskGatherClaimed(String username) {
        PlayerData data = getOrCreate(username);
        return data.dailyTaskGatherClaimed;
    }

    public static synchronized void setDailyTaskSlayClaimed(String username, boolean claimed) {
        PlayerData data = getOrCreate(username);
        data.dailyTaskSlayClaimed = claimed;
        save();
    }

    public static synchronized void setDailyTaskGatherClaimed(String username, boolean claimed) {
        PlayerData data = getOrCreate(username);
        data.dailyTaskGatherClaimed = claimed;
        save();
    }

    public static synchronized int getLotteryKeys(String username) {
        PlayerData data = getOrCreate(username);
        return data.lotteryKeys;
    }

    public static synchronized void setLotteryKeys(String username, int keys) {
        PlayerData data = getOrCreate(username);
        data.lotteryKeys = Math.max(0, keys);
        save();
    }

    public static synchronized String getUUID(String username) {
        PlayerData data = getOrCreate(username);
        return data.uuid != null ? data.uuid : "";
    }

    public static synchronized void incrementDailyTaskSlayProgress(String username, int amount) {
        PlayerData data = getOrCreate(username);
        data.dailyTaskSlayProgress += amount;
        save();
    }

    public static synchronized void incrementDailyTaskGatherProgress(String username, int amount) {
        PlayerData data = getOrCreate(username);
        data.dailyTaskGatherProgress += amount;
        save();
    }

    private static final Map<String, java.util.concurrent.locks.ReentrantLock> playerLocks = new ConcurrentHashMap<>();

    public static java.util.concurrent.locks.ReentrantLock getPlayerLock(String username) {
        String key = username != null ? username.toLowerCase() : "";
        return playerLocks.computeIfAbsent(key, k -> new java.util.concurrent.locks.ReentrantLock());
    }

    public static double round2(double val) {
        return Math.round(val * 100.0) / 100.0;
    }

    public static synchronized double getBalance(String username) {
        PlayerData data = getOrCreate(username);
        return round2(data.balance);
    }

    public static synchronized void setBalance(String username, double amount) {
        PlayerData data = getOrCreate(username);
        data.balance = Math.max(0, round2(amount));
        save();
    }

    public static synchronized boolean addMoney(String username, double amount) {
        if (username == null || username.trim().isEmpty()) return false;
        if (amount <= 0) return false;
        java.util.concurrent.locks.ReentrantLock lock = getPlayerLock(username);
        lock.lock();
        try {
            PlayerData data = getOrCreate(username);
            data.balance = round2(data.balance + round2(amount));
            save();
            if (com.craftcore.event.ServerLifecycleHandler.serverInstance != null) {
                net.minecraft.server.MinecraftServer srv = com.craftcore.event.ServerLifecycleHandler.serverInstance;
                srv.execute(() -> {
                    ServerPlayer player = srv.getPlayerList().getPlayerByName(username);
                    if (player != null) {
                        com.craftcore.task.AiDailyTaskManager.updateProgress(player, "EARN", "craftcore:money", (int) amount);
                    }
                });
            }
            return true;
        } finally {
            lock.unlock();
        }
    }

    public static synchronized boolean removeMoney(String username, double amount) {
        if (username == null || username.trim().isEmpty()) return false;
        if (amount <= 0) return false;
        java.util.concurrent.locks.ReentrantLock lock = getPlayerLock(username);
        lock.lock();
        try {
            PlayerData data = getOrCreate(username);
            double roundedAmount = round2(amount);
            if (round2(data.balance) < roundedAmount) {
                return false;
            }
            data.balance = round2(data.balance - roundedAmount);
            save();
            return true;
        } finally {
            lock.unlock();
        }
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

    public static double DAILY_TRANSFER_LIMIT = 50000.0;

    public static class TransferResult {
        public final boolean success;
        public final String message;
        public TransferResult(boolean success, String message) {
            this.success = success;
            this.message = message;
        }
    }

    public static synchronized String getActualUsernameCaseInsensitive(String username) {
        if (username == null) return null;
        String cleanTarget = username.replaceAll("^\\.", "").toLowerCase();
        for (String key : dataMap.keySet()) {
            String cleanKey = key.replaceAll("^\\.", "").toLowerCase();
            if (cleanKey.equals(cleanTarget)) {
                return key;
            }
        }
        return null;
    }

    public static synchronized void handlePlayerLogin(String username, String uuid) {
        if (username == null || uuid == null) return;
        String oldUsername = null;
        PlayerData dataToMigrate = null;
        for (Map.Entry<String, PlayerData> entry : dataMap.entrySet()) {
            PlayerData pd = entry.getValue();
            if (pd.uuid != null && pd.uuid.equalsIgnoreCase(uuid)) {
                if (!entry.getKey().equalsIgnoreCase(username)) {
                    oldUsername = entry.getKey();
                    dataToMigrate = pd;
                    break;
                }
            }
        }
        if (dataToMigrate != null) {
            dataMap.remove(oldUsername);
            dataMap.put(username, dataToMigrate);
            dataToMigrate.uuid = uuid;
            save();
            System.out.println("[CraftCore] Migrated data for UUID " + uuid + " from " + oldUsername + " to " + username);
        } else {
            PlayerData pd = getOrCreate(username);
            pd.uuid = uuid;
            save();
        }
    }

    public static synchronized void checkAndDeliverOfflineNotifications(net.minecraft.server.level.ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();
        PlayerData data = dataMap.get(username);
        if (data != null && data.offlineNotifications != null && !data.offlineNotifications.isEmpty()) {
            for (String msg : data.offlineNotifications) {
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal(msg));
            }
            data.offlineNotifications.clear();
            save();
        }
    }

    public static TransferResult transferMoney(String sender, String recipient, double amount, boolean recipientOnline) {
        if (sender == null || recipient == null) {
            return new TransferResult(false, "轉帳失敗：付款者或收款者無效。");
        }
        if (amount < 0.01) {
            return new TransferResult(false, "轉帳金額不可小於 0.01。");
        }
        if (Double.isNaN(amount) || Double.isInfinite(amount)) {
            return new TransferResult(false, "轉帳金額無效。");
        }
        String cleanSender = sender.replaceAll("^\\.", "").toLowerCase();
        String cleanRecipient = recipient.replaceAll("^\\.", "").toLowerCase();
        if (cleanSender.equals(cleanRecipient)) {
            return new TransferResult(false, "不能轉帳給自己。");
        }

        // Deterministically order locks alphabetically to prevent deadlocks
        String firstUser = cleanSender.compareTo(cleanRecipient) < 0 ? cleanSender : cleanRecipient;
        String secondUser = cleanSender.compareTo(cleanRecipient) < 0 ? cleanRecipient : cleanSender;

        java.util.concurrent.locks.ReentrantLock lock1 = getPlayerLock(firstUser);
        java.util.concurrent.locks.ReentrantLock lock2 = getPlayerLock(secondUser);

        lock1.lock();
        lock2.lock();
        try {
            double roundedAmount = round2(amount);
            PlayerData senderData = getOrCreate(sender);

            if (round2(senderData.balance) < roundedAmount) {
                return new TransferResult(false, "餘額不足 (目前餘額 $" + String.format("%.2f", round2(senderData.balance)) + ")。");
            }

            String today = getCurrentDate();
            if (!today.equals(senderData.lastResetDate)) {
                senderData.stonesSoldToday = 0;
                senderData.trashSoldToday = 0;
                senderData.dailyPaidAmount = 0.0;
                senderData.lastResetDate = today;
            }

            if (round2(senderData.dailyPaidAmount + roundedAmount) > DAILY_TRANSFER_LIMIT) {
                return new TransferResult(false, "超出每日轉帳限制，今日還能轉帳 $" + String.format("%.2f", round2(DAILY_TRANSFER_LIMIT - senderData.dailyPaidAmount)) + "。");
            }

            String actualRecipient = getActualUsernameCaseInsensitive(recipient);
            if (!recipientOnline && actualRecipient == null) {
                return new TransferResult(false, "轉帳失敗：找不到該離線玩家紀錄。");
            }

            String recipientKey = actualRecipient != null ? actualRecipient : recipient;
            PlayerData recipientData = getOrCreate(recipientKey);

            // Atomic money deduction, daily paid increment, and recipient balance addition with round2 precision
            senderData.balance = round2(senderData.balance - roundedAmount);
            senderData.dailyPaidAmount = round2(senderData.dailyPaidAmount + roundedAmount);
            recipientData.balance = round2(recipientData.balance + roundedAmount);

            if (!recipientOnline) {
                if (recipientData.offlineNotifications == null) {
                    recipientData.offlineNotifications = new java.util.ArrayList<>();
                }
                recipientData.offlineNotifications.add("§b[Craft-Core] §f您在離線期間收到了來自 §a" + sender + " §f的轉帳：§a$" + String.format("%.2f", roundedAmount) + "§f！");
            }

            save();
            return new TransferResult(true, "已成功轉帳 $" + String.format("%.2f", roundedAmount) + " 給 " + recipientKey + "。");
        } finally {
            lock2.unlock();
            lock1.unlock();
        }
    }

    public static TransferResult transferMoney(String sender, String recipient, double amount) {
        return transferMoney(sender, recipient, amount, false);
    }
}
