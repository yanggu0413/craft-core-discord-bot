package com.craftcore.rtp;

import com.craftcore.back.BackManager;
import com.craftcore.teleport.TeleportUtil;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.block.state.BlockState;

import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

public class RtpManager {

    private static final Map<String, Long> rtpCooldowns = new ConcurrentHashMap<>();
    private static final Random random = new Random();

    public static int executeRtp(ServerPlayer player) {
        if (player == null) return 0;

        String username = player.getName().getString();
        long now = System.currentTimeMillis();
        Long lastRtp = rtpCooldowns.get(username.toLowerCase());
        if (lastRtp != null && now - lastRtp < 60_000) {
            long secLeft = 60 - (now - lastRtp) / 1000;
            player.sendSystemMessage(Component.literal("§c[Craft-Core] RTP 冷卻中，請等待 " + secLeft + " 秒！"));
            return 0;
        }

        ServerLevel world = (ServerLevel) player.level();

        for (int attempts = 0; attempts < 25; attempts++) {
            double rx = player.getX() + (random.nextDouble() * 6000 - 3000);
            double rz = player.getZ() + (random.nextDouble() * 6000 - 3000);
            int blockX = (int) rx;
            int blockZ = (int) rz;
            int startY = 120;
            int minY = 10;

            if (!world.dimension().identifier().getPath().contains("nether")) {
                startY = 310;
                minY = -60;
            }

            int safeY = -999;
            for (int y = startY; y > minY; y--) {
                BlockPos pos = new BlockPos(blockX, y, blockZ);
                BlockState state = world.getBlockState(pos);
                BlockState stateAbove1 = world.getBlockState(pos.above(1));
                BlockState stateAbove2 = world.getBlockState(pos.above(2));

                if (!state.isAir() && stateAbove1.isAir() && stateAbove2.isAir()) {
                    String key = net.minecraft.core.registries.BuiltInRegistries.BLOCK.getKey(state.getBlock()).toString();
                    if (!key.contains("lava") && !key.contains("water") && !key.contains("air") && !key.contains("fire") && !key.contains("magma")) {
                        safeY = y + 1;
                        break;
                    }
                }
            }

            if (safeY != -999) {
                BackManager.recordLocation(player);
                TeleportUtil.teleport(player, world, blockX + 0.5, (double) safeY, blockZ + 0.5, player.getYRot(), player.getXRot());
                player.sendSystemMessage(Component.literal("§b[Craft-Core] §a已隨機傳送至：X:" + blockX + ", Y:" + safeY + ", Z:" + blockZ));
                rtpCooldowns.put(username.toLowerCase(), now);
                return 1;
            }
        }

        player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到安全的傳送位置，請再試一次！"));
        return 0;
    }
}
