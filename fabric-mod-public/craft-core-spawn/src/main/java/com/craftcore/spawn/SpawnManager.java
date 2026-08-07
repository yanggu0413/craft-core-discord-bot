package com.craftcore.spawn;

import com.craftcore.back.BackManager;
import com.craftcore.data.AsyncSaveExecutor;
import com.craftcore.teleport.TeleportUtil;
import com.craftcore.util.FabricPathUtil;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.nio.file.Files;
import java.nio.file.Path;

public class SpawnManager {

    public static class SpawnData {
        public double x = 0.5;
        public double y = 70.0;
        public double z = 0.5;
        public float yaw = 0.0f;
        public float pitch = 0.0f;
        public String dimension = "minecraft:overworld";
    }

    private static final Path CONFIG_PATH = FabricPathUtil.getDataFile("spawn.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static SpawnData spawnData = new SpawnData();

    static {
        load();
    }

    public static synchronized void load() {
        if (CONFIG_PATH != null && Files.exists(CONFIG_PATH)) {
            try (BufferedReader reader = Files.newBufferedReader(CONFIG_PATH)) {
                SpawnData loaded = GSON.fromJson(reader, SpawnData.class);
                if (loaded != null) {
                    spawnData = loaded;
                }
            } catch (Exception e) {
                System.err.println("[CraftCore-Spawn] Failed to load spawn.json: " + e.getMessage());
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
                    GSON.toJson(spawnData, writer);
                }
            } catch (Exception e) {
                System.err.println("[CraftCore-Spawn] Failed to save spawn.json: " + e.getMessage());
            }
        }
    }

    public static void setSpawn(ServerPlayer player) {
        if (player == null) return;
        spawnData.x = player.getX();
        spawnData.y = player.getY();
        spawnData.z = player.getZ();
        spawnData.yaw = player.getYRot();
        spawnData.pitch = player.getXRot();
        spawnData.dimension = player.level().dimension().identifier().toString();

        AsyncSaveExecutor.submit(SpawnManager::save);
        player.sendSystemMessage(Component.literal(String.format("§a📍 [出生點] 成功將伺服器 Spawn 設定為：(%.1f, %.1f, %.1f)！", spawnData.x, spawnData.y, spawnData.z)));
    }

    public static boolean teleportToSpawn(ServerPlayer player) {
        if (player == null) return false;
        MinecraftServer server = player.level().getServer();
        if (server == null) return false;

        ServerLevel spawnLevel = null;
        for (ServerLevel level : server.getAllLevels()) {
            if (level.dimension().identifier().toString().equalsIgnoreCase(spawnData.dimension)) {
                spawnLevel = level;
                break;
            }
        }

        if (spawnLevel == null) {
            spawnLevel = server.overworld();
        }

        if (spawnLevel == null) {
            player.sendSystemMessage(Component.literal("§c[出生點] Spawn 所在世界未載入！"));
            return false;
        }

        BackManager.recordLocation(player);
        TeleportUtil.teleport(player, spawnLevel, spawnData.x, spawnData.y, spawnData.z, spawnData.yaw, spawnData.pitch);
        player.sendSystemMessage(Component.literal("§a📍 [出生點] 成功傳送至伺服器 Spawn！"));
        return true;
    }
}
