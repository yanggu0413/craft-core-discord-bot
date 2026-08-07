package com.craftcore.afk;

import com.craftcore.data.JsonDataStore;
import com.google.gson.reflect.TypeToken;
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
        public float lastYaw;
        public float lastPitch;
        public long lastMoveTimeMs;
        public boolean isAfk;

        public AfkState(double x, double y, double z, float yaw, float pitch, long time) {
            this.lastX = x;
            this.lastY = y;
            this.lastZ = z;
            this.lastYaw = yaw;
            this.lastPitch = pitch;
            this.lastMoveTimeMs = time;
            this.isAfk = false;
        }
    }

    public static class AfkData {
        public Map<String, Boolean> afkSavedStates = new ConcurrentHashMap<>();
    }

    private static final String DATA_FILE = "afk.json";
    private static final Map<UUID, AfkState> playerStates = new ConcurrentHashMap<>();
    private static final long AFK_TIMEOUT_MS = 10 * 60 * 1000L; // 10 minutes
    private static AfkData afkData;

    static {
        loadData();
    }

    public static synchronized void loadData() {
        afkData = JsonDataStore.loadData(DATA_FILE, AfkData.class, new AfkData());
        if (afkData.afkSavedStates == null) afkData.afkSavedStates = new ConcurrentHashMap<>();
    }

    public static synchronized void saveData() {
        JsonDataStore.saveDataAsync(DATA_FILE, afkData);
    }

    public static void registerEvents() {
        try {
            FabricEventsRegistrar.register();
        } catch (Throwable ignored) {}
    }

    private static class FabricEventsRegistrar {
        static void register() {
            net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents.END_SERVER_TICK.register(server -> {
                long now = System.currentTimeMillis();
                for (ServerPlayer player : server.getPlayerList().getPlayers()) {
                    checkPlayerAfk(player, now);
                }
            });

            net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
                playerStates.remove(handler.getPlayer().getUUID());
            });
        }
    }

    public static boolean isAfk(Player player) {
        if (player == null) return false;
        AfkState state = playerStates.get(player.getUUID());
        return state != null && state.isAfk;
    }

    public static boolean toggleAfk(ServerPlayer player) {
        return toggleAfk(player, System.currentTimeMillis());
    }

    public static boolean toggleAfk(ServerPlayer player, long now) {
        UUID uuid = player.getUUID();
        AfkState state = playerStates.computeIfAbsent(uuid,
                ignored -> new AfkState(player.getX(), player.getY(), player.getZ(), player.getYRot(), player.getXRot(), now));

        state.lastX = player.getX();
        state.lastY = player.getY();
        state.lastZ = player.getZ();
        state.lastYaw = player.getYRot();
        state.lastPitch = player.getXRot();
        state.lastMoveTimeMs = now;
        state.isAfk = !state.isAfk;

        afkData.afkSavedStates.put(uuid.toString(), state.isAfk);
        saveData();

        if (state.isAfk) {
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §e您已進入 [AFK] 掛機防護狀態。"));
        } else {
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §7您已手動解除 [AFK] 掛機防護狀態。"));
        }
        updateTabList(player);
        return state.isAfk;
    }

    public static void checkPlayerAfk(ServerPlayer player, long now) {
        UUID uuid = player.getUUID();
        double currentX = player.getX();
        double currentY = player.getY();
        double currentZ = player.getZ();
        float currentYaw = player.getYRot();
        float currentPitch = player.getXRot();

        AfkState state = playerStates.get(uuid);
        if (state == null) {
            playerStates.put(uuid, new AfkState(currentX, currentY, currentZ, currentYaw, currentPitch, now));
            return;
        }

        double dx = currentX - state.lastX;
        double dy = currentY - state.lastY;
        double dz = currentZ - state.lastZ;
        double distSq = dx * dx + dy * dy + dz * dz;

        boolean isHurtOrPushed = player.hurtTime > 0 || player.getLastHurtByMob() != null;
        boolean rotationChanged = Math.abs(currentYaw - state.lastYaw) > 0.5f || Math.abs(currentPitch - state.lastPitch) > 0.5f;

        if (distSq > 0.0001 || rotationChanged) {
            if (isHurtOrPushed || (!rotationChanged && state.isAfk && distSq <= 1.0)) {
                state.lastX = currentX;
                state.lastY = currentY;
                state.lastZ = currentZ;
                return;
            }

            state.lastX = currentX;
            state.lastY = currentY;
            state.lastZ = currentZ;
            state.lastYaw = currentYaw;
            state.lastPitch = currentPitch;
            state.lastMoveTimeMs = now;

            if (state.isAfk) {
                state.isAfk = false;
                afkData.afkSavedStates.put(uuid.toString(), false);
                saveData();
                player.sendSystemMessage(Component.literal("§b[Craft-Core] §7您已手動移動，已解除 [AFK] 掛機防護狀態。"));
                updateTabList(player);
            }
        } else {
            if (!state.isAfk && (now - state.lastMoveTimeMs >= AFK_TIMEOUT_MS)) {
                state.isAfk = true;
                afkData.afkSavedStates.put(uuid.toString(), true);
                saveData();
                player.sendSystemMessage(Component.literal("§b[Craft-Core] §e您已原地靜止超過 10 分鐘，進入 [AFK] 掛機防護狀態！"));
                updateTabList(player);
            }
        }
    }

    public static void updateTabList(ServerPlayer player) {
        if (player.level().getServer() != null) {
            player.level().getServer().getPlayerList().broadcastAll(
                    new ClientboundPlayerInfoUpdatePacket(ClientboundPlayerInfoUpdatePacket.Action.UPDATE_DISPLAY_NAME, player)
            );
        }
    }

    public static void clearAll() {
        playerStates.clear();
    }
}
