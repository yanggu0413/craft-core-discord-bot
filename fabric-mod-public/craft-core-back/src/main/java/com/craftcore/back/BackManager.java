package com.craftcore.back;

import com.craftcore.data.AsyncSaveExecutor;
import com.craftcore.util.FabricPathUtil;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class BackManager {

    public static class LocationRecord {
        public double x;
        public double y;
        public double z;
        public float yaw;
        public float pitch;
        public String dimension;

        public LocationRecord() {}

        public LocationRecord(double x, double y, double z, float yaw, float pitch, String dimension) {
            this.x = x;
            this.y = y;
            this.z = z;
            this.yaw = yaw;
            this.pitch = pitch;
            this.dimension = dimension;
        }
    }

    private static final Path CONFIG_PATH = FabricPathUtil.getDataFile("backs.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, LocationRecord> lastLocations = new ConcurrentHashMap<>();
    private static final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

    static {
        load();
    }

    public static synchronized void load() {
        if (CONFIG_PATH != null && Files.exists(CONFIG_PATH)) {
            try (BufferedReader reader = Files.newBufferedReader(CONFIG_PATH)) {
                Map<String, LocationRecord> loaded = GSON.fromJson(reader, new TypeToken<Map<String, LocationRecord>>(){}.getType());
                if (loaded != null) {
                    lastLocations.clear();
                    lastLocations.putAll(loaded);
                }
            } catch (Exception e) {
                System.err.println("[CraftCore-Back] Failed to load backs.json: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (CONFIG_PATH != null) {
            try {
                if (CONFIG_PATH.getParent() != null) {
                    Files.createDirectories(CONFIG_PATH.getParent());
                }
                try (BufferedWriter writer = Files.newBufferedWriter(CONFIG_PATH)) {
                    GSON.toJson(lastLocations, writer);
                }
            } catch (Exception e) {
                System.err.println("[CraftCore-Back] Failed to save backs.json: " + e.getMessage());
            }
        }
    }

    public static void recordLocation(ServerPlayer player) {
        if (player == null || player.level() == null) return;
        String username = player.getName().getString().toLowerCase();
        double x = player.getX();
        double y = player.getY();
        double z = player.getZ();
        float yaw = player.getYRot();
        float pitch = player.getXRot();
        String dimension = player.level().dimension().identifier().toString();

        lastLocations.put(username, new LocationRecord(x, y, z, yaw, pitch, dimension));
        AsyncSaveExecutor.submit(BackManager::save);
    }

    public static LocationRecord getLastLocation(String username) {
        return lastLocations.get(username.toLowerCase());
    }

    public static void executeBack(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString().toLowerCase();
        LocationRecord loc = lastLocations.get(username);

        if (loc == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您目前沒有任何可返回的死亡點或傳送點！"));
            return;
        }

        player.sendSystemMessage(Component.literal("§b[Craft-Core] §f將於 5 秒後將您傳送回上次地點/死亡點，期間請勿移動..."));

        BlockPos initialPos = player.blockPosition();

        scheduler.schedule(() -> {
            try {
                MinecraftServer server = player.level().getServer();
                if (server != null) {
                    server.execute(() -> {
                        BlockPos currentPos = player.blockPosition();
                        if (Math.abs(currentPos.getX() - initialPos.getX()) > 1 ||
                            Math.abs(currentPos.getY() - initialPos.getY()) > 1 ||
                            Math.abs(currentPos.getZ() - initialPos.getZ()) > 1) {
                            player.sendSystemMessage(Component.literal("§c[Craft-Core] 傳送已取消：偵測到您在猶豫期間移動了位置！"));
                            return;
                        }

                        ServerLevel targetLevel = null;
                        for (ServerLevel sl : server.getAllLevels()) {
                            if (sl.dimension().identifier().toString().equalsIgnoreCase(loc.dimension)) {
                                targetLevel = sl;
                                break;
                            }
                        }

                        if (targetLevel == null) {
                            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到原地點所在的世界維度！"));
                            return;
                        }

                        // Record current position as new back location prior to teleport
                        recordLocation(player);

                        player.teleportTo(targetLevel, loc.x, loc.y, loc.z, Collections.emptySet(), loc.yaw, loc.pitch, true);
                        player.level().playSound(null, player.getX(), player.getY(), player.getZ(),
                                SoundEvents.ENDERMAN_TELEPORT, SoundSource.PLAYERS, 1.0f, 1.0f);
                        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功返回上一次的地點/死亡點！"));
                    });
                }
            } catch (Exception e) {
                System.err.println("[CraftCore-Back] Error executing back teleport: " + e.getMessage());
            }
        }, 5, TimeUnit.SECONDS);
    }
}
