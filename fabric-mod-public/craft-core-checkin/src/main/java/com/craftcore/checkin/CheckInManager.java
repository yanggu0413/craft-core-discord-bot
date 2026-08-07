package com.craftcore.checkin;

import com.craftcore.api.JsonDataStore;
import com.craftcore.economy.EconomyManager;
import com.google.gson.reflect.TypeToken;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class CheckInManager {

    public static class CheckInRecord {
        public String username = "";
        public String uuid = "";
        public String lastCheckInDate = "";
        public int consecutiveStreak = 0;
        public int totalCheckIns = 0;
        public List<String> checkInHistory = new ArrayList<>();
    }

    private static Map<String, CheckInRecord> dataMap = new ConcurrentHashMap<>();
    private static final String DATA_FILE = "checkin.json";

    public static synchronized void load() {
        try {
            Map<String, CheckInRecord> loaded = JsonDataStore.loadData(
                DATA_FILE,
                new TypeToken<Map<String, CheckInRecord>>() {},
                new HashMap<>()
            );
            if (loaded != null) {
                dataMap = new ConcurrentHashMap<>(loaded);
            }
        } catch (Throwable t) {
            System.err.println("[CraftCoreCheckin] Failed to load checkin.json: " + t.getMessage());
        }
    }

    public static synchronized void save() {
        try {
            JsonDataStore.saveDataAsync(DATA_FILE, dataMap);
        } catch (Throwable t) {
            System.err.println("[CraftCoreCheckin] Failed to save checkin.json: " + t.getMessage());
        }
    }

    public static String getTaipeiDate() {
        return ZonedDateTime.now(ZoneId.of("Asia/Taipei")).toLocalDate().toString();
    }

    public static String getYesterdayTaipeiDate() {
        return ZonedDateTime.now(ZoneId.of("Asia/Taipei")).toLocalDate().minusDays(1).toString();
    }

    public static synchronized CheckInRecord getRecord(String username) {
        if (username == null) return new CheckInRecord();
        String key = username.toLowerCase();
        return dataMap.computeIfAbsent(key, k -> {
            CheckInRecord r = new CheckInRecord();
            r.username = username;
            return r;
        });
    }

    public static synchronized boolean hasCheckedInToday(String username) {
        CheckInRecord record = getRecord(username);
        return getTaipeiDate().equals(record.lastCheckInDate);
    }

    public static class CheckInResult {
        public final boolean success;
        public final String message;
        public final int streak;
        public final int total;
        public final double bonusMoney;
        public final int bonusKeys;

        public CheckInResult(boolean success, String message, int streak, int total, double bonusMoney, int bonusKeys) {
            this.success = success;
            this.message = message;
            this.streak = streak;
            this.total = total;
            this.bonusMoney = bonusMoney;
            this.bonusKeys = bonusKeys;
        }
    }

    public static synchronized CheckInResult performCheckIn(ServerPlayer player) {
        if (player == null) {
            return new CheckInResult(false, "玩家無效。", 0, 0, 0, 0);
        }

        String username = player.getName().getString();
        String uuid = player.getStringUUID();
        String today = getTaipeiDate();
        String yesterday = getYesterdayTaipeiDate();

        CheckInRecord record = getRecord(username);
        record.username = username;
        record.uuid = uuid;

        if (today.equals(record.lastCheckInDate)) {
            return new CheckInResult(
                false,
                "§c[Craft-Core] 您今日 (" + today + ") 已經完成過簽到囉！",
                record.consecutiveStreak,
                record.totalCheckIns,
                0,
                0
            );
        }

        if (yesterday.equals(record.lastCheckInDate)) {
            record.consecutiveStreak += 1;
        } else {
            record.consecutiveStreak = 1;
        }

        record.totalCheckIns += 1;
        record.lastCheckInDate = today;
        if (record.checkInHistory == null) {
            record.checkInHistory = new ArrayList<>();
        }
        if (!record.checkInHistory.contains(today)) {
            record.checkInHistory.add(today);
        }

        // Base reward
        double totalMoney = 150.0;
        int totalKeys = 1;

        // Bonus rewards
        double bonusMoney = 0;
        int bonusKeys = 0;

        if (record.consecutiveStreak == 7) {
            bonusKeys += 3;
        } else if (record.consecutiveStreak == 14) {
            bonusKeys += 3;
        } else if (record.consecutiveStreak == 21) {
            bonusMoney += 1000.0;
            bonusKeys += 3;
        } else if (record.consecutiveStreak >= 30) {
            bonusMoney += 1500.0;
            bonusKeys += 5;
        }

        totalMoney += bonusMoney;
        totalKeys += bonusKeys;

        EconomyManager.addMoney(username, totalMoney);
        int currentKeys = EconomyManager.getLotteryKeys(username);
        EconomyManager.setLotteryKeys(username, currentKeys + totalKeys);

        save();

        // Sound effect
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(),
                SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0f, 1.0f);

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("§a🎉 [每日簽到成功] §f連續簽到 §e%d§f 天（累計 §e%d§f 天）！\n", record.consecutiveStreak, record.totalCheckIns));
        sb.append(String.format("§a獲得基本獎勵：§d$%d 元金幣 §f+ §e%d 把抽獎鑰匙§a！", 150, 1));
        if (bonusMoney > 0 || bonusKeys > 0) {
            sb.append(String.format("\n§6🎁 解鎖里程碑加碼獎勵：§d+$%d 元 §f+ §e+%d 把鑰匙§6！", (int)bonusMoney, bonusKeys));
        }

        player.sendSystemMessage(Component.literal(sb.toString()));

        return new CheckInResult(true, sb.toString(), record.consecutiveStreak, record.totalCheckIns, bonusMoney, bonusKeys);
    }
}
