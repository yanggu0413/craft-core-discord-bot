package com.craftcore.teleport;

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

    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    // Key: username.toLowerCase() -> (dimensionIdentifier -> DimPos)
    private static final Map<String, Map<String, DimPos>> lastDimLocations = new ConcurrentHashMap<>();

    static {
        try {
            configPath = com.craftcore.util.FabricPathUtil.getShopConfigDir().resolve("dimension_locations.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "dimension_locations.json");
        }
        load();
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Map<String, Map<String, DimPos>> loaded = GSON.fromJson(reader, new TypeToken<Map<String, Map<String, DimPos>>>(){}.getType());
                if (loaded != null) {
                    lastDimLocations.clear();
                    lastDimLocations.putAll(loaded);
                }
            } catch (Exception e) {
                System.err.println("[CraftCore] Failed to load dimension_locations.json: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            try {
                Files.createDirectories(configPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                    GSON.toJson(lastDimLocations, writer);
                }
            } catch (Exception e) {
                System.err.println("[CraftCore] Failed to save dimension_locations.json: " + e.getMessage());
            }
        }
    }

    public static synchronized void recordCurrentDimensionLocation(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString().toLowerCase();
        String dim = player.level().dimension().identifier().toString();

        Map<String, DimPos> userMap = lastDimLocations.computeIfAbsent(username, k -> new ConcurrentHashMap<>());
        userMap.put(dim, new DimPos(player.getX(), player.getY(), player.getZ(), player.getYRot(), player.getXRot()));
        save();
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

        // Check if current Y is safe
        if (isSafePosition(level, blockX, blockY, blockZ)) {
            return pos;
        }

        // Search upward for safe ground
        for (int y = blockY; y <= level.getMaxY() - 2; y++) {
            if (isSafePosition(level, blockX, y, blockZ)) {
                return new DimPos(pos.x, y, pos.z, pos.yaw, pos.pitch);
            }
        }

        // Search downward
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

        // Ground must be solid (not lava, water, air, fire)
        String gKey = net.minecraft.core.registries.BuiltInRegistries.BLOCK.getKey(groundState.getBlock()).toString();
        if (gKey.contains("lava") || gKey.contains("fire") || gKey.contains("air") || gKey.contains("magma")) {
            return false;
        }

        // Feet & head must be air/passable
        String fKey = net.minecraft.core.registries.BuiltInRegistries.BLOCK.getKey(feetState.getBlock()).toString();
        String hKey = net.minecraft.core.registries.BuiltInRegistries.BLOCK.getKey(headState.getBlock()).toString();

        return (feetState.isAir() || !feetState.isRedstoneConductor(level, feet)) &&
               (headState.isAir() || !headState.isRedstoneConductor(level, head)) &&
               !fKey.contains("lava") && !hKey.contains("lava");
    }
}
