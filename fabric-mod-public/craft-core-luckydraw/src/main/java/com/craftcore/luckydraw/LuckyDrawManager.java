package com.craftcore.luckydraw;

import com.craftcore.api.JsonDataStore;
import com.craftcore.economy.EconomyManager;
import com.google.gson.reflect.TypeToken;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class LuckyDrawManager {

    private static Map<String, Integer> keyMap = new ConcurrentHashMap<>();
    private static final String DATA_FILE = "keys.json";

    public static class PrizeEntry {
        public final Item item;
        public final int amount;
        public final String displayName;
        public final int weight;

        public PrizeEntry(Item item, int amount, String displayName, int weight) {
            this.item = item;
            this.amount = amount;
            this.displayName = displayName;
            this.weight = weight;
        }
    }

    private static List<PrizeEntry> prizePool = null;

    public static synchronized List<PrizeEntry> getPrizePool() {
        if (prizePool == null) {
            prizePool = List.of(
                new PrizeEntry(Items.DIAMOND, 1, "§b鑽石", 15),
                new PrizeEntry(Items.NETHERITE_INGOT, 1, "§d獄髓錠", 5),
                new PrizeEntry(Items.GOLDEN_APPLE, 2, "§e金蘋果", 20),
                new PrizeEntry(Items.EXPERIENCE_BOTTLE, 16, "§a經驗之瓶", 25),
                new PrizeEntry(Items.TOTEM_OF_UNDYING, 1, "§6不死圖騰", 5),
                new PrizeEntry(Items.GOLDEN_CARROT, 16, "§e金胡蘿蔔", 30),
                new PrizeEntry(Items.IRON_INGOT, 8, "§f鐵錠", 40),
                new PrizeEntry(Items.GOLD_INGOT, 8, "§6金錠", 30),
                new PrizeEntry(Items.EMERALD, 4, "§a綠寶石", 20)
            );
        }
        return prizePool;
    }

    private static final Random random = new Random();

    public static synchronized void load() {
        try {
            Map<String, Integer> loaded = JsonDataStore.loadData(
                DATA_FILE,
                new TypeToken<Map<String, Integer>>() {},
                new HashMap<>()
            );
            if (loaded != null) {
                keyMap = new ConcurrentHashMap<>(loaded);
            }
        } catch (Throwable t) {
            System.err.println("[CraftCoreLuckydraw] Failed to load keys.json: " + t.getMessage());
        }
    }

    public static synchronized void save() {
        try {
            JsonDataStore.saveDataAsync(DATA_FILE, keyMap);
        } catch (Throwable t) {
            System.err.println("[CraftCoreLuckydraw] Failed to save keys.json: " + t.getMessage());
        }
    }

    public static synchronized int getKeys(String username) {
        if (username == null) return 0;
        int keysInMap = keyMap.getOrDefault(username.toLowerCase(), 0);
        int keysInEco = EconomyManager.getLotteryKeys(username);
        int maxKeys = Math.max(keysInMap, keysInEco);
        keyMap.put(username.toLowerCase(), maxKeys);
        return maxKeys;
    }

    public static synchronized void setKeys(String username, int keys) {
        if (username == null) return;
        int safeKeys = Math.max(0, keys);
        keyMap.put(username.toLowerCase(), safeKeys);
        EconomyManager.setLotteryKeys(username, safeKeys);
        save();
    }

    public static synchronized boolean addKeys(String username, int amount) {
        if (username == null || amount <= 0) return false;
        int current = getKeys(username);
        setKeys(username, current + amount);
        return true;
    }

    public static synchronized boolean removeKeys(String username, int amount) {
        if (username == null || amount <= 0) return false;
        int current = getKeys(username);
        if (current < amount) return false;
        setKeys(username, current - amount);
        return true;
    }

    public static PrizeEntry rollRandomPrize() {
        List<PrizeEntry> pool = getPrizePool();
        int totalWeight = 0;
        for (PrizeEntry p : pool) {
            totalWeight += p.weight;
        }
        int randVal = random.nextInt(totalWeight);
        int current = 0;
        for (PrizeEntry p : pool) {
            current += p.weight;
            if (randVal < current) {
                return p;
            }
        }
        return pool.get(0);
    }

    public static void givePrizeToPlayer(ServerPlayer player, PrizeEntry prize) {
        if (player == null || prize == null) return;
        ItemStack stack = new ItemStack(prize.item, prize.amount);
        boolean added = player.getInventory().add(stack);
        if (!added || !stack.isEmpty()) {
            ItemEntity entity = player.drop(stack, false);
            if (entity != null) {
                entity.setNoPickUpDelay();
            }
        }
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(),
                SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 1.0f, 1.0f);
    }

    public static void performBatchDraw(ServerPlayer player, int requestedCount) {
        if (player == null) return;
        String username = player.getName().getString();
        int availableKeys = getKeys(username);

        if (availableKeys <= 0) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 抽獎鑰匙不足！無法進行抽獎。"));
            return;
        }

        int drawCount = Math.min(availableKeys, requestedCount > 0 ? requestedCount : availableKeys);
        if (drawCount <= 0) return;

        removeKeys(username, drawCount);

        Map<String, Integer> summary = new LinkedHashMap<>();
        for (int i = 0; i < drawCount; i++) {
            PrizeEntry prize = rollRandomPrize();
            givePrizeToPlayer(player, prize);
            int count = summary.getOrDefault(prize.displayName, 0) + prize.amount;
            summary.put(prize.displayName, count);
        }

        player.level().playSound(null, player.getX(), player.getY(), player.getZ(),
                SoundEvents.UI_STONECUTTER_TAKE_RESULT, SoundSource.PLAYERS, 1.0f, 1.2f);

        player.sendSystemMessage(Component.literal("§6=================== 🎰 幸運大抽獎結算 (" + drawCount + " 連抽) ==================="));
        for (Map.Entry<String, Integer> entry : summary.entrySet()) {
            player.sendSystemMessage(Component.literal("§f- 獲得 " + entry.getKey() + " §e" + entry.getValue() + " §f個"));
        }
        player.sendSystemMessage(Component.literal("§6=========================================================="));
    }
}
