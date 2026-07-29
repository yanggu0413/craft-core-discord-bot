package com.craftcore.bounty;

import com.craftcore.title.TitleManager;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class GlobalGoalManager {

    public static class GoalData {
        public String title = "全服大狂歡：累積討伐怪物";
        public int currentCount = 0;
        public int targetCount = 3000;
        public boolean completed = false;
        public Map<String, Integer> contributions = new ConcurrentHashMap<>();
    }

    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static GoalData currentGoal = new GoalData();

    static {
        try {
            configPath = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir()
                    .resolve("craft-core-shop").resolve("global_goal.json");
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

    public static synchronized void addContribution(MinecraftServer server, String username, int amount) {
        if (username == null || amount <= 0 || currentGoal.completed) return;
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

    private static void triggerGoalCompletion(MinecraftServer server) {
        if (server == null) return;
        String broadcastMsg = String.format("§a🎉 [全服狂歡] 全服共同目標「%s」已被全體玩家共同達成（%d / %d）！所有參與玩家獲得 $1000 元金幣 + 2 把幸運鑰匙！",
                currentGoal.title, currentGoal.currentCount, currentGoal.targetCount);
        server.getPlayerList().broadcastSystemMessage(Component.literal(broadcastMsg), false);

        // Reward all contributors
        for (String user : currentGoal.contributions.keySet()) {
            com.craftcore.economy.EconomyManager.addMoney(user, 1000.0);
            int currentKeys = com.craftcore.economy.EconomyManager.getLotteryKeys(user);
            com.craftcore.economy.EconomyManager.setLotteryKeys(user, currentKeys + 2);
        }

        // Top contributor title
        String topContributor = getTopContributor();
        if (topContributor != null) {
            TitleManager.unlockTitle(topContributor, "§c[⚔️ 全服英雄]");
        }
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
