package com.craftcore.lottery;

import com.craftcore.fakeplayer.FakePlayerManager;
import com.craftcore.title.TitleManager;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class HourlyLotteryManager {

    private static ScheduledExecutorService scheduler = null;
    private static final Random random = new Random();

    public static void startHourlyLoop(MinecraftServer server) {
        if (scheduler != null && !scheduler.isShutdown()) return;
        scheduler = Executors.newSingleThreadScheduledExecutor();

        long now = System.currentTimeMillis();
        long nextHour = ((now / 3600000) + 1) * 3600000;
        long initialDelay = Math.max(10, nextHour - now);

        scheduler.scheduleAtFixedRate(() -> {
            try {
                if (server == null || server.getPlayerList() == null) return;
                server.execute(() -> runHourlyLottery(server));
            } catch (Throwable t) {
                System.err.println("[CraftCore] Error in HourlyLottery loop: " + t.getMessage());
            }
        }, initialDelay, 3600000, TimeUnit.MILLISECONDS);
    }

    public static void runHourlyLottery(MinecraftServer server) {
        List<ServerPlayer> allPlayers = server.getPlayerList().getPlayers();
        if (allPlayers.isEmpty()) return;

        // Filter out fake players
        List<ServerPlayer> realPlayers = new ArrayList<>();
        for (ServerPlayer p : allPlayers) {
            if (!FakePlayerManager.isFakePlayer(p)) {
                realPlayers.add(p);
            }
        }

        if (realPlayers.isEmpty()) return;

        // 1. Give hourly gift to all real online players
        for (ServerPlayer p : realPlayers) {
            String name = p.getName().getString();
            com.craftcore.economy.EconomyManager.addMoney(name, 200.0);
            p.getInventory().add(new ItemStack(Items.GOLDEN_CARROT, 8));
            p.sendSystemMessage(Component.literal("§a[整點禮包] 感謝您持續在線！獲得 §d$200 元金幣 + 8 根金胡蘿蔔§a！"));
        }

        // 2. Pick a random Lucky Koi with a 20% chance per hour (1 in 5 chance per hour, making it rare!)
        if (random.nextInt(5) == 0) {
            ServerPlayer luckyKoi = realPlayers.get(random.nextInt(realPlayers.size()));
            String koiName = luckyKoi.getName().getString();

            int currentKeys = com.craftcore.economy.EconomyManager.getLotteryKeys(koiName);
            com.craftcore.economy.EconomyManager.setLotteryKeys(koiName, currentKeys + 2);
            com.craftcore.economy.EconomyManager.addMoney(koiName, 1000.0);
            TitleManager.unlockTitle(koiName, "§a[幸運錦鯉]");

            String broadcastMsg = String.format("§e[整點幸運雨] 恭喜玩家 §b%s §e幸運觸發「全服幸運錦鯉」！獨得 §d$1000 金幣 + 2 把幸運鑰匙 §e並解鎖稱號 §a[幸運錦鯉]§e！", koiName);
            server.getPlayerList().broadcastSystemMessage(Component.literal(broadcastMsg), false);
        }
    }
}
