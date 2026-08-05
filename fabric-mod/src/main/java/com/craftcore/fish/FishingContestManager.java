package com.craftcore.fish;

import com.craftcore.economy.EconomyManager;
import com.craftcore.title.TitleManager;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerBossEvent;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.BossEvent;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.nbt.CompoundTag;

import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class FishingContestManager {

    public static class CaughtFish {
        public String playername;
        public String fishName;
        public double lengthCm;
        public double weightKg;
        public String timestamp;

        public CaughtFish(String playername, String fishName, double lengthCm, double weightKg, String timestamp) {
            this.playername = playername;
            this.fishName = fishName;
            this.lengthCm = lengthCm;
            this.weightKg = weightKg;
            this.timestamp = timestamp;
        }
    }

    public static class HallOfFameEntry {
        public String date;
        public String winnerName;
        public String fishName;
        public double lengthCm;

        public HallOfFameEntry(String date, String winnerName, String fishName, double lengthCm) {
            this.date = date;
            this.winnerName = winnerName;
            this.fishName = fishName;
            this.lengthCm = lengthCm;
        }
    }

    private static boolean active = false;
    private static int secondsRemaining = 0;
    private static final Map<String, Double> currentContestBestMap = new ConcurrentHashMap<>();
    private static final Map<String, Integer> currentContestCountMap = new ConcurrentHashMap<>();
    private static final List<CaughtFish> currentTopFishList = new ArrayList<>();
    private static final List<HallOfFameEntry> hallOfFame = new ArrayList<>();
    private static final Set<UUID> bossBarDisabledPlayers = ConcurrentHashMap.newKeySet();

    private static ServerBossEvent bossBar = null;
    private static ScheduledExecutorService scheduler = null;
    private static MinecraftServer serverInstance = null;

    public static boolean isActive() {
        return active;
    }

    public static int getSecondsRemaining() {
        return secondsRemaining;
    }

    public static Map<String, Double> getCurrentContestBestMap() {
        return currentContestBestMap;
    }

    public static List<CaughtFish> getCurrentTopFishList() {
        return currentTopFishList;
    }

    public static List<HallOfFameEntry> getHallOfFame() {
        return hallOfFame;
    }

    public static boolean isBossBarDisabled(UUID uuid) {
        return bossBarDisabledPlayers.contains(uuid);
    }

    public static void toggleBossBar(UUID uuid) {
        if (bossBarDisabledPlayers.contains(uuid)) {
            bossBarDisabledPlayers.remove(uuid);
        } else {
            bossBarDisabledPlayers.add(uuid);
            if (bossBar != null) {
                ServerPlayer p = serverInstance != null ? serverInstance.getPlayerList().getPlayer(uuid) : null;
                if (p != null) bossBar.removePlayer(p);
            }
        }
    }

    public static void startLoop(MinecraftServer server) {
        serverInstance = server;
        if (scheduler != null && !scheduler.isShutdown()) return;

        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(() -> {
            if (serverInstance == null) return;

            ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Taipei"));
            // Auto start at 20:00
            if (!active && now.getHour() == 20 && now.getMinute() == 0 && now.getSecond() == 0) {
                serverInstance.execute(() -> startContest(serverInstance, 20));
            }

            if (active) {
                secondsRemaining--;
                serverInstance.execute(FishingContestManager::tickContest);
            }
        }, 1, 1, TimeUnit.SECONDS);
    }

    public static void startContest(MinecraftServer server, int durationMinutes) {
        serverInstance = server;
        active = true;
        secondsRemaining = durationMinutes * 60;
        currentContestBestMap.clear();
        currentContestCountMap.clear();
        currentTopFishList.clear();

        if (bossBar != null) {
            bossBar.removeAllPlayers();
        }

        bossBar = new ServerBossEvent(
                UUID.randomUUID(),
                Component.literal("§b[🎣 釣魚大賽] §f倒數 " + formatTime(secondsRemaining) + " | 尚無榜單紀錄"),
                BossEvent.BossBarColor.BLUE,
                BossEvent.BossBarOverlay.PROGRESS
        );

        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            if (!bossBarDisabledPlayers.contains(player.getUUID())) {
                bossBar.addPlayer(player);
            }
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.UI_TOAST_CHALLENGE_COMPLETE, SoundSource.PLAYERS, 1.0f, 1.0f);
            player.sendSystemMessage(Component.literal("§e🎪================== 🎣 全服限時釣魚熱潮大賽開始！ ==================🎪"));
            player.sendSystemMessage(Component.literal("§f大賽時長：§a" + durationMinutes + " 分鐘 §f| 輸入 §b/fish §f開啟大賽即時排行榜！"));
            player.sendSystemMessage(Component.literal("§f釣起特產魚類比拼【單條最大長度 (cm)】，前三名將獲贈高額金幣、鑰匙與限時稱號 §b[釣聖]§f！"));
            player.sendSystemMessage(Component.literal("§e🎪========================================================================🎪"));
        }
    }

    private static void tickContest() {
        if (!active || serverInstance == null) return;

        if (secondsRemaining <= 0) {
            endContest();
            return;
        }

        // Update BossBar players
        if (bossBar != null) {
            for (ServerPlayer player : serverInstance.getPlayerList().getPlayers()) {
                if (!bossBarDisabledPlayers.contains(player.getUUID()) && !bossBar.getPlayers().contains(player)) {
                    bossBar.addPlayer(player);
                }
            }
            updateBossBarTitle();
        }
    }

    private static void updateBossBarTitle() {
        if (bossBar == null) return;
        StringBuilder sb = new StringBuilder();
        sb.append("§b[🎣 釣魚大賽] §f倒數 ").append(formatTime(secondsRemaining)).append(" | ");

        if (currentTopFishList.isEmpty()) {
            sb.append("§7尚無紀錄");
        } else {
            String[] medals = {"🥇 ", "🥈 ", "🥉 "};
            for (int i = 0; i < Math.min(3, currentTopFishList.size()); i++) {
                CaughtFish fish = currentTopFishList.get(i);
                sb.append(medals[i]).append("§f").append(fish.playername).append(" (§e").append(String.format("%.1f", fish.lengthCm)).append("cm§f) ");
            }
        }
        bossBar.setName(Component.literal(sb.toString()));
        bossBar.setProgress((float) secondsRemaining / 1200.0f);
    }

    private static final Map<UUID, Long> speedBuffExpirationMap = new ConcurrentHashMap<>();
    private static final Map<UUID, Long> giantFishBuffExpirationMap = new ConcurrentHashMap<>();

    public static boolean hasSpeedBuff(UUID uuid) {
        Long expire = speedBuffExpirationMap.get(uuid);
        if (expire == null) return false;
        if (System.currentTimeMillis() > expire) {
            speedBuffExpirationMap.remove(uuid);
            return false;
        }
        return true;
    }

    public static boolean applySpeedBuff(ServerPlayer player) {
        if (player == null) return false;
        UUID uuid = player.getUUID();
        if (hasGiantFishBuff(uuid)) {
            player.sendSystemMessage(Component.literal("§c[釣魚大賽] 您目前已擁有【巨魚引力 BUFF】，無法同時疊加多個大賽 BUFF！請等當前 BUFF 結束後再使用。"));
            return false;
        }
        speedBuffExpirationMap.put(uuid, System.currentTimeMillis() + (3 * 60 * 1000));
        player.sendSystemMessage(Component.literal("§a⚡ [釣魚大賽] 您已啟動【急速垂釣 BUFF】！未來 3 分鐘上鉤速度提升 50%！"));
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0f, 1.5f);
        return true;
    }

    public static boolean hasGiantFishBuff(UUID uuid) {
        Long expire = giantFishBuffExpirationMap.get(uuid);
        if (expire == null) return false;
        if (System.currentTimeMillis() > expire) {
            giantFishBuffExpirationMap.remove(uuid);
            return false;
        }
        return true;
    }

    public static boolean applyGiantFishBuff(ServerPlayer player) {
        if (player == null) return false;
        UUID uuid = player.getUUID();
        if (hasSpeedBuff(uuid)) {
            player.sendSystemMessage(Component.literal("§c[釣魚大賽] 您目前已擁有【急速垂釣 BUFF】，無法同時疊加多個大賽 BUFF！請等當前 BUFF 結束後再使用。"));
            return false;
        }
        giantFishBuffExpirationMap.put(uuid, System.currentTimeMillis() + (3 * 60 * 1000));
        player.sendSystemMessage(Component.literal("§6🧲 [釣魚大賽] 您已啟動【巨魚引力 BUFF】！未來 3 分鐘釣起的魚類尺寸增幅 30%~60%！"));
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0f, 1.8f);
        return true;
    }

    public static ItemStack onPlayerCatchFish(ServerPlayer player, ItemStack originalCatch) {
        if (player == null || !active) return originalCatch;

        String username = player.getName().getString();
        currentContestCountMap.put(username, currentContestCountMap.getOrDefault(username, 0) + 1);

        double roll = Math.random();
        if (roll < 0.20) { // 20% Tactical Item or Trap
            double itemRoll = Math.random();
            if (itemRoll < 0.20) { // 4% Fishing Speed Booster
                ItemStack booster = new ItemStack(Items.PRISMARINE_CRYSTALS);
                booster.set(DataComponents.CUSTOM_NAME, Component.literal("§a⚡ 釣魚大賽加速器"));
                booster.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
                booster.set(DataComponents.LORE, new ItemLore(List.of(
                        Component.literal("§7手持右鍵使用，啟動 3 分鐘急速垂釣 BUFF"),
                        Component.literal("§7上鉤速度提升 50%！"),
                        Component.literal(""),
                        Component.literal("§e[手持右鍵立即啟動]")
                )));
                player.sendSystemMessage(Component.literal("§a🎉 [釣魚大賽] 幸運釣獲戰術道具：【⚡ 釣魚大賽加速器】！手持右鍵即可使用！"));
                player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 1.0f, 1.2f);
                return booster;
            } else if (itemRoll < 0.40) { // 4% Giant Fish Magnet
                ItemStack magnet = new ItemStack(Items.HEART_OF_THE_SEA);
                magnet.set(DataComponents.CUSTOM_NAME, Component.literal("§6🧲 釣魚大賽巨魚磁鐵"));
                magnet.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
                magnet.set(DataComponents.LORE, new ItemLore(List.of(
                        Component.literal("§7手持右鍵使用，啟動 3 分鐘【巨魚引力 BUFF】"),
                        Component.literal("§7期間釣起的魚類尺寸額外增加 +30%~60%！"),
                        Component.literal(""),
                        Component.literal("§e[手持右鍵開啟 BUFF (與加速器互斥)]")
                )));
                player.sendSystemMessage(Component.literal("§6🎉 [釣魚大賽] 幸運釣獲戰術道具：【🧲 釣魚大賽巨魚磁鐵】！手持右鍵即可使用！"));
                player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 1.0f, 1.2f);
                return magnet;
            } else if (itemRoll < 0.60) { // 4% Length Thief
                ItemStack thief = new ItemStack(Items.TRIDENT);
                thief.set(DataComponents.CUSTOM_NAME, Component.literal("§c🗡 釣魚大賽長度偷取器"));
                thief.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
                thief.set(DataComponents.LORE, new ItemLore(List.of(
                        Component.literal("§7手持右鍵開啟玩家選單，強行偷取指定玩家 1%~30% 的長度！"),
                        Component.literal(""),
                        Component.literal("§e[手持右鍵開啟指定目標選單]")
                )));
                player.sendSystemMessage(Component.literal("§c🎉 [釣魚大賽] 幸運釣獲心機戰術道具：【🗡 釣魚大賽長度偷取器】！手持右鍵即可使用！"));
                player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 1.0f, 1.2f);
                return thief;
            } else if (itemRoll < 0.80) { // 4% Trap Bomb (Instant Trigger)
                double curBest = currentContestBestMap.getOrDefault(username, 0.0);
                if (curBest > 0) {
                    double percent = 0.05 + Math.random() * 0.10; // 5% ~ 15%
                    double deduct = curBest * percent;
                    double newBest = Math.max(0.0, curBest - deduct);
                    currentContestBestMap.put(username, newBest);

                    // Re-sort Top Fish
                    currentTopFishList.removeIf(f -> f.playername.equalsIgnoreCase(username));
                    if (newBest > 0) {
                        currentTopFishList.add(new CaughtFish(username, "詛咒陷阱殘留紀錄", newBest, 1.0, "陷阱扣除"));
                    }
                    currentTopFishList.sort((a, b) -> Double.compare(b.lengthCm, a.lengthCm));
                    updateBossBarTitle();

                    player.sendSystemMessage(Component.literal(String.format("§c💥 [釣魚大賽陷阱] 糟了！您釣到了【詛咒陷阱炸彈】，個人最高紀錄損失了 %.1f cm (%.1f%%)！", deduct, percent * 100)));
                    player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.GENERIC_EXPLODE, SoundSource.PLAYERS, 1.0f, 1.0f);
                } else {
                    player.sendSystemMessage(Component.literal("§c💥 [釣魚大賽陷阱] 您釣到了【詛咒陷阱炸彈】，好在您目前尚無長度紀錄，躲過一劫！"));
                }
                return new ItemStack(Items.TNT);
            } else { // 4% Length Swapper
                ItemStack swapper = new ItemStack(Items.NETHER_STAR);
                swapper.set(DataComponents.CUSTOM_NAME, Component.literal("§d🔄 釣魚大賽長度交換器"));
                swapper.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
                swapper.set(DataComponents.LORE, new ItemLore(List.of(
                        Component.literal("§7手持右鍵開啟玩家選單，強行與指定玩家交換最高長度紀錄！"),
                        Component.literal(""),
                        Component.literal("§e[手持右鍵開啟指定目標選單]")
                )));
                player.sendSystemMessage(Component.literal("§d🎉 [釣魚大賽] 獲得超級戰術道具：【🔄 釣魚大賽長度交換器】！手持右鍵即可使用！"));
                player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 1.0f, 1.2f);
                return swapper;
            }
        }

        // Generate fish length & type
        double rand = Math.random();
        String fishName;
        Item itemType;
        double lengthCm;
        double weightKg;

        // 20 Unique Contest Fish Species Pool
        int choice = (int) (Math.random() * 20);

        switch (choice) {
            case 0 -> {
                fishName = "深海大馬哈魚";
                itemType = Items.COD;
                lengthCm = 20.0 + Math.random() * 45.0;
                weightKg = 1.0 + Math.random() * 5.0;
            }
            case 1 -> {
                fishName = "巨型野生鮭魚";
                itemType = Items.SALMON;
                lengthCm = 45.0 + Math.random() * 40.0;
                weightKg = 3.0 + Math.random() * 8.0;
            }
            case 2 -> {
                fishName = "黃金炫光神仙魚";
                itemType = Items.TROPICAL_FISH;
                lengthCm = 70.0 + Math.random() * 65.0;
                weightKg = 5.0 + Math.random() * 15.0;
            }
            case 3 -> {
                fishName = "深海大王烏賊";
                itemType = Items.PUFFERFISH;
                lengthCm = 100.0 + Math.random() * 120.0;
                weightKg = 20.0 + Math.random() * 50.0;
            }
            case 4 -> {
                fishName = "遠古巨齒鯊幼崽";
                itemType = Items.PRISMARINE_CRYSTALS;
                lengthCm = 120.0 + Math.random() * 130.0;
                weightKg = 35.0 + Math.random() * 70.0;
            }
            case 5 -> {
                fishName = "亞特蘭提斯水晶魚";
                itemType = Items.PRISMARINE_SHARD;
                lengthCm = 80.0 + Math.random() * 80.0;
                weightKg = 12.0 + Math.random() * 25.0;
            }
            case 6 -> {
                fishName = "電擊雷霆鰻魚";
                itemType = Items.GLOW_INK_SAC;
                lengthCm = 60.0 + Math.random() * 80.0;
                weightKg = 8.0 + Math.random() * 18.0;
            }
            case 7 -> {
                fishName = "帝王翡翠錦鯉";
                itemType = Items.TROPICAL_FISH;
                lengthCm = 90.0 + Math.random() * 90.0;
                weightKg = 15.0 + Math.random() * 30.0;
            }
            case 8 -> {
                fishName = "深淵紫焰海龍";
                itemType = Items.DRAGON_BREATH;
                lengthCm = 150.0 + Math.random() * 150.0;
                weightKg = 50.0 + Math.random() * 100.0;
            }
            case 9 -> {
                fishName = "極地寒冰鱈魚";
                itemType = Items.ICE;
                lengthCm = 30.0 + Math.random() * 45.0;
                weightKg = 2.0 + Math.random() * 6.0;
            }
            case 10 -> {
                fishName = "地獄熔岩金槍魚";
                itemType = Items.MAGMA_CREAM;
                lengthCm = 50.0 + Math.random() * 60.0;
                weightKg = 6.0 + Math.random() * 14.0;
            }
            case 11 -> {
                fishName = "終界星光水母";
                itemType = Items.ENDER_PEARL;
                lengthCm = 110.0 + Math.random() * 100.0;
                weightKg = 25.0 + Math.random() * 45.0;
            }
            case 12 -> {
                fishName = "七彩虹光小丑魚";
                itemType = Items.TROPICAL_FISH;
                lengthCm = 45.0 + Math.random() * 50.0;
                weightKg = 4.0 + Math.random() * 9.0;
            }
            case 13 -> {
                fishName = "鑽石琉璃飛魚";
                itemType = Items.DIAMOND;
                lengthCm = 85.0 + Math.random() * 85.0;
                weightKg = 10.0 + Math.random() * 20.0;
            }
            case 14 -> {
                fishName = "幽靈海盜骷髏魚";
                itemType = Items.BONE;
                lengthCm = 55.0 + Math.random() * 70.0;
                weightKg = 7.0 + Math.random() * 16.0;
            }
            case 15 -> {
                fishName = "翡翠海藻海馬";
                itemType = Items.SEAGRASS;
                lengthCm = 25.0 + Math.random() * 30.0;
                weightKg = 0.5 + Math.random() * 2.0;
            }
            case 16 -> {
                fishName = "海幻星辰神仙魚";
                itemType = Items.AMETHYST_SHARD;
                lengthCm = 95.0 + Math.random() * 95.0;
                weightKg = 18.0 + Math.random() * 35.0;
            }
            case 17 -> {
                fishName = "深海霸王帝王蟹";
                itemType = Items.NAUTILUS_SHELL;
                lengthCm = 40.0 + Math.random() * 60.0;
                weightKg = 10.0 + Math.random() * 25.0;
            }
            case 18 -> {
                fishName = "日光耀斑翻車魚";
                itemType = Items.GLOWSTONE_DUST;
                lengthCm = 130.0 + Math.random() * 150.0;
                weightKg = 40.0 + Math.random() * 90.0;
            }
            default -> { // case 19
                fishName = "虛空黑洞旗魚";
                itemType = Items.NETHER_STAR;
                lengthCm = 160.0 + Math.random() * 160.0;
                weightKg = 60.0 + Math.random() * 120.0;
            }
        }

        // Apply Giant Fish Magnet Buff (+30% ~ +60% length)
        if (hasGiantFishBuff(player.getUUID())) {
            double mult = 1.30 + Math.random() * 0.30;
            lengthCm *= mult;
            player.sendSystemMessage(Component.literal(String.format("§6🧲 [巨魚引力增幅] 磁鐵生效！本條魚長度增幅 +%.0f%% 放大至 %.1f cm！", (mult - 1.0) * 100, lengthCm)));
        }

        String timeStr = ZonedDateTime.now(ZoneId.of("Asia/Taipei")).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        CaughtFish fish = new CaughtFish(username, fishName, lengthCm, weightKg, timeStr);

        // Create Custom Item
        ItemStack customFishStack = new ItemStack(itemType);
        customFishStack.set(DataComponents.CUSTOM_NAME, Component.literal("§b" + fishName));
        customFishStack.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
        customFishStack.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal("§7§o" + getFishDesc(fishName)),
                Component.literal(""),
                Component.literal("§f● 尺寸長度: §e" + String.format("%.1f", lengthCm) + " cm"),
                Component.literal("§f● 體重重量: §a" + String.format("%.1f", weightKg) + " kg"),
                Component.literal("§f● 釣獲時間: §7" + timeStr),
                Component.literal(""),
                Component.literal("§e[🎣 2026 釣魚大賽特產認證]")
        )));

        // Update leaderboard
        double prevBest = currentContestBestMap.getOrDefault(username, 0.0);
        if (lengthCm > prevBest) {
            currentContestBestMap.put(username, lengthCm);
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a🎉 破紀錄！您釣起了 【" + fishName + "】 (" + String.format("%.1f", lengthCm) + " cm)！已更新您的個人最佳紀錄！"));
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0f, 1.2f);
        } else {
            player.sendSystemMessage(Component.literal("§b[Craft-Core] 成功釣起 【" + fishName + "】 (" + String.format("%.1f", lengthCm) + " cm)！"));
        }

        // Re-sort Top Fish
        currentTopFishList.removeIf(f -> f.playername.equalsIgnoreCase(username));
        currentTopFishList.add(fish);
        currentTopFishList.sort((a, b) -> Double.compare(b.lengthCm, a.lengthCm));

        updateBossBarTitle();
        return customFishStack;
    }

    public static void endContest() {
        if (!active) return;
        active = false;
        secondsRemaining = 0;

        if (bossBar != null) {
            bossBar.setColor(BossEvent.BossBarColor.YELLOW);
            bossBar.setName(Component.literal("§a🎉 釣魚大賽已圓滿結束！恭喜獲勝玩家！"));
            scheduler.schedule(() -> {
                if (bossBar != null) {
                    bossBar.removeAllPlayers();
                    bossBar = null;
                }
            }, 5, TimeUnit.SECONDS);
        }

        if (serverInstance == null) return;

        // Broadcast Results
        serverInstance.getPlayerList().broadcastSystemMessage(Component.literal("§e🎪================== 🎣 全服釣魚大賽圓滿結束 ==================🎪"), false);

        if (currentTopFishList.isEmpty()) {
            serverInstance.getPlayerList().broadcastSystemMessage(Component.literal("§7本次大賽尚無玩家釣起魚類。"), false);
        } else {
            for (int i = 0; i < Math.min(3, currentTopFishList.size()); i++) {
                CaughtFish fish = currentTopFishList.get(i);
                String medal = i == 0 ? "🥇 冠軍" : (i == 1 ? "🥈 亞軍" : "🥉 季軍");
                serverInstance.getPlayerList().broadcastSystemMessage(Component.literal(
                        String.format("§f%s：§e%s §f| 魚種：§b%s §f(§a%.1f cm§f)", medal, fish.playername, fish.fishName, fish.lengthCm)
                ), false);

                // Distribute Rewards
                if (i == 0) {
                    EconomyManager.addMoney(fish.playername, 3000);
                    int curKeys = EconomyManager.getLotteryKeys(fish.playername);
                    EconomyManager.setLotteryKeys(fish.playername, curKeys + 5);
                    TitleManager.unlockTitle(fish.playername, "§b[釣聖]");
                    TitleManager.setActiveTitle(fish.playername, "§b[釣聖]");

                    // Record to Hall of Fame
                    String dateStr = ZonedDateTime.now(ZoneId.of("Asia/Taipei")).format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
                    hallOfFame.add(0, new HallOfFameEntry(dateStr, fish.playername, fish.fishName, fish.lengthCm));
                } else if (i == 1) {
                    EconomyManager.addMoney(fish.playername, 1500);
                    int curKeys = EconomyManager.getLotteryKeys(fish.playername);
                    EconomyManager.setLotteryKeys(fish.playername, curKeys + 3);
                    TitleManager.unlockTitle(fish.playername, "§e[釣魚高手]");
                } else {
                    EconomyManager.addMoney(fish.playername, 800);
                    int curKeys = EconomyManager.getLotteryKeys(fish.playername);
                    EconomyManager.setLotteryKeys(fish.playername, curKeys + 2);
                }
            }

            // Participation Rewards
            for (Map.Entry<String, Integer> entry : currentContestCountMap.entrySet()) {
                String u = entry.getKey();
                if (entry.getValue() > 0) {
                    boolean isTop3 = false;
                    for (int i = 0; i < Math.min(3, currentTopFishList.size()); i++) {
                        if (currentTopFishList.get(i).playername.equalsIgnoreCase(u)) {
                            isTop3 = true;
                            break;
                        }
                    }
                    if (!isTop3) {
                        EconomyManager.addMoney(u, 200);
                        int curKeys = EconomyManager.getLotteryKeys(u);
                        EconomyManager.setLotteryKeys(u, curKeys + 1);
                        ServerPlayer sp = serverInstance.getPlayerList().getPlayerByName(u);
                        if (sp != null) {
                            sp.sendSystemMessage(Component.literal("§b[Craft-Core] 獲得釣魚大賽參與獎：$200 金幣與 1 把鑰匙！"));
                        }
                    }
                }
            }
        }
        serverInstance.getPlayerList().broadcastSystemMessage(Component.literal("§e🎪========================================================================🎪"), false);
    }

    private static String formatTime(int totalSecs) {
        int m = totalSecs / 60;
        int s = totalSecs % 60;
        return String.format("%02d:%02d", m, s);
    }

    private static String getFishDesc(String name) {
        if (name.contains("巨齒鯊")) return "遠古海洋霸主巨齒鯊的幼崽！";
        if (name.contains("水晶魚")) return "來自失落古城亞特蘭提斯的耀眼晶石魚！";
        if (name.contains("鰻魚")) return "渾身閃耀藍色高壓電弧的危險鰻魚！";
        if (name.contains("錦鯉")) return "象徵極致好運與財富的帝王翡翠錦鯉！";
        if (name.contains("海龍")) return "傳說棲息於深淵底部的烈焰海龍！";
        if (name.contains("寒冰鱈魚")) return "結凍於北極萬年冰川底部的冰晶鱈魚！";
        if (name.contains("金槍魚")) return "適應地獄熔岩高溫環境的奇幻金槍魚！";
        if (name.contains("水母")) return "飄浮於終界星空中的炫彩星光水母！";
        if (name.contains("小丑魚")) return "身上的彩虹光芒會隨著水流變幻！";
        if (name.contains("飛魚")) return "能夠短暫飛躍海面的晶瑩琉璃飛魚！";
        if (name.contains("骷髏魚")) return "沉沒海盜船骷髏亡靈化身的死靈魚！";
        if (name.contains("海馬")) return "藏匿於深海巨型海藻叢中的翡翠海馬！";
        if (name.contains("星辰神仙魚")) return "閃耀著紫水晶星辰波光的絕美神仙魚！";
        if (name.contains("帝王蟹")) return "擁有強大螯足的深海海底霸王！";
        if (name.contains("翻車魚")) return "吸收太陽耀斑熱量的巨大翻車魚！";
        if (name.contains("旗魚")) return "穿梭於虛空黑洞裂隙的極速旗魚！";
        if (name.contains("烏賊")) return "來自萬米深海的傳說巨獸！";
        if (name.contains("黃金炫光")) return "全身散發金黃耀眼光輝的神聖魚種！";
        if (name.contains("鮭魚")) return "肉質鮮美的野生肥美巨鮭！";
        return "活動特產深海大馬哈魚。";
    }

    private static abstract class ReadOnlyFishMenuHandler extends ChestMenu {
        public ReadOnlyFishMenuHandler(MenuType<ChestMenu> type, int syncId, net.minecraft.world.entity.player.Inventory playerInventory, SimpleContainer container, int rows) {
            super(type, syncId, playerInventory, container, rows);
        }

        @Override
        public boolean stillValid(net.minecraft.world.entity.player.Player player) {
            return true;
        }

        @Override
        public void clicked(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player player) {
            if (slotId >= 0 && slotId < this.getContainer().getContainerSize()) {
                handleMenuClick(slotId, button, clickType, player);
                return;
            }
            super.clicked(slotId, button, clickType, player);
        }

        @Override
        public ItemStack quickMoveStack(net.minecraft.world.entity.player.Player player, int slot) {
            return ItemStack.EMPTY;
        }

        public abstract void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker);
    }

    // =========================================================
    // GUI Page 1: Contest Dashboard & Real-Time Top 10
    // =========================================================
    public static void openFishGui(ServerPlayer player) {
        if (player == null) return;
        UUID uuid = player.getUUID();
        String username = player.getName().getString();

        SimpleContainer container = new SimpleContainer(27);
        ItemStack glass = createGuiItem(getItemFromIdentifier("minecraft:gray_stained_glass_pane"), " ", List.of());
        for (int i = 0; i < 27; i++) {
            container.setItem(i, glass);
        }

        // Slot 4: Contest Status Indicator
        String statusTitle = active ? "§a🎣 釣魚大賽進行中 (倒數 " + formatTime(secondsRemaining) + ")" : "§c🎣 釣魚大賽未開始 (每日 20:00 自動開啟)";
        List<String> statusLore = List.of(
                "§7每天台北時間 20:00 自動開啟 20 分鐘大賽",
                "§7比賽比拼【單條最大長度 (cm)】",
                "",
                "§f冠軍獎勵: §a$3,000 金幣 §f+ §e5 鑰匙 §f+ 稱號 §b[釣聖]"
        );
        container.setItem(4, createGuiItem(Items.FISHING_ROD, statusTitle, statusLore));

        // Slot 11: Real-time Leaderboard Top 10
        List<String> lbLore = new ArrayList<>();
        if (currentTopFishList.isEmpty()) {
            lbLore.add("§7目前尚無榜單紀錄");
        } else {
            String[] medals = {"🥇 ", "🥈 ", "🥉 ", "4. ", "5. ", "6. ", "7. ", "8. ", "9. ", "10. "};
            for (int i = 0; i < Math.min(10, currentTopFishList.size()); i++) {
                CaughtFish f = currentTopFishList.get(i);
                lbLore.add(medals[i] + "§f" + f.playername + " §7- §b" + f.fishName + " (§e" + String.format("%.1f", f.lengthCm) + "cm§7)");
            }
        }
        container.setItem(11, createGuiItem(Items.PAPER, "§e🏆 本次大賽即時 Top 10", lbLore));

        // Slot 13: Personal Best
        double myBest = currentContestBestMap.getOrDefault(username, 0.0);
        int myCount = currentContestCountMap.getOrDefault(username, 0);
        container.setItem(13, createGuiItem(Items.PLAYER_HEAD, "§b👤 我的本次大賽成績", List.of(
                "§7個人最大紀錄: §e" + (myBest > 0 ? String.format("%.1f", myBest) + " cm" : "無紀錄"),
                "§7累積釣魚數量: §a" + myCount + " 尾",
                "",
                "§a[比賽期間拿起釣竿即可參加]"
        )));

        // Slot 15: BossBar Toggle
        boolean bbOff = isBossBarDisabled(uuid);
        container.setItem(15, createGuiItem(Items.COMPASS, "§e🧭 頂部排行榜 BossBar " + (bbOff ? "§c[已關閉]" : "§a[已開啟]"), List.of(
                "§7開關畫面上方的比賽即時倒數 BossBar",
                "",
                "§e[點擊切換開啟 / 關閉]"
        )));

        // Slot 22: Hall of Fame Button
        container.setItem(22, createGuiItem(Items.GOLD_BLOCK, "§6🏆 釣魚名人堂 (Hall of Fame)", List.of(
                "§7查看歷屆釣魚大賽冠軍玩家與傳奇紀錄",
                "",
                "§e[點擊開啟名人堂]"
        )));

        // Slot 26: Close
        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉介面")));

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
            new ReadOnlyFishMenuHandler(MenuType.GENERIC_9x3, syncId, inv, container, 3) {
                @Override
                public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                    if (clicker instanceof ServerPlayer sp) {
                        if (slotId == 15) {
                            toggleBossBar(sp.getUUID());
                            sp.sendSystemMessage(Component.literal("§a[釣魚大賽] 已切換頂部 BossBar 顯示狀態！"));
                            openFishGui(sp);
                        } else if (slotId == 22) {
                            openHallOfFameGui(sp);
                        } else if (slotId == 26) {
                            sp.closeContainer();
                        }
                    }
                }
            }, Component.literal("§8❖ 🎣 全服釣魚熱潮大賽 (/fish) ❖")));
    }

    // =========================================================
    // GUI Page 2: Hall of Fame
    // =========================================================
    public static void openHallOfFameGui(ServerPlayer player) {
        if (player == null) return;

        SimpleContainer container = new SimpleContainer(27);
        ItemStack glass = createGuiItem(getItemFromIdentifier("minecraft:gray_stained_glass_pane"), " ", List.of());
        for (int i = 0; i < 27; i++) {
            container.setItem(i, glass);
        }

        container.setItem(4, createGuiItem(Items.GOLDEN_HELMET, "§6🏆 歷屆釣魚冠軍名人堂", List.of("§7展現歷屆全服釣魚大賽頂尖王者！")));

        int[] slots = {10, 11, 12, 13, 14, 15, 16};
        if (hallOfFame.isEmpty()) {
            container.setItem(13, createGuiItem(Items.BOOK, "§7尚無名人堂紀錄", List.of("§7第一屆釣魚大賽冠軍得主即將誕生！")));
        } else {
            for (int i = 0; i < Math.min(7, hallOfFame.size()); i++) {
                HallOfFameEntry entry = hallOfFame.get(i);
                container.setItem(slots[i], createGuiItem(Items.DIAMOND, "§b👑 " + entry.winnerName + " (" + entry.date + ")", List.of(
                        "§7奪冠魚種: §f" + entry.fishName,
                        "§7奪冠長度: §e" + String.format("%.1f", entry.lengthCm) + " cm",
                        "",
                        "§6[獲得稱號: 釣聖]"
                )));
            }
        }

        container.setItem(22, createGuiItem(Items.ARROW, "§a⬅ 返回大賽主頁", List.of("§7點擊返回 /fish 主頁")));
        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉介面")));

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
            new ReadOnlyFishMenuHandler(MenuType.GENERIC_9x3, syncId, inv, container, 3) {
                @Override
                public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                    if (clicker instanceof ServerPlayer sp) {
                        if (slotId == 22) {
                            openFishGui(sp);
                        } else if (slotId == 26) {
                            sp.closeContainer();
                        }
                    }
                }
            }, Component.literal("§8❖ 🏆 釣魚名人堂 ❖")));
    }

    // =========================================================
    // Target Selector GUI for Length Swapper & Length Thief
    // =========================================================
    public static void openTargetSelectorGui(ServerPlayer user, String itemAction) {
        if (user == null || user.level().getServer() == null) return;
        MinecraftServer server = user.level().getServer();
        List<ServerPlayer> players = new ArrayList<>(server.getPlayerList().getPlayers());

        SimpleContainer container = new SimpleContainer(27);
        ItemStack glass = createGuiItem(getItemFromIdentifier("minecraft:gray_stained_glass_pane"), " ", List.of());
        for (int i = 0; i < 27; i++) {
            container.setItem(i, glass);
        }

        String actionTitle = "SWAP".equalsIgnoreCase(itemAction) ? "§d🔄 選擇長度交換目標玩家" : "§c🗡 選擇長度偷取目標玩家";
        container.setItem(4, createGuiItem(Items.PLAYER_HEAD, actionTitle, List.of("§7點擊下方線上玩家頭顱施放戰術道具")));

        int slot = 9;
        Map<Integer, String> slotPlayerMap = new HashMap<>();
        for (ServerPlayer p : players) {
            if (slot >= 26) break;
            String name = p.getName().getString();
            if (name.equalsIgnoreCase(user.getName().getString())) continue;

            slotPlayerMap.put(slot, name);
            double targetBest = currentContestBestMap.getOrDefault(name, 0.0);
            container.setItem(slot++, createGuiItem(Items.PLAYER_HEAD, "§e" + name, List.of(
                    "§7目前最高紀錄: §a" + (targetBest > 0 ? String.format("%.1f", targetBest) + " cm" : "無紀錄"),
                    "",
                    "§e[點擊對該玩家施放道具]"
            )));
        }

        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 取消使用", List.of("§7點擊關閉選單")));

        user.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
            new ReadOnlyFishMenuHandler(MenuType.GENERIC_9x3, syncId, inv, container, 3) {
                @Override
                public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                    if (clicker instanceof ServerPlayer sp) {
                        if (slotId == 26) { sp.closeContainer(); return; }

                        String targetName = slotPlayerMap.get(slotId);
                        if (targetName != null) {
                            sp.closeContainer();
                            if ("SWAP".equalsIgnoreCase(itemAction)) {
                                executeLengthSwap(sp, targetName);
                            } else {
                                executeLengthThief(sp, targetName);
                            }
                        }
                    }
                }
            }, Component.literal("§8❖ " + actionTitle + " ❖")));
    }

    public static void executeLengthSwap(ServerPlayer user, String targetName) {
        if (user == null) return;
        String userName = user.getName().getString();
        double userBest = currentContestBestMap.getOrDefault(userName, 0.0);
        double targetBest = currentContestBestMap.getOrDefault(targetName, 0.0);

        currentContestBestMap.put(userName, targetBest);
        currentContestBestMap.put(targetName, userBest);

        // Consume Item from hand
        if (user.getMainHandItem().is(Items.NETHER_STAR)) {
            user.getMainHandItem().shrink(1);
        }

        // Re-sort leaderboard
        refreshTopList(userName, targetName);

        // Broadcast
        if (serverInstance != null) {
            serverInstance.getPlayerList().broadcastSystemMessage(Component.literal(String.format(
                    "§c⚔ [釣魚大賽心機戰況] 玩家 §e%s §c使用了【🔄 長度交換器】，強行與 §e%s §c交換了長度紀錄！(§e%.1f cm §c⇄ §e%.1f cm)",
                    userName, targetName, userBest, targetBest
            )), false);
        }
    }

    public static void executeLengthThief(ServerPlayer user, String targetName) {
        if (user == null) return;
        String userName = user.getName().getString();
        double userBest = currentContestBestMap.getOrDefault(userName, 0.0);
        double targetBest = currentContestBestMap.getOrDefault(targetName, 0.0);

        if (targetBest <= 0) {
            user.sendSystemMessage(Component.literal("§c[釣魚大賽] 該玩家目前尚無長度紀錄，無法偷取！"));
            return;
        }

        double percent = 0.01 + Math.random() * 0.29; // 1% ~ 30%
        double stolen = targetBest * percent;

        currentContestBestMap.put(userName, userBest + stolen);
        currentContestBestMap.put(targetName, Math.max(0.0, targetBest - stolen));

        // Consume Item from hand
        if (user.getMainHandItem().is(Items.TRIDENT)) {
            user.getMainHandItem().shrink(1);
        }

        // Re-sort leaderboard
        refreshTopList(userName, targetName);

        // Broadcast
        if (serverInstance != null) {
            serverInstance.getPlayerList().broadcastSystemMessage(Component.literal(String.format(
                    "§c⚔ [釣魚大賽心機戰況] 玩家 §e%s §c使用了【🗡 長度偷取器】，從 §e%s §c身上強行偷走了 §a%.1f cm §c(%.1f%%) 的長度！",
                    userName, targetName, stolen, percent * 100
            )), false);
        }
    }

    private static void refreshTopList(String user1, String user2) {
        double b1 = currentContestBestMap.getOrDefault(user1, 0.0);
        double b2 = currentContestBestMap.getOrDefault(user2, 0.0);

        currentTopFishList.removeIf(f -> f.playername.equalsIgnoreCase(user1) || f.playername.equalsIgnoreCase(user2));
        if (b1 > 0) currentTopFishList.add(new CaughtFish(user1, "戰術道具調整紀錄", b1, 1.0, "戰術調整"));
        if (b2 > 0) currentTopFishList.add(new CaughtFish(user2, "戰術道具調整紀錄", b2, 1.0, "戰術調整"));

        currentTopFishList.sort((a, b) -> Double.compare(b.lengthCm, a.lengthCm));
        updateBossBarTitle();
    }

    private static Item getItemFromIdentifier(String idStr) {
        if (idStr == null || idStr.isEmpty()) return Items.BOOK;
        try {
            return BuiltInRegistries.ITEM.getValue(Identifier.parse(idStr));
        } catch (Throwable t) {
            return Items.BOOK;
        }
    }

    private static ItemStack createGuiItem(Item item, String name, List<String> loreLines) {
        ItemStack stack = new ItemStack(item != null ? item : Items.BOOK);
        stack.set(DataComponents.CUSTOM_NAME, Component.literal(name));
        if (loreLines != null && !loreLines.isEmpty()) {
            List<Component> comps = loreLines.stream().map(Component::literal).map(c -> (Component) c).toList();
            stack.set(DataComponents.LORE, new ItemLore(comps));
        }
        return stack;
    }
}
