package com.craftcore.teleport;

import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.level.block.state.BlockState;

import java.util.Collections;

public class TeleportUtil {

    public static boolean teleport(ServerPlayer player, ServerLevel targetLevel, double x, double y, double z, float yaw, float pitch) {
        if (player == null || targetLevel == null) return false;

        try {
            player.teleportTo(targetLevel, x, y, z, Collections.emptySet(), yaw, pitch, true);
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(),
                    SoundEvents.ENDERMAN_TELEPORT, SoundSource.PLAYERS, 1.0f, 1.0f);
            return true;
        } catch (Exception e) {
            System.err.println("[CraftCore-Teleport] Failed to teleport player " + player.getName().getString() + ": " + e.getMessage());
            return false;
        }
    }

    public static boolean isSafePosition(ServerLevel level, int x, int y, int z) {
        if (level == null) return false;
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
