package com.craftcore.mining;

import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Blocks;

import java.time.DayOfWeek;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class MiningDimensionManager {

    public static final ResourceKey<Level> MINING_DIMENSION_KEY = ResourceKey.create(Registries.DIMENSION, Identifier.parse("craftcore:mining"));
    private static final Random random = new Random();
    private static ScheduledExecutorService scheduler = null;

    public static ResourceKey<Level> getMiningDimensionKey() {
        return MINING_DIMENSION_KEY;
    }

    public static void startLoop(MinecraftServer server) {
        if (scheduler != null && !scheduler.isShutdown()) return;
        scheduler = Executors.newSingleThreadScheduledExecutor();

        // Check for Monday 04:00 AM reset
        scheduler.scheduleAtFixedRate(() -> {
            try {
                ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Taipei"));
                if (now.getDayOfWeek() == DayOfWeek.MONDAY && now.getHour() == 4 && now.getMinute() == 0 && now.getSecond() < 10) {
                    if (server != null) {
                        server.execute(() -> {
                            evacuatePlayers(server);
                            server.getPlayerList().broadcastSystemMessage(Component.literal("§6[資源世界重置] 星期一凌晨 04:00！採礦世界已進行全服週自動重置與刷新！"), false);
                        });
                    }
                }
            } catch (Throwable t) {
                System.err.println("[CraftCore] Error in MiningDimension timer loop: " + t.getMessage());
            }
        }, 0, 10, TimeUnit.SECONDS);
    }

    public static void randomTeleportToMiningDimension(ServerPlayer player) {
        if (player == null) return;
        MinecraftServer server = player.level().getServer();
        if (server == null) return;

        ServerLevel miningLevel = server.getLevel(MINING_DIMENSION_KEY);
        if (miningLevel == null) {
            for (ServerLevel sl : server.getAllLevels()) {
                if (sl.dimension().identifier().toString().equals("craftcore:mining")) {
                    miningLevel = sl;
                    break;
                }
            }
        }

        if (miningLevel == null) {
            player.sendSystemMessage(Component.literal("§c[資源世界] 採礦世界 craftcore:mining 正在加載中，請稍後再試！"));
            return;
        }

        int randX = (random.nextInt(2000) + 100) * (random.nextBoolean() ? 1 : -1);
        int randZ = (random.nextInt(2000) + 100) * (random.nextBoolean() ? 1 : -1);

        // Force chunk loading
        miningLevel.getChunk(new BlockPos(randX, 64, randZ));

        int targetY = 70;
        for (int y = 310; y >= 60; y--) {
            BlockPos check = new BlockPos(randX, y, randZ);
            var state = miningLevel.getBlockState(check);
            if (!state.isAir() && !state.is(Blocks.BEDROCK) && !state.is(Blocks.BARRIER)) {
                targetY = y + 1;
                break;
            }
        }

        player.teleportTo(miningLevel, randX + 0.5, targetY, randZ + 0.5, Set.of(), player.getYRot(), player.getXRot(), false);
        player.addEffect(new MobEffectInstance(MobEffects.RESISTANCE, 100, 255, false, false, false));
        player.addEffect(new MobEffectInstance(MobEffects.SLOW_FALLING, 100, 0, false, false, false));
        player.playSound(SoundEvents.ENDERMAN_TELEPORT, 1.0f, 1.0f);
        player.sendSystemMessage(Component.literal(String.format("§a⛏️ [資源採礦世界] 成功為您隨機傳送落點至 X: %d, Y: %d, Z: %d！祝您採礦大豐收！", randX, targetY, randZ)));
    }

    public static void evacuatePlayers(MinecraftServer server) {
        if (server == null) return;
        ServerLevel miningLevel = server.getLevel(MINING_DIMENSION_KEY);
        ServerLevel overworld = server.getLevel(Level.OVERWORLD);

        if (miningLevel != null && overworld != null) {
            BlockPos spawnPos = new BlockPos(0, 70, 0);
            for (ServerPlayer p : miningLevel.players()) {
                p.teleportTo(overworld, spawnPos.getX() + 0.5, spawnPos.getY() + 1.0, spawnPos.getZ() + 0.5, Set.of(), p.getYRot(), p.getXRot(), false);
                p.sendSystemMessage(Component.literal("§6[資源世界撤離] 採礦世界進行重置維護，已將您安全撤離傳送回主世界 Spawn！"));
                p.playSound(SoundEvents.ENDERMAN_TELEPORT, 1.0f, 1.0f);
            }
        }
    }
}
