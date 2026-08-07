package com.craftcore.teleport;

import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.network.chat.Style;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class TeleportRequestManager {
    public static class Request {
        public String sender;
        public String receiver;
        public String type; // "tpa" or "tpahere"
        public long createdAt;

        public Request(String sender, String receiver, String type) {
            this.sender = sender;
            this.receiver = receiver;
            this.type = type;
            this.createdAt = System.currentTimeMillis();
        }

        public boolean isExpired() {
            return System.currentTimeMillis() - createdAt > 60_000;
        }
    }

    public static class WarmupTask {
        public String playerToTeleport;
        public String destinationPlayer;
        public double startX, startY, startZ;
        public String dimension;
        public int ticksRemaining;

        public WarmupTask(String playerToTeleport, String destinationPlayer, double x, double y, double z, String dimension) {
            this.playerToTeleport = playerToTeleport;
            this.destinationPlayer = destinationPlayer;
            this.startX = x;
            this.startY = y;
            this.startZ = z;
            this.dimension = dimension;
            this.ticksRemaining = 100; // 5 seconds * 20 ticks
        }
    }

    private static final List<Request> pendingRequests = new ArrayList<>();
    private static final List<WarmupTask> activeWarmups = new ArrayList<>();

    public static void registerEvents() {
        ServerTickEvents.END_SERVER_TICK.register(server -> {
            tick(server);
        });

        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            ServerPlayer player = handler.getPlayer();
            if (player != null) {
                String name = player.getName().getString();
                cancelAllForPlayer(name, server, "離線");
            }
        });
    }

    private static synchronized void tick(MinecraftServer server) {
        // Clean expired requests
        pendingRequests.removeIf(Request::isExpired);

        // Process warmups
        Iterator<WarmupTask> it = activeWarmups.iterator();
        while (it.hasNext()) {
            WarmupTask task = it.next();
            ServerPlayer player = server.getPlayerList().getPlayerByName(task.playerToTeleport);
            ServerPlayer dest = server.getPlayerList().getPlayerByName(task.destinationPlayer);

            if (player == null || dest == null) {
                if (player != null) {
                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 傳送目標已離線，傳送取消！"));
                }
                if (dest != null) {
                    dest.sendSystemMessage(Component.literal("§c[Craft-Core] 傳送玩家已離線，傳送取消！"));
                }
                it.remove();
                continue;
            }

            // Movement detection
            double dx = Math.abs(player.getX() - task.startX);
            double dy = Math.abs(player.getY() - task.startY);
            double dz = Math.abs(player.getZ() - task.startZ);

            if (dx > 0.1 || dy > 0.1 || dz > 0.1) {
                player.sendSystemMessage(Component.literal("§c[Craft-Core] [傳送取消] 檢測到您的位置發生移動！"));
                dest.sendSystemMessage(Component.literal("§c[Craft-Core] [傳送取消] 對方在猶豫期內移動了位置。"));
                it.remove();
                continue;
            }

            task.ticksRemaining--;
            if (task.ticksRemaining <= 0) {
                // Execute Teleport
                ServerLevel destLevel = (ServerLevel) dest.level();
                player.teleportTo(destLevel, dest.getX(), dest.getY(), dest.getZ(), java.util.Collections.emptySet(), dest.getYRot(), dest.getXRot(), true);
                player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ENDERMAN_TELEPORT, SoundSource.PLAYERS, 1.0f, 1.0f);
                dest.level().playSound(null, dest.getX(), dest.getY(), dest.getZ(), SoundEvents.ENDERMAN_TELEPORT, SoundSource.PLAYERS, 1.0f, 1.0f);

                player.sendSystemMessage(Component.literal("§b[Craft-Core] §a傳送成功！"));
                dest.sendSystemMessage(Component.literal("§b[Craft-Core] §a玩家已傳送至您身邊！"));
                it.remove();
            }
        }
    }

    public static synchronized boolean sendRequest(ServerPlayer sender, ServerPlayer receiver, String type) {
        String sName = sender.getName().getString();
        String rName = receiver.getName().getString();

        // Check duplicate
        pendingRequests.removeIf(r -> r.sender.equals(sName) && r.receiver.equals(rName));
        pendingRequests.add(new Request(sName, rName, type));

        // Send chat to sender with Cancel button
        Component cancelBtn = Component.literal("§c§l[取消]")
                .withStyle(style -> style.withClickEvent(new net.minecraft.network.chat.ClickEvent.RunCommand("/tpa cancel " + rName))
                        .withHoverEvent(new net.minecraft.network.chat.HoverEvent.ShowText(Component.literal("點擊取消此傳送請求"))));

        Component senderMsg = Component.literal("§b[Craft-Core] §f傳送請求已發送給 §e" + rName + "§f。 ").append(cancelBtn);
        sender.sendSystemMessage(senderMsg);

        // Send chat to receiver with Accept / Deny buttons
        Component acceptBtn = Component.literal("§a§l[接受]")
                .withStyle(style -> style.withClickEvent(new net.minecraft.network.chat.ClickEvent.RunCommand("/tpaccept " + sName))
                        .withHoverEvent(new net.minecraft.network.chat.HoverEvent.ShowText(Component.literal("點擊接受傳送"))));

        Component denyBtn = Component.literal("§c§l[拒絕]")
                .withStyle(style -> style.withClickEvent(new net.minecraft.network.chat.ClickEvent.RunCommand("/tpdeny " + sName))
                        .withHoverEvent(new net.minecraft.network.chat.HoverEvent.ShowText(Component.literal("點擊拒絕傳送"))));

        String actionText = type.equalsIgnoreCase("tpa") ? "請求傳送到您身邊。" : "請求將您傳送到對方身邊。";
        Component receiverMsg = Component.literal("§b[Craft-Core] §e" + sName + "§f " + actionText + " ")
                .append(acceptBtn).append(Component.literal(" ")).append(denyBtn);
        receiver.sendSystemMessage(receiverMsg);

        return true;
    }

    public static synchronized boolean cancelRequest(ServerPlayer sender, String targetReceiver) {
        String sName = sender.getName().getString();
        Iterator<Request> it = pendingRequests.iterator();
        boolean found = false;

        while (it.hasNext()) {
            Request r = it.next();
            if (r.sender.equals(sName) && (targetReceiver == null || r.receiver.equalsIgnoreCase(targetReceiver))) {
                it.remove();
                found = true;
                ServerPlayer receiverPlayer = com.craftcore.event.ServerLifecycleHandler.serverInstance.getPlayerList().getPlayerByName(r.receiver);
                if (receiverPlayer != null) {
                    receiverPlayer.sendSystemMessage(Component.literal("§c[Craft-Core] " + sName + " 已取消傳送請求。"));
                }
            }
        }

        if (found) {
            sender.sendSystemMessage(Component.literal("§b[Craft-Core] 已取消發出的傳送請求。"));
        } else {
            sender.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到可取消的傳送請求！"));
        }
        return found;
    }

    public static synchronized boolean acceptRequest(ServerPlayer receiver, String targetSender) {
        String rName = receiver.getName().getString();
        Request foundReq = null;

        for (int i = pendingRequests.size() - 1; i >= 0; i--) {
            Request r = pendingRequests.get(i);
            if (r.receiver.equals(rName) && (targetSender == null || r.sender.equalsIgnoreCase(targetSender))) {
                if (!r.isExpired()) {
                    foundReq = r;
                    pendingRequests.remove(i);
                    break;
                }
            }
        }

        if (foundReq == null) {
            receiver.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到有效的傳送請求或請求已過期！"));
            return false;
        }

        ServerPlayer sender = com.craftcore.event.ServerLifecycleHandler.serverInstance.getPlayerList().getPlayerByName(foundReq.sender);
        if (sender == null) {
            receiver.sendSystemMessage(Component.literal("§c[Craft-Core] 請求方目前不在線上！"));
            return false;
        }

        // Determine who teleports to whom
        ServerPlayer playerToTeleport = foundReq.type.equalsIgnoreCase("tpa") ? sender : receiver;
        ServerPlayer destinationPlayer = foundReq.type.equalsIgnoreCase("tpa") ? receiver : sender;

        // Start 5s warmup task
        activeWarmups.add(new WarmupTask(
                playerToTeleport.getName().getString(),
                destinationPlayer.getName().getString(),
                playerToTeleport.getX(), playerToTeleport.getY(), playerToTeleport.getZ(),
                playerToTeleport.level().dimension().identifier().toString()
        ));

        playerToTeleport.sendSystemMessage(Component.literal("§b[Craft-Core] §a傳送請求已被接受！請保持原地不動 5 秒..."));
        destinationPlayer.sendSystemMessage(Component.literal("§b[Craft-Core] §a您已接受傳送請求，對方將於 5 秒後傳送過來。"));
        return true;
    }

    public static synchronized boolean denyRequest(ServerPlayer receiver, String targetSender) {
        String rName = receiver.getName().getString();
        Iterator<Request> it = pendingRequests.iterator();
        boolean found = false;

        while (it.hasNext()) {
            Request r = it.next();
            if (r.receiver.equals(rName) && (targetSender == null || r.sender.equalsIgnoreCase(targetSender))) {
                it.remove();
                found = true;
                ServerPlayer senderPlayer = com.craftcore.event.ServerLifecycleHandler.serverInstance.getPlayerList().getPlayerByName(r.sender);
                if (senderPlayer != null) {
                    senderPlayer.sendSystemMessage(Component.literal("§c[Craft-Core] " + rName + " 拒絕了您的傳送請求。"));
                }
            }
        }

        if (found) {
            receiver.sendSystemMessage(Component.literal("§b[Craft-Core] 已拒絕傳送請求。"));
        } else {
            receiver.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到可拒絕的傳送請求！"));
        }
        return found;
    }

    public static synchronized void cancelAllForPlayer(String playerName, MinecraftServer server, String reason) {
        pendingRequests.removeIf(r -> r.sender.equalsIgnoreCase(playerName) || r.receiver.equalsIgnoreCase(playerName));
        Iterator<WarmupTask> it = activeWarmups.iterator();
        while (it.hasNext()) {
            WarmupTask task = it.next();
            if (task.playerToTeleport.equalsIgnoreCase(playerName) || task.destinationPlayer.equalsIgnoreCase(playerName)) {
                it.remove();
                String otherName = task.playerToTeleport.equalsIgnoreCase(playerName) ? task.destinationPlayer : task.playerToTeleport;
                ServerPlayer other = server.getPlayerList().getPlayerByName(otherName);
                if (other != null) {
                    other.sendSystemMessage(Component.literal("§c[Craft-Core] 因玩家 " + playerName + " " + reason + "，傳送已取消！"));
                }
            }
        }
    }
}
