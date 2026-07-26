package com.craftcore.antixray;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundBlockUpdatePacket;
import net.minecraft.network.protocol.game.ClientboundSetSubtitleTextPacket;
import net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class HoneypotTrapManager {

    private static final Map<UUID, Map<BlockPos, BlockState>> playerTraps = new ConcurrentHashMap<>();
    private static final Random RANDOM = new Random();

    public static void generateTrapForPlayer(ServerPlayer player) {
        if (player == null) return;
        Level level = player.level();
        String dim = level.dimension().identifier().toString();

        BlockState fakeState;
        int count;

        if ("minecraft:the_nether".equalsIgnoreCase(dim)) {
            fakeState = Blocks.ANCIENT_DEBRIS.defaultBlockState();
            count = 2; // 地獄：2 個遠古殘骸
        } else if ("minecraft:overworld".equalsIgnoreCase(dim)) {
            fakeState = (player.getBlockY() < 0) ? Blocks.DEEPSLATE_DIAMOND_ORE.defaultBlockState() : Blocks.DIAMOND_ORE.defaultBlockState();
            count = 5; // 主世界：5 個鑽石礦
        } else {
            return;
        }

        BlockPos playerPos = player.blockPosition();
        BlockPos centerPos = null;

        for (int attempt = 0; attempt < 30; attempt++) {
            // Generate very close to player (2 to 4 blocks away inside solid wall)
            int dx = (RANDOM.nextBoolean() ? 1 : -1) * (2 + RANDOM.nextInt(3));
            int dy = RANDOM.nextInt(3) - 1;
            int dz = (RANDOM.nextBoolean() ? 1 : -1) * (2 + RANDOM.nextInt(3));
            BlockPos check = playerPos.offset(dx, dy, dz);

            BlockState st = level.getBlockState(check);
            if (!st.isAir() && st.isRedstoneConductor(level, check) && !AntiXrayManager.isExposed(level, check)) {
                centerPos = check;
                break;
            }
        }

        if (centerPos == null) return;

        Map<BlockPos, BlockState> trapMap = playerTraps.computeIfAbsent(player.getUUID(), k -> new ConcurrentHashMap<>());
        trapMap.clear();

        List<BlockPos> positions = new ArrayList<>();
        positions.add(centerPos);

        for (Direction dir : Direction.values()) {
            if (positions.size() >= count) break;
            BlockPos adj = centerPos.relative(dir);
            BlockState st = level.getBlockState(adj);
            if (!st.isAir() && st.isRedstoneConductor(level, adj) && !AntiXrayManager.isExposed(level, adj)) {
                positions.add(adj);
            }
        }

        for (BlockPos p : positions) {
            trapMap.put(p, fakeState);
            player.connection.send(new ClientboundBlockUpdatePacket(p, fakeState));
        }
    }

    public static boolean checkAndTriggerTrap(ServerPlayer player, BlockPos pos) {
        if (player == null || pos == null) return false;
        Map<BlockPos, BlockState> trapMap = playerTraps.get(player.getUUID());
        if (trapMap != null && trapMap.containsKey(pos)) {
            trapMap.remove(pos);

            // Restore real block state on client
            player.connection.send(new ClientboundBlockUpdatePacket(pos, player.level().getBlockState(pos)));

            // Big Screen Title Warning
            player.connection.send(new ClientboundSetTitleTextPacket(Component.literal("§c§l【嚴重警告】")));
            player.connection.send(new ClientboundSetSubtitleTextPacket(Component.literal("§f請立刻將透視功能關閉！")));

            // Play warning sounds
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(),
                    SoundEvents.ELDER_GUARDIAN_CURSE, SoundSource.PLAYERS, 1.0F, 1.0F);
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(),
                    SoundEvents.ANVIL_LAND, SoundSource.PLAYERS, 1.0F, 1.0F);

            // System Message
            player.sendSystemMessage(Component.literal("§c[Craft-Core 防作弊] 警告：系統檢測到您試圖採礦隱藏的蜜罐陷阱！請立刻關閉透視功能。"));

            System.err.println("[CraftCore AntiCheat] WARNING: Player " + player.getName().getString() + " triggered X-Ray Honeypot Trap at " + pos);

            // Notify online ops/admins
            net.minecraft.server.MinecraftServer server = com.craftcore.event.ServerLifecycleHandler.serverInstance;
            if (server != null) {
                String alert = "§c[防作弊警報] 玩家 §e" + player.getName().getString() + " §c踩中 X-Ray 蜜罐陷阱 (" + pos.toShortString() + ")！";
                for (ServerPlayer op : server.getPlayerList().getPlayers()) {
                    if (op.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER)) {
                        op.sendSystemMessage(Component.literal(alert));
                    }
                }
            }
            return true;
        }
        return false;
    }

    public static void clearTraps(UUID uuid) {
        playerTraps.remove(uuid);
    }
}
