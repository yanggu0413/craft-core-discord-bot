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

    public static ItemStack onPlayerCatchFish(ServerPlayer player, ItemStack originalCatch) {
        if (player == null || !active) return originalCatch;

        String username = player.getName().getString();
        currentContestCountMap.put(username, currentContestCountMap.getOrDefault(username, 0) + 1);

        // Generate fish length & type
        double rand = Math.random();
        String fishName;
        Item itemType;
        double lengthCm;
        double weightKg;

        if (rand < 0.05) { // 5% Secret Junk Shoe
            fishName = "服主掉落的破舊靴子";
            itemType = Items.LEATHER_BOOTS;
            lengthCm = 0.1;
            weightKg = 0.5;
        } else if (rand < 0.20) { // 15% Giant Squid
            fishName = "深海大王烏賊";
            itemType = Items.PUFFERFISH;
            lengthCm = 100.0 + Math.random() * 120.0;
            weightKg = 20.0 + Math.random() * 50.0;
        } else if (rand < 0.45) { // 25% Gold Angel Fish
            fishName = "黃金炫光神仙魚";
            itemType = Items.TROPICAL_FISH;
            lengthCm = 70.0 + Math.random() * 65.0;
            weightKg = 5.0 + Math.random() * 15.0;
        } else if (rand < 0.70) { // 25% Salmon
            fishName = "巨型野生鮭魚";
            itemType = Items.SALMON;
            lengthCm = 45.0 + Math.random() * 40.0;
            weightKg = 3.0 + Math.random() * 8.0;
        } else { // 30% Cod
            fishName = "深海大馬哈魚";
            itemType = Items.COD;
            lengthCm = 20.0 + Math.random() * 45.0;
            weightKg = 1.0 + Math.random() * 5.0;
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
        if (name.contains("靴子")) return "服主羊咕不小心掉進水裡的舊靴子...";
        if (name.contains("烏賊")) return "來自萬米深海的傳說巨獸！";
        if (name.contains("神仙魚")) return "全身散發金黃耀眼光輝的神聖魚種！";
        if (name.contains("鮭魚")) return "肉質鮮美的野生肥美巨鮭！";
        return "活動特產深海魚類。";
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
