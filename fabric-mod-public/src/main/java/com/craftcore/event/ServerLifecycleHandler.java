package com.craftcore.event;

import com.craftcore.config.ConfigManager;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class ServerLifecycleHandler {
    public static MinecraftServer serverInstance = null;
    private static ScheduledExecutorService greetingScheduler = null;

    public static synchronized ScheduledExecutorService getGreetingScheduler() {
        if (greetingScheduler == null || greetingScheduler.isShutdown()) {
            greetingScheduler = Executors.newSingleThreadScheduledExecutor();
        }
        return greetingScheduler;
    }

    public static void register() {
        ServerLifecycleEvents.SERVER_STARTED.register(server -> {
            System.out.println("[CraftCore] Server started.");
            serverInstance = server;
            ConfigManager.loadConfig();
            ConfigManager.loadPlayers();
            ChestShopEventHandler.register();
            com.craftcore.task.DailyTaskManager.register();
            com.craftcore.fakeplayer.FakePlayerManager.scheduleAutoReconnect(server);
            com.craftcore.backup.BackupManager.startAutoBackupLoop(server);
            com.craftcore.lottery.HourlyLotteryManager.startHourlyLoop(server);
            com.craftcore.treasure.TreasureChestManager.startLoop(server);
            com.craftcore.mushroom.MushroomManager.startLoop(server);
            com.craftcore.trail.ParticleTrailManager.registerTickLoop();
            com.craftcore.fish.FishingContestManager.startLoop(server);
            com.craftcore.mining.MiningDimensionManager.startLoop(server);
            com.craftcore.lobby.LobbyDimensionManager.startLoop(server);
        });

        ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
            System.out.println("[CraftCore] Server stopping. Cleaning up resources.");
            serverInstance = null;
            synchronized (ServerLifecycleHandler.class) {
                if (greetingScheduler != null) {
                    greetingScheduler.shutdown();
                    greetingScheduler = null;
                }
            }
            com.craftcore.fakeplayer.FakePlayerManager.saveAllCurrentPositions(server);
            com.craftcore.backup.BackupManager.stopAutoBackupLoop();
        });

        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayer player = handler.getPlayer();
            if (player != null) {
                String username = player.getName().getString();
                String uuid = player.getStringUUID();

                // 1. 處理 UUID 改名遷移、離線轉帳通知、每日任務自動領取與首次登入禮包
                com.craftcore.economy.EconomyManager.handlePlayerLogin(username, uuid);
                com.craftcore.economy.EconomyManager.checkAndDeliverOfflineNotifications(player);
                com.craftcore.task.DailyTaskManager.checkAndAutoClaimTasks(player);
                FirstJoinManager.checkAndHandleFirstJoin(player);
                com.craftcore.mushroom.MushroomManager.checkAndGiveMushroom(player);
                com.craftcore.achievement.CustomAchievementManager.grantAdvancement(player, "root");

                // 2. 發送隨機迎賓小提示 (Welcome Tip) 與限時活動通知
                getGreetingScheduler().schedule(() -> {
                    try {
                        server.execute(() -> {
                            WelcomeTipManager.sendRandomTip(player);
                            EventManager.checkAndNotifyEvents(player);
                        });
                    } catch (Exception e) {
                        System.err.println("[CraftCore] Failed to send welcome tip/events: " + e.getMessage());
                    }
                }, 1500, TimeUnit.MILLISECONDS);

                // 3. 更新 Tab 清單頂部與底部排版 (消除擁擠感，多重延遲傳送確保 100% 成功刷出)
                updateTabListHeaderFooter(server);
                getGreetingScheduler().schedule(() -> {
                    try {
                        server.execute(() -> updateTabListHeaderFooter(server));
                    } catch (Exception ignored) {}
                }, 2, TimeUnit.SECONDS);
                getGreetingScheduler().schedule(() -> {
                    try {
                        server.execute(() -> updateTabListHeaderFooter(server));
                    } catch (Exception ignored) {}
                }, 5, TimeUnit.SECONDS);
            }
        });

        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            ServerPlayer player = handler.getPlayer();
            if (player != null) {
                String username = player.getName().getString();
                com.craftcore.commands.EconomyCommands.removePlayerCooldown(username);
                ConfigManager.updatePlayerLastOnline(username);

                // 玩家離開時同步更新 Tab 清單在線人數
                getGreetingScheduler().schedule(() -> {
                    try {
                        server.execute(() -> updateTabListHeaderFooter(server));
                    } catch (Exception ignored) {}
                }, 500, TimeUnit.MILLISECONDS);
            }
        });

        ServerMessageEvents.ALLOW_CHAT_MESSAGE.register((message, sender, params) -> {
            String content = message.signedContent();
            if (com.craftcore.commands.EconomyCommands.handleChatMessage(sender, content)) {
                return false;
            }
            if (com.craftcore.mushroom.MushroomManager.isAiChatActive(sender)) {
                if (content.equalsIgnoreCase("exit") || content.equalsIgnoreCase("退出") || content.equalsIgnoreCase("quit") || content.equalsIgnoreCase("/mushroom exit")) {
                    com.craftcore.mushroom.MushroomManager.exitAiChatMode(sender);
                    return false;
                }
                sender.sendSystemMessage(Component.literal("§e[你 -> 洋菇] §f" + content));
                sender.sendSystemMessage(Component.literal("§d[洋菇] §f菇菇！目前洋菇正在休假中 (單機模式)。"));
                return false;
            }
            return true;
        });

        ServerMessageEvents.CHAT_MESSAGE.register((message, sender, params) -> {
        });
    }

    public static void updateTabListHeaderFooter(MinecraftServer server) {
        if (server == null) return;
        int online = server.getPlayerCount();
        int max = server.getMaxPlayers();
        Component header = Component.literal(
                "\n§b§l  ❖  Craft-Core 原味生存伺服器  ❖  \n§7官網: §fhttps://craft-core.xyz\n"
        );
        Component footer = Component.literal(
                "\n§f在線人數: §a" + online + " §f/ §7" + max + "\n" +
                "§e✨ 輸入 §f/menu §e開啟伺服器主選單大廳 ✨\n"
        );
        net.minecraft.network.protocol.game.ClientboundTabListPacket packet = new net.minecraft.network.protocol.game.ClientboundTabListPacket(header, footer);
        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            if (player != null && player.connection != null) {
                player.connection.send(packet);
            }
        }
    }
}
