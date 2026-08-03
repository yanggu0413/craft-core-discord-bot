package com.craftcore.bounty;

import com.craftcore.title.TitleManager;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class GlobalGoalManager {

    public enum GoalType {
        KILL_MOBS,
        MINE_BLOCKS,
        SUBMIT_ITEMS
    }

    public static class GoalPreset {
        public GoalType goalType;
        public String title;
        public String targetItem;
        public int targetCount;

        public GoalPreset(GoalType goalType, String title, String targetItem, int targetCount) {
            this.goalType = goalType;
            this.title = title;
            this.targetItem = targetItem;
            this.targetCount = targetCount;
        }
    }

    public static final List<GoalPreset> PRESETS = List.of(
        new GoalPreset(GoalType.KILL_MOBS, "全服討伐狂歡：擊殺 3,000 隻怪物", "ANY_MOB", 3000),
        new GoalPreset(GoalType.MINE_BLOCKS, "全服採集狂歡：挖掘 5,000 個礦石/方塊", "ANY_ORE", 5000),
        new GoalPreset(GoalType.SUBMIT_ITEMS, "全服物資募集：籌集 100 組 鐵塊", "minecraft:iron_block", 6400),
        new GoalPreset(GoalType.SUBMIT_ITEMS, "全服物資募集：籌集 100 組 銅塊", "minecraft:copper_block", 6400),
        new GoalPreset(GoalType.SUBMIT_ITEMS, "全服物資募集：籌集 200 組 小麥", "minecraft:wheat", 12800),
        new GoalPreset(GoalType.SUBMIT_ITEMS, "全服物資募集：籌集 500 組 原石", "minecraft:cobblestone", 32000)
    );

    public static final int MIN_CONTRIBUTION_THRESHOLD = 50;

    public static class GoalData {
        public GoalType goalType = GoalType.KILL_MOBS;
        public String title = "全服討伐狂歡：擊殺 3,000 隻怪物";
        public String targetItem = "ANY_MOB";
        public int currentCount = 0;
        public int targetCount = 3000;
        public boolean completed = false;
        public long createdAt = System.currentTimeMillis();
        public long expiresAt = System.currentTimeMillis() + 7L * 24 * 3600 * 1000;
        public Map<String, Integer> contributions = new ConcurrentHashMap<>();
    }

    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static GoalData currentGoal = new GoalData();

    static {
        try {
            configPath = com.craftcore.util.FabricPathUtil.getShopConfigDir().resolve("global_goal.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "global_goal.json");
        }
        load();
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                GoalData loaded = GSON.fromJson(reader, GoalData.class);
                if (loaded != null) {
                    currentGoal = loaded;
                    if (currentGoal.goalType == null) currentGoal.goalType = GoalType.KILL_MOBS;
                    if (currentGoal.targetItem == null) currentGoal.targetItem = "ANY_MOB";
                    if (currentGoal.expiresAt <= 0) currentGoal.expiresAt = System.currentTimeMillis() + 7L * 24 * 3600 * 1000;
                }
            } catch (Exception e) {
                System.err.println("[CraftCore] Failed to load global_goal.json: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            try {
                Files.createDirectories(configPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                    GSON.toJson(currentGoal, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save global_goal.json: " + e.getMessage());
            }
        }
    }

    public static synchronized void checkExpirationAndRotate(MinecraftServer server) {
        if (System.currentTimeMillis() > currentGoal.expiresAt && !currentGoal.completed) {
            if (server != null) {
                server.getPlayerList().broadcastSystemMessage(
                    Component.literal("§c[全服狂歡] 上一期全服目標期限 (7天) 已結束！未能在期限內完成，現正啟動全新每週目標！"),
                    false
                );
            }
            rotateToNextGoal(server);
        }
    }

    public static synchronized void rotateToNextGoal(MinecraftServer server) {
        Random rand = new Random();
        GoalPreset preset = PRESETS.get(rand.nextInt(PRESETS.size()));
        GoalData newGoal = new GoalData();
        newGoal.goalType = preset.goalType;
        newGoal.title = preset.title;
        newGoal.targetItem = preset.targetItem;
        newGoal.currentCount = 0;
        newGoal.targetCount = preset.targetCount;
        newGoal.completed = false;
        newGoal.createdAt = System.currentTimeMillis();
        newGoal.expiresAt = System.currentTimeMillis() + 7L * 24 * 3600 * 1000;
        newGoal.contributions = new ConcurrentHashMap<>();

        currentGoal = newGoal;
        save();

        if (server != null) {
            String msg = String.format("§a🎉 [全服狂歡] 新一期 7 天全服目標開啟：「%s」！目標數量：%d！快輸入 /bounty 參與貢獻！",
                    newGoal.title, newGoal.targetCount);
            server.getPlayerList().broadcastSystemMessage(Component.literal(msg), false);
        }
    }

    public static synchronized void addContribution(MinecraftServer server, String username, int amount) {
        if (username == null || amount <= 0 || currentGoal.completed) return;
        checkExpirationAndRotate(server);
        if (currentGoal.completed) return;

        String key = username.toLowerCase();
        int current = currentGoal.contributions.getOrDefault(key, 0);
        currentGoal.contributions.put(key, current + amount);
        currentGoal.currentCount += amount;

        if (currentGoal.currentCount >= currentGoal.targetCount && !currentGoal.completed) {
            currentGoal.completed = true;
            triggerGoalCompletion(server);
        }
        save();
    }

    public static synchronized boolean submitHandItem(ServerPlayer player, int requestedAmount) {
        if (player == null || currentGoal.completed) return false;
        if (currentGoal.goalType != GoalType.SUBMIT_ITEMS) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 當前全服目標非「物資繳交」類型！"));
            return false;
        }

        ItemStack handStack = player.getMainHandItem();
        if (handStack.isEmpty()) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 請手持欲繳交的目標物資！"));
            return false;
        }

        String handItemId = BuiltInRegistries.ITEM.getKey(handStack.getItem()).toString();
        if (!handItemId.equalsIgnoreCase(currentGoal.targetItem)) {
            Item requiredItem = BuiltInRegistries.ITEM.getValue(Identifier.parse(currentGoal.targetItem));
            String reqName = (requiredItem != Items.AIR) ? Component.translatable(requiredItem.getDescriptionId()).getString() : currentGoal.targetItem;
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 物品不符！當前所需目標物資為: §e" + reqName));
            return false;
        }

        int countInHand = handStack.getCount();
        int toDeduct = Math.min(countInHand, requestedAmount > 0 ? requestedAmount : countInHand);
        int remainingNeeded = currentGoal.targetCount - currentGoal.currentCount;
        toDeduct = Math.min(toDeduct, remainingNeeded);

        if (toDeduct <= 0) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 當前全服物資已籌集完畢！"));
            return false;
        }

        handStack.shrink(toDeduct);
        String username = player.getName().getString();
        addContribution(player.level().getServer(), username, toDeduct);

        player.playSound(SoundEvents.EXPERIENCE_ORB_PICKUP, 1.0f, 1.0f);
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功繳交 §e" + toDeduct + " §a個物資！累積貢獻度: §e" + currentGoal.contributions.getOrDefault(username.toLowerCase(), 0)));
        return true;
    }

    private static void triggerGoalCompletion(MinecraftServer server) {
        if (server == null) return;
        String broadcastMsg = String.format("§a🎉 [全服狂歡] 全服共同目標「%s」已被全體玩家共同達成（%d / %d）！發放階梯式豪華大獎！",
                currentGoal.title, currentGoal.currentCount, currentGoal.targetCount);
        server.getPlayerList().broadcastSystemMessage(Component.literal(broadcastMsg), false);

        // Sort contributors descending
        List<Map.Entry<String, Integer>> sorted = new ArrayList<>(currentGoal.contributions.entrySet());
        sorted.sort((a, b) -> Integer.compare(b.getValue(), a.getValue()));

        int rank = 1;
        for (Map.Entry<String, Integer> entry : sorted) {
            String user = entry.getKey();
            int count = entry.getValue();

            if (rank == 1) {
                // Top 1: $5,000 + 5 keys + Title
                com.craftcore.economy.EconomyManager.addMoney(user, 5000.0);
                int k = com.craftcore.economy.EconomyManager.getLotteryKeys(user);
                com.craftcore.economy.EconomyManager.setLotteryKeys(user, k + 5);
                TitleManager.unlockTitle(user, "§c[⚔️ 全服英雄]");
                server.getPlayerList().broadcastSystemMessage(
                    Component.literal("§e👑 冠軍貢獻者 §f" + user + " §e貢獻了 " + count + " 個進度！榮獲 $5000 + 5 鑰匙 + 【⚔️ 全服英雄】稱號！"), false
                );
            } else if (rank <= 3) {
                // Top 2~3: $2,500 + 3 keys + Title
                com.craftcore.economy.EconomyManager.addMoney(user, 2500.0);
                int k = com.craftcore.economy.EconomyManager.getLotteryKeys(user);
                com.craftcore.economy.EconomyManager.setLotteryKeys(user, k + 3);
                TitleManager.unlockTitle(user, "§e[🛡️ 核心貢獻者]");
                server.getPlayerList().broadcastSystemMessage(
                    Component.literal("§6🥈 核心貢獻者 (第" + rank + "名) §f" + user + " §6貢獻了 " + count + " 個進度！榮獲 $2500 + 3 鑰匙 + 【🛡️ 核心貢獻者】稱號！"), false
                );
            } else if (count >= MIN_CONTRIBUTION_THRESHOLD) {
                // Normal qualified: $1,000 + 2 keys
                com.craftcore.economy.EconomyManager.addMoney(user, 1000.0);
                int k = com.craftcore.economy.EconomyManager.getLotteryKeys(user);
                com.craftcore.economy.EconomyManager.setLotteryKeys(user, k + 2);
            }
            rank++;
        }

        save();
    }

    public static synchronized String getTopContributor() {
        String topUser = null;
        int maxCount = -1;
        for (Map.Entry<String, Integer> entry : currentGoal.contributions.entrySet()) {
            if (entry.getValue() > maxCount) {
                maxCount = entry.getValue();
                topUser = entry.getKey();
            }
        }
        return topUser;
    }

    public static synchronized GoalData getCurrentGoal() {
        return currentGoal;
    }
}
