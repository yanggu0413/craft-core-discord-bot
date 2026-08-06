package com.craftcore.lobby;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.level.Level;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class LobbyDimensionManager {

    public static final ResourceKey<Level> LOBBY_DIMENSION_KEY = ResourceKey.create(
            Registries.DIMENSION,
            Identifier.parse("craftcore:lobby")
    );

    public static class SpawnData {
        public double x = 0.5;
        public double y = 100.0;
        public double z = 0.5;
        public float yaw = 0.0f;
        public float pitch = 0.0f;
    }

    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static SpawnData spawnData = new SpawnData();
    private static ScheduledExecutorService scheduler;

    static {
        try {
            configPath = com.craftcore.util.FabricPathUtil.getShopConfigDir().resolve("lobby_spawn.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "lobby_spawn.json");
        }
        load();
    }

    public static synchronized void load() {
        if (configPath == null) return;
        if (!Files.exists(configPath)) {
            save();
            return;
        }
        try (BufferedReader reader = Files.newBufferedReader(configPath)) {
            SpawnData loaded = GSON.fromJson(reader, SpawnData.class);
            if (loaded != null) {
                spawnData = loaded;
            }
        } catch (Exception e) {
            System.err.println("[CraftCore] Failed to load lobby_spawn.json: " + e.getMessage());
        }
    }

    public static synchronized void save() {
        if (configPath == null) return;
        try {
            if (configPath.getParent() != null) {
                Files.createDirectories(configPath.getParent());
            }
            try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                GSON.toJson(spawnData, writer);
            }
        } catch (Exception e) {
            System.err.println("[CraftCore] Failed to save lobby_spawn.json: " + e.getMessage());
        }
    }

    public static void setSpawn(ServerPlayer player) {
        if (player == null) return;
        spawnData.x = player.getX();
        spawnData.y = player.getY();
        spawnData.z = player.getZ();
        spawnData.yaw = player.getYRot();
        spawnData.pitch = player.getXRot();
        save();
        player.sendSystemMessage(Component.literal(String.format("§a🏰 [大廳系統] 成功將大廳出生點設定為：(%.1f, %.1f, %.1f)！", spawnData.x, spawnData.y, spawnData.z)));
    }

    public static void teleportToLobby(ServerPlayer player) {
        if (player == null) return;
        MinecraftServer server = player.level().getServer();
        if (server == null) return;

        ServerLevel lobbyLevel = server.getLevel(LOBBY_DIMENSION_KEY);
        if (lobbyLevel == null) {
            for (ServerLevel sl : server.getAllLevels()) {
                if (sl.dimension().identifier().toString().equals("craftcore:lobby")) {
                    lobbyLevel = sl;
                    break;
                }
            }
        }

        if (lobbyLevel == null) {
            player.sendSystemMessage(Component.literal("§c[大廳系統] 大廳維度 craftcore:lobby 正在加載中，請稍後再試！"));
            return;
        }

        player.teleportTo(lobbyLevel, spawnData.x, spawnData.y, spawnData.z, Set.of(), spawnData.yaw, spawnData.pitch, false);
        player.playSound(SoundEvents.ENDERMAN_TELEPORT, 1.0f, 1.0f);
        player.sendSystemMessage(Component.literal("§a🏰 [大廳系統] 成功傳送至全服大廳維度 (craftcore:lobby)！"));
    }

    public static void startLoop(MinecraftServer server) {
        if (scheduler != null && !scheduler.isShutdown()) return;
        scheduler = Executors.newSingleThreadScheduledExecutor();

        scheduler.scheduleAtFixedRate(() -> {
            try {
                if (server != null) {
                    server.execute(() -> {
                        ServerLevel lobbyLevel = server.getLevel(LOBBY_DIMENSION_KEY);
                        if (lobbyLevel != null) {
                            for (ServerPlayer sp : lobbyLevel.players()) {
                                if (sp.getY() < -10) { // Void protection
                                    sp.fallDistance = 0.0f;
                                    sp.teleportTo(lobbyLevel, spawnData.x, spawnData.y, spawnData.z, Set.of(), spawnData.yaw, spawnData.pitch, false);
                                    sp.sendSystemMessage(Component.literal(String.format("§a🏰 [虛空救援] 您已掉落虛空！已安全將您救回大廳出生點 (%.1f, %.1f, %.1f)！", spawnData.x, spawnData.y, spawnData.z)));
                                    sp.playSound(SoundEvents.ENDERMAN_TELEPORT, 1.0f, 1.2f);
                                }
                            }
                            net.minecraft.world.level.saveddata.WeatherData wd = lobbyLevel.getWeatherData();
                            if (wd != null && (wd.isRaining() || wd.isThundering())) {
                                wd.setRaining(false);
                                wd.setThundering(false);
                                wd.setRainTime(0);
                                wd.setThunderTime(0);
                                wd.setClearWeatherTime(120000);
                                wd.setDirty();
                            }
                        }
                    });
                }
            } catch (Throwable t) {
                System.err.println("[CraftCore] Error in Lobby loop: " + t.getMessage());
            }
        }, 0, 3, TimeUnit.SECONDS);
    }
}
