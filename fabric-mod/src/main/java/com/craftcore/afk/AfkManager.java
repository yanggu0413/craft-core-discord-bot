package com.craftcore.afk;

import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundPlayerInfoUpdatePacket;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Player;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class AfkManager {
    public static class AfkState {
        public double lastX;
        public double lastY;
        public double lastZ;
        public long lastMoveTimeMs;
        public boolean isAfk;

        public AfkState(double x, double y, double z, long time) {
            this.lastX = x;
            this.lastY = y;
            this.lastZ = z;
            this.lastMoveTimeMs = time;
            this.isAfk = false;
        }
    }

    private static final Map<UUID, AfkState> playerStates = new ConcurrentHashMap<>();
    private static final long AFK_TIMEOUT_MS = 10 * 60 * 1000L; // 10 minutes

    public static void registerEvents() {
        ServerTickEvents.END_SERVER_TICK.register(server -> {
            long now = System.currentTimeMillis();
            for (ServerPlayer player : server.getPlayerList().getPlayers()) {
                checkPlayerAfk(player, now);
            }
        });

        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            playerStates.remove(handler.getPlayer().getUUID());
        });
    }

    public static boolean isAfk(Player player) {
        if (player == null) return false;
        AfkState state = playerStates.get(player.getUUID());
        return state != null && state.isAfk;
    }

    public static void checkPlayerAfk(ServerPlayer player, long now) {
        UUID uuid = player.getUUID();
        double currentX = player.getX();
        double currentY = player.getY();
        double currentZ = player.getZ();

        AfkState state = playerStates.get(uuid);
        if (state == null) {
            playerStates.put(uuid, new AfkState(currentX, currentY, currentZ, now));
            return;
        }

        double dx = currentX - state.lastX;
        double dy = currentY - state.lastY;
        double dz = currentZ - state.lastZ;
        double distSq = dx * dx + dy * dy + dz * dz;

        // Position change > 0.01 blocks (distSq > 0.0001) resets AFK timer
        if (distSq > 0.0001) {
            state.lastX = currentX;
            state.lastY = currentY;
            state.lastZ = currentZ;
            state.lastMoveTimeMs = now;

            if (state.isAfk) {
                state.isAfk = false;
                player.sendSystemMessage(Component.literal("§b[Craft-Core] §7您已移動，已解除 [AFK] 掛機防護狀態。"));
                updateTabList(player);
            }
        } else {
            // Player hasn't moved position
            if (!state.isAfk && (now - state.lastMoveTimeMs >= AFK_TIMEOUT_MS)) {
                state.isAfk = true;
                player.sendSystemMessage(Component.literal("§b[Craft-Core] §e您已原地靜止超過 10 分鐘，進入 [AFK] 掛機防護狀態！"));
                updateTabList(player);
            }
        }
    }

    public static void updateTabList(ServerPlayer player) {
        if (com.craftcore.event.ServerLifecycleHandler.serverInstance != null) {
            com.craftcore.event.ServerLifecycleHandler.serverInstance.getPlayerList().broadcastAll(
                    new ClientboundPlayerInfoUpdatePacket(ClientboundPlayerInfoUpdatePacket.Action.UPDATE_DISPLAY_NAME, player)
            );
        }
    }

    public static void clearAll() {
        playerStates.clear();
    }
}
