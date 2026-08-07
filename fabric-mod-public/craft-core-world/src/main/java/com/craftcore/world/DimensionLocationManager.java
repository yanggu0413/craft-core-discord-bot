package com.craftcore.world;

import com.craftcore.data.AsyncSaveExecutor;
import com.craftcore.util.FabricPathUtil;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.block.state.BlockState;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class DimensionLocationManager {

    public static class DimPos {
        public double x;
        public double y;
        public double z;
        public float yaw;
        public float pitch;

        public DimPos() {}

        public DimPos(double x, double y, double z, float yaw, float pitch) {
            this.x = x;
            this.y = y;
            this.z = z;
            this.yaw = yaw;
            this.pitch = pitch;
        }
    }

    private static final Path CONFIG_PATH = FabricPathUtil.getDataFile("dimensions.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, Map<String, DimPos>> lastDimLocations = new ConcurrentHashMap<>();

    static {
        load();
    }

    public static synchronized void load() {
        if (CONFIG_PATH != null && Files.exists(CONFIG_PATH)) {
            try (BufferedReader reader = Files.newBufferedReader(CONFIG_PATH)) {
                Map<String, Map<String, DimPos>> loaded = GSON.fromJson(reader, new TypeToken<Map<String, Map<String, DimPos>>>(){}.getType());
                if (loaded != null) {
                    lastDimLocations.clear();
                    lastDimLocations.putAll(loaded);
                }
            } catch (Exception e) {
                System.err.println("[CraftCore-World] Failed to load dimensions.json: " + e.getMessage());
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
                    GSON.toJson(lastDimLocations, writer);
                }
            } catch (Exception e) {
                System.err.println("[CraftCore-World] Failed to save dimensions.json: " + e.getMessage());
            }
        }
    }

    public static synchronized void recordCurrentDimensionLocation(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString().toLowerCase();
        String dim = player.level().dimension().identifier().toString();

        Map<String, DimPos> userMap = lastDimLocations.computeIfAbsent(username, k -> new ConcurrentHashMap<>());
        userMap.put(dim, new DimPos(player.getX(), player.getY(), player.getZ(), player.getYRot(), player.getXRot()));
        AsyncSaveExecutor.submit(DimensionLocationManager::save);
    }

    public static synchronized DimPos getLastLocation(ServerPlayer player, String targetDim) {
        if (player == null || targetDim == null) return null;
        String username = player.getName().getString().toLowerCase();
        Map<String, DimPos> userMap = lastDimLocations.get(username);
        if (userMap != null) {
            return userMap.get(targetDim);
        }
        return null;
    }

    public static DimPos findSafePos(ServerLevel level, DimPos pos) {
        if (level == null || pos == null) return pos;

        int blockX = (int) Math.floor(pos.x);
        int blockY = (int) Math.floor(pos.y);
        int blockZ = (int) Math.floor(pos.z);

        if (isSafePosition(level, blockX, blockY, blockZ)) {
            return pos;
        }

        for (int y = blockY; y <= level.getMaxY() - 2; y++) {
            if (isSafePosition(level, blockX, y, blockZ)) {
                return new DimPos(pos.x, y, pos.z, pos.yaw, pos.pitch);
            }
        }

        for (int y = blockY; y >= level.getMinY(); y--) {
            if (isSafePosition(level, blockX, y, blockZ)) {
                return new DimPos(pos.x, y, pos.z, pos.yaw, pos.pitch);
            }
        }

        return pos;
    }

    private static boolean isSafePosition(ServerLevel level, int x, int y, int z) {
        BlockPos feet = new BlockPos(x, y, z);
        BlockPos head = feet.above();
        BlockPos ground = feet.below();

        BlockState groundState = level.getBlockState(ground);
        BlockState feetState = level.getBlockState(feet);
        BlockState headState = level.getBlockState(head);

        String gKey = net.minecraft.core.registries.BuiltInRegistries.BLOCK.getKey(groundState.getBlock()).toString();
        if (gKey.contains("lava") || gKey.contains("fire") || gKey.contains("air") || gKey.contains("magma")) {
            return false;
        }

        String fKey = net.minecraft.core.registries.BuiltInRegistries.BLOCK.getKey(feetState.getBlock()).toString();
        String hKey = net.minecraft.core.registries.BuiltInRegistries.BLOCK.getKey(headState.getBlock()).toString();

        return (feetState.isAir() || !feetState.isRedstoneConductor(level, feet)) &&
               (headState.isAir() || !headState.isRedstoneConductor(level, head)) &&
               !fKey.contains("lava") && !hKey.contains("lava");
    }
}
