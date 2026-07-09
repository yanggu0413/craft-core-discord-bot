package com.craftcore.event;

import com.craftcore.CraftCoreMod;
import com.craftcore.config.ConfigManager;
import com.craftcore.websocket.Packet;
import com.craftcore.websocket.CraftCoreWSClient;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.network.message.MessageType;
import net.minecraft.network.message.SignedMessage;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class ServerLifecycleHandler {
    private static ScheduledExecutorService telemetryScheduler;

    public static void register() {
        ServerLifecycleEvents.SERVER_STARTED.register(server -> {
            System.out.println("[CraftCore] Server started. Initializing WebSocket connection.");
            ConfigManager.loadConfig();
            ConfigManager.loadPlayers();
            CraftCoreMod.startWSClient(server);
        });

        ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
            System.out.println("[CraftCore] Server stopping. Cleaning up resources.");
            stopTelemetryLoop();
            CraftCoreMod.stopWSClient();
        });

        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayerEntity player = handler.getPlayer();
            if (player != null) {
                String username = player.getName().getString();
                String uuid = player.getUuidAsString();

                CraftCoreWSClient client = CraftCoreMod.getWSClient();
                if (client != null && client.isAuthenticated()) {
                    client.send(new Packet("event", new Packet.EventPayload(
                            "join", username, uuid, username + " joined the game"
                    )));
                }
            }
        });

        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            ServerPlayerEntity player = handler.getPlayer();
            if (player != null) {
                String username = player.getName().getString();
                String uuid = player.getUuidAsString();
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
            String uuid = sender.getUuidAsString();
            String content = message.getContent().getString();

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
                                double tps = Math.min(20.0, 1000.0 / server.getAverageTickTime());
                                int totalPing = 0;
                                List<ServerPlayerEntity> players = server.getPlayerManager().getPlayerList();
                                List<String> playerNames = new ArrayList<>();
                                for (ServerPlayerEntity p : players) {
                                    totalPing += p.networkHandler.getLatency();
                                    playerNames.add(p.getName().getString());
                                }
                                int avgPing = players.isEmpty() ? 0 : totalPing / players.size();
                                int currentPlayers = players.size();
                                int maxPlayers = server.getPlayerManager().getMaxPlayerCount();

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
