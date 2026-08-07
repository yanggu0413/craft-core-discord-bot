package com.craftcore.protection.antixray;

import com.craftcore.api.RebrandEngine;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundBlockUpdatePacket;
import net.minecraft.network.protocol.game.ClientboundSetSubtitleTextPacket;
import net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class HoneypotTrapManager {
    private static final Map<UUID, Map<BlockPos, BlockState>> playerTraps = new ConcurrentHashMap<>();
    private static final Random RANDOM = new Random();

    public static void generateTrapForPlayer(ServerPlayer player) {
        if (player == null) return;

        ServerLevel level = player.level();
        String dimId = level.dimension().identifier().toString();

        BlockState fakeState;
        int trapCount;

        if ("minecraft:the_nether".equalsIgnoreCase(dimId)) {
            fakeState = Blocks.ANCIENT_DEBRIS.defaultBlockState();
            trapCount = 2;
        } else if ("minecraft:overworld".equalsIgnoreCase(dimId)) {
            if (player.getBlockY() < 0) {
                fakeState = Blocks.DEEPSLATE_DIAMOND_ORE.defaultBlockState();
            } else {
                fakeState = Blocks.DIAMOND_ORE.defaultBlockState();
            }
            trapCount = 5;
        } else {
            return;
        }

        BlockPos playerPos = player.blockPosition();
        BlockPos candidatePos = null;

        for (int attempt = 0; attempt < 30; attempt++) {
            int dx = (RANDOM.nextBoolean() ? 1 : -1) * (2 + RANDOM.nextInt(3));
            int dy = RANDOM.nextInt(3) - 1;
            int dz = (RANDOM.nextBoolean() ? 1 : -1) * (2 + RANDOM.nextInt(3));

            BlockPos checkPos = playerPos.offset(dx, dy, dz);
            BlockState checkState = level.getBlockState(checkPos);

            if (!checkState.isAir() && checkState.isRedstoneConductor(level, checkPos) && !AntiXrayManager.isExposed(level, checkPos)) {
                candidatePos = checkPos;
                break;
            }
        }

        if (candidatePos == null) return;

        Map<BlockPos, BlockState> trapsMap = playerTraps.computeIfAbsent(player.getUUID(), k -> new ConcurrentHashMap<>());
        trapsMap.clear();

        List<BlockPos> trapPositions = new ArrayList<>();
        trapPositions.add(candidatePos);

        for (net.minecraft.core.Direction dir : net.minecraft.core.Direction.values()) {
            if (trapPositions.size() >= trapCount) break;
            BlockPos neighbor = candidatePos.relative(dir);
            BlockState neighborState = level.getBlockState(neighbor);
            if (!neighborState.isAir() && neighborState.isRedstoneConductor(level, neighbor) && !AntiXrayManager.isExposed(level, neighbor)) {
                trapPositions.add(neighbor);
            }
        }

        for (BlockPos pos : trapPositions) {
            trapsMap.put(pos, fakeState);
            player.connection.send(new ClientboundBlockUpdatePacket(pos, fakeState));
        }
    }

    public static boolean checkAndTriggerTrap(ServerPlayer player, BlockPos pos) {
        if (player == null || pos == null) return false;

        Map<BlockPos, BlockState> trapsMap = playerTraps.get(player.getUUID());
        if (trapsMap == null || !trapsMap.containsKey(pos)) {
            return false;
        }

        trapsMap.remove(pos);

        // Reset block on client so player sees actual server block state
        player.connection.send(new ClientboundBlockUpdatePacket(pos, player.level().getBlockState(pos)));

        // Send screen title alert
        player.connection.send(new ClientboundSetTitleTextPacket(Component.literal("§c§l【系統警告】")));
        player.connection.send(new ClientboundSetSubtitleTextPacket(Component.literal("§f請勿使用透視外掛！")));

        // Play warning sounds
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ELDER_GUARDIAN_CURSE, SoundSource.PLAYERS, 1.0F, 1.0F);
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ANVIL_LAND, SoundSource.PLAYERS, 1.0F, 1.0F);

        // Send system message to player
        player.sendSystemMessage(RebrandEngine.rebrandText("§c[%server_name% 防外掛] 警告：系統檢測到您嘗試挖掘透視假礦！請立即停止違規行為。"));

        System.err.println("[CraftCore] AntiXray Alert: Player " + player.getName().getString() + " triggered honeypot trap at " + pos.toShortString());

        // Alert online OPs
        if (player.level().getServer() != null) {
            String alertMsg = RebrandEngine.rebrand("§c[%server_name% 防外掛] 玩家 §e" + player.getName().getString() + " §c在 §f" + pos.toShortString() + " §c觸發透視假礦陷阱！");
            for (ServerPlayer opPlayer : player.level().getServer().getPlayerList().getPlayers()) {
                if (opPlayer.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER)) {
                    opPlayer.sendSystemMessage(Component.literal(alertMsg));
                }
            }
        }


        // Generate next trap
        generateTrapForPlayer(player);
        return true;
    }

    public static void clearTraps(UUID uuid) {
        if (uuid != null) {
            playerTraps.remove(uuid);
        }
    }
}
