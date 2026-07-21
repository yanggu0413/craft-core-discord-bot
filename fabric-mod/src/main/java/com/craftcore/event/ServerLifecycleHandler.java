package com.craftcore.event;

import com.craftcore.CraftCoreMod;
import com.craftcore.config.ConfigManager;
import com.craftcore.websocket.Packet;
import com.craftcore.websocket.CraftCoreWSClient;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.network.chat.ChatType;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class ServerLifecycleHandler {
    private static ScheduledExecutorService telemetryScheduler;
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
            System.out.println("[CraftCore] Server started. Initializing WebSocket connection.");
            serverInstance = server;
            ConfigManager.loadConfig();
            ConfigManager.loadPlayers();
            CraftCoreMod.startWSClient(server);
            ChestShopEventHandler.register();
            com.craftcore.task.DailyTaskManager.register();
        });

        ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
            System.out.println("[CraftCore] Server stopping. Cleaning up resources.");
            serverInstance = null;
            stopTelemetryLoop();
            synchronized (ServerLifecycleHandler.class) {
                if (greetingScheduler != null) {
                    greetingScheduler.shutdown();
                    greetingScheduler = null;
                }
            }
            CraftCoreMod.stopWSClient();
        });

        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayer player = handler.getPlayer();
            if (player != null) {
                String username = player.getName().getString();
                String uuid = player.getStringUUID();

                // 1. 處理 UUID 改名遷移、離線轉帳通知與首次登入禮包
                com.craftcore.economy.EconomyManager.handlePlayerLogin(username, uuid);
                com.craftcore.economy.EconomyManager.checkAndDeliverOfflineNotifications(player);
                FirstJoinManager.checkAndHandleFirstJoin(player);

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

                CraftCoreWSClient client = CraftCoreMod.getWSClient();
                if (client != null && client.isAuthenticated()) {
                    client.send(new Packet("event", new Packet.EventPayload(
                            "join", username, uuid, username + " joined the game"
                    )));

                    getGreetingScheduler().schedule(() -> {
                        try {
                            if (client.isAuthenticated()) {
                                client.send(new Packet("join_query", new Packet.JoinQueryPayload(username, uuid)));
                            }
                        } catch (Exception e) {
                            System.err.println("[CraftCore] Failed to send join_query: " + e.getMessage());
                        }
                    }, 1500, TimeUnit.MILLISECONDS);
                }
            }
        });

        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            ServerPlayer player = handler.getPlayer();
            if (player != null) {
                String username = player.getName().getString();
                String uuid = player.getStringUUID();
                ConfigManager.updatePlayerLastOnline(username);

                CraftCoreWSClient client = CraftCoreMod.getWSClient();
                if (client != null && client.isAuthenticated()) {
                    client.send(new Packet("event", new Packet.EventPayload(
                            "leave", username, uuid, username + " left the game"
                    )));
                }
            }
        });

        ServerMessageEvents.CHAT_MESSAGE.register((message, sender, params) -> {
            String username = sender.getName().getString();
            String uuid = sender.getStringUUID();
            String content = message.signedContent();

            CraftCoreWSClient client = CraftCoreMod.getWSClient();
            if (client != null && client.isAuthenticated()) {
                client.send(new Packet("chat", new Packet.ChatPayload(username, uuid, content)));
            }
        });
    }

    public static synchronized void startTelemetryLoop(MinecraftServer server, CraftCoreWSClient client) {
        if (telemetryScheduler == null || telemetryScheduler.isShutdown()) {
            telemetryScheduler = Executors.newSingleThreadScheduledExecutor();
            telemetryScheduler.scheduleAtFixedRate(() -> {
                try {
                    if (client != null && client.isAuthenticated()) {
                        server.execute(() -> {
                            try {
                                double tps = Math.min(20.0, 1000.0 / (server.getAverageTickTimeNanos() / 1_000_000.0));
                                int totalPing = 0;
                                List<ServerPlayer> players = server.getPlayerList().getPlayers();
                                List<String> playerNames = new ArrayList<>();
                                for (ServerPlayer p : players) {
                                    totalPing += p.connection.latency();
                                    playerNames.add(p.getName().getString());
                                }
                                int avgPing = players.isEmpty() ? 0 : totalPing / players.size();
                                int currentPlayers = players.size();
                                int maxPlayers = server.getPlayerList().getMaxPlayers();

                                Packet.StatusPayload payload = new Packet.StatusPayload(
                                        true, tps, avgPing, currentPlayers, maxPlayers, playerNames
                                    );
                                Packet packet = new Packet("status", payload);
                                CompletableFuture.runAsync(() -> {
                                    try {
                                        client.send(packet);
                                    } catch (Exception e) {
                                        System.err.println("[CraftCore] Error sending telemetry packet: " + e.getMessage());
                                    }
                                });
                            } catch (Exception e) {
                                System.err.println("[CraftCore] Error gathering telemetry statistics: " + e.getMessage());
                            }
                        });
                    }
                } catch (Exception e) {
                    System.err.println("[CraftCore] Error in telemetry loop: " + e.getMessage());
                }
            }, 10, 10, TimeUnit.SECONDS);
            System.out.println("[CraftCore] Started 10s status telemetry loop.");
        }
    }

    public static synchronized void stopTelemetryLoop() {
        if (telemetryScheduler != null) {
            telemetryScheduler.shutdown();
            try {
                if (!telemetryScheduler.awaitTermination(2, TimeUnit.SECONDS)) {
                    telemetryScheduler.shutdownNow();
                }
            } catch (InterruptedException e) {
                telemetryScheduler.shutdownNow();
            }
            telemetryScheduler = null;
            System.out.println("[CraftCore] Stopped status telemetry loop.");
        }
    }
}
