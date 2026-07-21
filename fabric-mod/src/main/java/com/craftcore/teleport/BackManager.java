package com.craftcore.teleport;

import com.craftcore.event.ServerLifecycleHandler;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;

import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class BackManager {

    public static class LocationRecord {
        public final ServerLevel level;
        public final BlockPos pos;
        public final float yaw;
        public final float pitch;

        public LocationRecord(ServerLevel level, BlockPos pos, float yaw, float pitch) {
            this.level = level;
            this.pos = pos;
            this.yaw = yaw;
            this.pitch = pitch;
        }
    }

    private static final Map<String, LocationRecord> lastLocations = new ConcurrentHashMap<>();
    private static final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

    public static void recordLocation(ServerPlayer player) {
        if (player == null || player.level() == null) return;
        String username = player.getName().getString();
        ServerLevel level = (ServerLevel) player.level();
        BlockPos pos = player.blockPosition();
        float yaw = player.getYRot();
        float pitch = player.getXRot();
        lastLocations.put(username, new LocationRecord(level, pos, yaw, pitch));
    }

    public static LocationRecord getLastLocation(String username) {
        return lastLocations.get(username);
    }

    public static void executeBack(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();
        LocationRecord loc = lastLocations.get(username);

        if (loc == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您目前沒有任何可返回的死亡點或傳送點！"));
            return;
        }

        player.sendSystemMessage(Component.literal("§b[Craft-Core] §f將於 5 秒後將您傳送回上次地點/死亡點，期間請勿移動..."));

        BlockPos initialPos = player.blockPosition();

        scheduler.schedule(() -> {
            try {
                MinecraftServer server = ServerLifecycleHandler.serverInstance;
                if (server != null) {
                    server.execute(() -> {
                        BlockPos currentPos = player.blockPosition();
                        if (Math.abs(currentPos.getX() - initialPos.getX()) > 1 ||
                            Math.abs(currentPos.getY() - initialPos.getY()) > 1 ||
                            Math.abs(currentPos.getZ() - initialPos.getZ()) > 1) {
                            player.sendSystemMessage(Component.literal("§c[Craft-Core] 傳送已取消：偵測到您在猶豫期間移動了位置！"));
                            return;
                        }

                        // 記錄當前位置為新的返回點，便於二次返回
                        recordLocation(player);

                        player.teleportTo(loc.level, loc.pos.getX() + 0.5, loc.pos.getY(), loc.pos.getZ() + 0.5, Collections.emptySet(), loc.yaw, loc.pitch, true);
                        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ENDERMAN_TELEPORT, net.minecraft.sounds.SoundSource.PLAYERS, 1.0f, 1.0f);
                        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功返回上一次的地點/死亡點！"));
                    });
                }
            } catch (Exception e) {
                System.err.println("[CraftCore] Error executing back teleport: " + e.getMessage());
            }
        }, 5, TimeUnit.SECONDS);
    }
}
