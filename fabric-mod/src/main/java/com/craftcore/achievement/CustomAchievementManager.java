package com.craftcore.achievement;

import net.fabricmc.fabric.api.event.player.AttackBlockCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.advancements.AdvancementHolder;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.stats.Stats;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.animal.pig.Pig;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Blocks;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class CustomAchievementManager {

    private static final Map<UUID, Integer> lookDownSeconds = new ConcurrentHashMap<>();
    private static int tickCounter = 0;

    public static void register() {
        // 1. Bedrock Hit Listener
        AttackBlockCallback.EVENT.register((player, world, hand, pos, direction) -> {
            if (!world.isClientSide() && world.getBlockState(pos).is(Blocks.BEDROCK) && player instanceof ServerPlayer sp) {
                grantAdvancement(sp, "hit_bedrock");
            }
            return InteractionResult.PASS;
        });

        // 2. Server Tick Event for Stats and Look Down Timer
        ServerTickEvents.END_SERVER_TICK.register(server -> {
            tickCounter++;
            boolean isTick20 = (tickCounter % 20 == 0);

            for (ServerPlayer player : server.getPlayerList().getPlayers()) {
                if (com.craftcore.fakeplayer.FakePlayerManager.isFakePlayer(player)) continue;
                if (isTick20) {
                    checkStatsAdvancements(player);
                    checkLookDownAdvancement(player);
                }
            }
        });
    }

    public static void checkMacePigKill(ServerPlayer player, Object victimEntity, double fallDistance) {
        if (victimEntity instanceof Pig && player.getMainHandItem().is(Items.MACE)) {
            if (fallDistance >= 200.0) {
                grantAdvancement(player, "mace_pig_fall");
            }
        }
    }

    private static void checkStatsAdvancements(ServerPlayer player) {
        try {
            var stats = player.getStats();

            // 1. Diamond Mining (1,000)
            int diamondsMined = stats.getValue(Stats.BLOCK_MINED, Blocks.DIAMOND_ORE) + stats.getValue(Stats.BLOCK_MINED, Blocks.DEEPSLATE_DIAMOND_ORE);
            if (diamondsMined >= 1000) {
                grantAdvancement(player, "diamond_1000");
            }

            // 2. Animals Bred (30)
            int animalsBred = stats.getValue(Stats.CUSTOM, Stats.ANIMALS_BRED);
            if (animalsBred >= 30) {
                grantAdvancement(player, "breed_30");
            }

            // 3. Eat Spider Eyes (100)
            int spiderEyesEaten = stats.getValue(Stats.ITEM_USED, Items.SPIDER_EYE);
            if (spiderEyesEaten >= 100) {
                grantAdvancement(player, "eat_100_spider_eyes");
            }

            // 4. Play Time 100 Days (2,400,000 ticks)
            int playTimeTicks = stats.getValue(Stats.CUSTOM, Stats.PLAY_TIME);
            if (playTimeTicks >= 2400000) {
                grantAdvancement(player, "play_100_days");
            }

            // 5. Jump 10,000 Times
            int jumps = stats.getValue(Stats.CUSTOM, Stats.JUMP);
            if (jumps >= 10000) {
                grantAdvancement(player, "jump_10000");
            }

            // 6. Elytra Flying 10,000 Blocks (1,000,000 cm)
            int flyCm = stats.getValue(Stats.CUSTOM, Stats.AVIATE_ONE_CM);
            if (flyCm >= 1000000) {
                grantAdvancement(player, "elytra_10000");
            }

            // 7. Millionaire ($1,000,000 balance)
            double balance = com.craftcore.economy.EconomyManager.getBalance(player.getName().getString());
            if (balance >= 1000000.0) {
                grantAdvancement(player, "millionaire");
            }

            // 8. End 370,000 blocks distance
            if (player.level().dimension() == net.minecraft.world.level.Level.END) {
                if (Math.abs(player.getBlockX()) >= 370000 || Math.abs(player.getBlockZ()) >= 370000) {
                    grantAdvancement(player, "end_370k");
                }
            }
        } catch (Throwable ignored) {}
    }

    public static void onExpressSent(ServerPlayer player, int totalExpressCount) {
        if (totalExpressCount >= 30) {
            grantAdvancement(player, "express_30");
        }
    }

    public static void onCheckIn(ServerPlayer player, int consecutiveDays) {
        if (consecutiveDays >= 30) {
            grantAdvancement(player, "checkin_30_days");
        }
    }

    private static void checkLookDownAdvancement(ServerPlayer player) {
        UUID uuid = player.getUUID();
        // Pitch > 30° is looking down at ground
        if (player.getXRot() > 30.0f) {
            int current = lookDownSeconds.getOrDefault(uuid, 0) + 1;
            lookDownSeconds.put(uuid, current);
            if (current >= 600) { // 10 minutes = 600 seconds
                grantAdvancement(player, "look_down_10m");
            }
        } else {
            // Looked up! Reset timer
            lookDownSeconds.put(uuid, 0);
        }
    }

    public static void onBlockBroken(ServerPlayer player) {
        try {
            // Check total blocks broken or grant mine_10000 when total blocks mined reaches 10000
            int totalMined = 0;
            for (var block : BuiltInRegistries.BLOCK) {
                totalMined += player.getStats().getValue(Stats.BLOCK_MINED, block);
                if (totalMined >= 10000) {
                    grantAdvancement(player, "mine_10000");
                    break;
                }
            }
        } catch (Throwable ignored) {}
    }

    public static void grantAdvancement(ServerPlayer player, String advName) {
        if (player == null || player.level() == null || player.level().getServer() == null) return;
        if (com.craftcore.fakeplayer.FakePlayerManager.isFakePlayer(player)) return;
        try {
            net.minecraft.resources.Identifier id = net.minecraft.resources.Identifier.parse("craftcore:" + advName);
            AdvancementHolder holder = player.level().getServer().getAdvancements().get(id);
            if (holder != null) {
                var progress = player.getAdvancements().getOrStartProgress(holder);
                if (!progress.isDone()) {
                    for (String criterion : progress.getRemainingCriteria()) {
                        player.getAdvancements().award(holder, criterion);
                    }
                }
            }
        } catch (Throwable e) {
            System.err.println("[CraftCore] Failed to grant advancement " + advName + ": " + e.getMessage());
        }
    }
}
