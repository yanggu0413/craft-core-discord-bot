package com.craftcore.fish;

import com.craftcore.api.EconomyAPI;
import com.craftcore.title.TitleManager;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerBossEvent;
import net.minecraft.server.level.ServerLevel;
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
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.level.Level;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class FishingContestManager {

    public static final ResourceKey<Level> FISHING_DIMENSION_KEY = ResourceKey.create(Registries.DIMENSION, Identifier.parse("craftcore:fishing"));

    public static class CaughtFish {
        public String fisherman;
        public String fishName;
        public double lengthCm;
        public double weightKg;
        public String caughtTime;

        public CaughtFish(String fisherman, String fishName, double lengthCm, double weightKg, String caughtTime) {
            this.fisherman = fisherman;
            this.fishName = fishName;
            this.lengthCm = lengthCm;
            this.weightKg = weightKg;
            this.caughtTime = caughtTime;
        }
    }

    private static boolean active = false;
    private static int secondsRemaining = 0;
    private static ScheduledExecutorService scheduler = null;

    private static final Map<UUID, Double> serverScores = new ConcurrentHashMap<>();
    private static final List<CaughtFish> hallOfFame = Collections.synchronizedList(new ArrayList<>());
    private static ServerBossEvent bossBar = null;

    public static boolean isContestActive() {
        return active;
    }

    public static int getSecondsRemaining() {
        return secondsRemaining;
    }

    public static Map<UUID, Double> getCurrentContestBestMap() {
        return serverScores;
    }

    public static List<CaughtFish> getHallOfFame() {
        return hallOfFame;
    }

    public static ResourceKey<Level> getFishingDimensionKey() {
        return FISHING_DIMENSION_KEY;
    }

    public static void checkAndGiveStarterRod(ServerPlayer player) {
        if (player == null) return;
        boolean hasRod = false;
        for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
            ItemStack stack = player.getInventory().getItem(i);
            if (!stack.isEmpty() && stack.is(Items.FISHING_ROD)) {
                hasRod = true;
                break;
            }
        }

        if (!hasRod) {
            ItemStack rod = new ItemStack(Items.FISHING_ROD);
            rod.set(DataComponents.CUSTOM_NAME, Component.literal("§b🎣 釣魚大都會 - 幸運釣竿"));
            rod.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
            rod.set(DataComponents.LORE, new ItemLore(List.of(
                    Component.literal("§7系統免費贈送的新手專用釣竿"),
                    Component.literal("§7於 craftcore:fishing 專屬釣魚維度垂釣"),
                    Component.literal(""),
                    Component.literal("§a[幸運釣手專屬裝備]")
            )));

            player.getInventory().add(rod);
            player.sendSystemMessage(Component.literal("§a🎁 [釣魚好禮] 歡迎來到釣魚維度！檢測到您未攜帶釣竿，系統已自動為您發放【🎣 幸運釣竿】！"));
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 1.0f, 1.2f);
        }
    }

    public static void teleportToFishingDimension(ServerPlayer player) {
        if (player == null) return;
        MinecraftServer server = player.level().getServer();
        if (server == null) return;

        ServerLevel fishingLevel = server.getLevel(FISHING_DIMENSION_KEY);
        if (fishingLevel == null) {
            for (ServerLevel sl : server.getAllLevels()) {
                if (sl.dimension().identifier().toString().equals("craftcore:fishing")) {
                    fishingLevel = sl;
                    break;
                }
            }
        }

        if (fishingLevel == null) {
            player.sendSystemMessage(Component.literal("§c[釣魚系統] 釣魚維度 craftcore:fishing 正在加載中，請稍後再試！"));
            return;
        }

        player.teleportTo(fishingLevel, 28.5, 100.0, 56.5, Set.of(), player.getYRot(), player.getXRot(), false);
        player.playSound(SoundEvents.ENDERMAN_TELEPORT, 1.0f, 1.0f);
        player.sendSystemMessage(Component.literal("§a🌊 [釣魚大廳] 成功傳送至專屬釣魚虛空維度 (craftcore:fishing)！"));
    }

    public static void startLoop(MinecraftServer server) {
        if (scheduler != null && !scheduler.isShutdown()) return;
        scheduler = Executors.newSingleThreadScheduledExecutor();

        bossBar = new ServerBossEvent(UUID.randomUUID(), Component.literal("§b[釣魚大賽] 準備中..."), BossEvent.BossBarColor.BLUE, BossEvent.BossBarOverlay.PROGRESS);

        scheduler.scheduleAtFixedRate(() -> {
            try {
                ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Taipei"));
                if (now.getHour() == 20 && now.getMinute() == 0 && now.getSecond() < 5 && !active) {
                    if (server != null) {
                        server.execute(() -> startContest(server, 20));
                    }
                }
            } catch (Throwable t) {
                System.err.println("[CraftCore] Error in FishingContest timer loop: " + t.getMessage());
            }
        }, 0, 5, TimeUnit.SECONDS);

        scheduler.scheduleAtFixedRate(() -> {
            try {
                if (active && secondsRemaining > 0) {
                    secondsRemaining--;
                    if (server != null) {
                        server.execute(() -> updateBossBar(server));
                    }
                    if (secondsRemaining <= 0) {
                        if (server != null) {
                            server.execute(() -> stopContest(server));
                        }
                    }
                }
            } catch (Throwable t) {
                System.err.println("[CraftCore] Error in FishingContest countdown loop: " + t.getMessage());
            }
        }, 1, 1, TimeUnit.SECONDS);
    }

    public static synchronized void startContest(MinecraftServer server, int minutes) {
        active = true;
        secondsRemaining = minutes * 60;
        serverScores.clear();

        bossBar.setName(Component.literal("§b🎣 [全服釣魚大賽] 進行中！倒數: " + minutes + " 分鐘 | 等待第一條巨魚上鉤！"));
        bossBar.setProgress(1.0f);
        bossBar.setVisible(true);

        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            bossBar.addPlayer(player);
        }

        String broadcastMsg = String.format("§b🎉 [全服通告] 每日 20:00 全服釣魚大賽正式開始！限時 %d 分鐘！請輸入 /fish tp 前往釣魚維度挑戰釣起全服最大巨魚！", minutes);
        server.getPlayerList().broadcastSystemMessage(Component.literal(broadcastMsg), false);
    }

    public static synchronized void stopContest(MinecraftServer server) {
        if (!active) return;
        active = false;
        secondsRemaining = 0;

        if (bossBar != null) {
            bossBar.setVisible(false);
            bossBar.removeAllPlayers();
        }

        server.getPlayerList().broadcastSystemMessage(Component.literal("§b🏁 [釣魚大賽] 比賽時間結束！正在結算全服排名..."), false);
        settleRewards(server);
    }

    private static void updateBossBar(MinecraftServer server) {
        if (bossBar == null || !active) return;

        int min = secondsRemaining / 60;
        int sec = secondsRemaining % 60;

        String leaderStr = "尚無紀錄";
        if (!serverScores.isEmpty()) {
            Map.Entry<UUID, Double> top = serverScores.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .orElse(null);
            if (top != null) {
                ServerPlayer topPlayer = server.getPlayerList().getPlayer(top.getKey());
                String name = (topPlayer != null) ? topPlayer.getName().getString() : "未知選手";
                leaderStr = String.format("%s (%.1f cm)", name, top.getValue());
            }
        }

        bossBar.setName(Component.literal(String.format("§b🎣 [釣魚大賽] 倒數: %02d:%02d | 👑 當前第一: §e%s", min, sec, leaderStr)));
        bossBar.setProgress((float) secondsRemaining / 1200.0f);
    }

    private static void settleRewards(MinecraftServer server) {
        if (serverScores.isEmpty()) {
            server.getPlayerList().broadcastSystemMessage(Component.literal("§e[釣魚大賽] 本次比賽無人上榜。"), false);
            return;
        }

        List<Map.Entry<UUID, Double>> sorted = serverScores.entrySet().stream()
                .sorted(Map.Entry.<UUID, Double>comparingByValue().reversed())
                .toList();

        for (int i = 0; i < sorted.size(); i++) {
            Map.Entry<UUID, Double> entry = sorted.get(i);
            ServerPlayer p = server.getPlayerList().getPlayer(entry.getKey());
            String name = (p != null) ? p.getName().getString() : "選手";
            double len = entry.getValue();

            if (i == 0) {
                EconomyAPI.getProvider().addMoney(name, 3000.0);
                TitleManager.unlockTitle(name, "§b[釣聖]");
                server.getPlayerList().broadcastSystemMessage(Component.literal(String.format("§6🏆 [冠軍] 恭喜 §e%s §6以 §e%.1f cm §6勇奪冠軍！獲得 $3,000 元獎金與尊爵稱號 §b[釣聖]§6！", name, len)), false);
            } else if (i < 3) {
                EconomyAPI.getProvider().addMoney(name, 1500.0);
                TitleManager.unlockTitle(name, "§e[釣魚高手]");
                server.getPlayerList().broadcastSystemMessage(Component.literal(String.format("§e🥈 [亞軍/季軍] 恭喜 §f%s §e以 §f%.1f cm §e榮獲第 %d 名！獲得 $1,500 元獎金！", name, len, i + 1)), false);
            } else {
                EconomyAPI.getProvider().addMoney(name, 500.0);
            }
        }
    }

    public static void openFishGui(ServerPlayer player) {
        if (player == null) return;

        SimpleContainer container = new SimpleContainer(27);
        Item glassPane = BuiltInRegistries.ITEM.getValue(Identifier.parse("minecraft:gray_stained_glass_pane"));
        for (int i = 0; i < 27; i++) {
            container.setItem(i, createGuiItem(glassPane, " ", null));
        }

        container.setItem(11, createGuiItem(Items.FISHING_ROD, "§b🎣 前往釣魚維度", List.of(
                "§7傳送至專屬釣魚維度 craftcore:fishing",
                "",
                "§e[點擊傳送]"
        )));

        container.setItem(13, createGuiItem(Items.BOOK, "§6📖 奇幻魚類圖鑑冊", List.of(
                "§7查看 20 種奇幻魚類收集進度",
                "",
                "§e[點擊開啟圖鑑 GUI]"
        )));

        container.setItem(15, createGuiItem(Items.GOLD_INGOT, "§a🐟 奇幻售魚回收箱", List.of(
                "§7出售手持或背包內的高價值 NBT 魚類",
                "",
                "§e[點擊開啟售魚回收箱]"
        )));

        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉介面")));

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
                new ChestMenu(MenuType.GENERIC_9x3, syncId, inv, container, 3) {
                    @Override
                    public boolean stillValid(net.minecraft.world.entity.player.Player player) {
                        return true;
                    }

                    @Override
                    public void clicked(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 11) {
                                sp.closeContainer();
                                teleportToFishingDimension(sp);
                            } else if (slotId == 13) {
                                sp.closeContainer();
                                FishCodexManager.openCodexGui(sp);
                            } else if (slotId == 15) {
                                sp.closeContainer();
                                FishSellManager.openFishSellBin(sp);
                            } else if (slotId == 26) {
                                sp.closeContainer();
                            }
                        }
                    }
                }, Component.literal("§8❖ 🎣 奇幻釣魚大廳 (/fish) ❖")));
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
