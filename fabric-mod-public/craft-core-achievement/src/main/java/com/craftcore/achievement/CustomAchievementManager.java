package com.craftcore.achievement;

import com.craftcore.api.JsonDataStore;
import com.google.gson.reflect.TypeToken;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.AttackBlockCallback;
import net.minecraft.advancements.AdvancementHolder;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.stats.Stats;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.animal.pig.Pig;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Blocks;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class CustomAchievementManager {

    private static final Map<UUID, Integer> lookDownSeconds = new ConcurrentHashMap<>();
    private static Map<String, Set<String>> unlockedAchievements = new ConcurrentHashMap<>();
    private static final String DATA_FILE = "achievements.json";
    private static int tickCounter = 0;

    public static synchronized void load() {
        try {
            Map<String, Set<String>> loaded = JsonDataStore.loadData(
                DATA_FILE,
                new TypeToken<Map<String, Set<String>>>() {},
                new HashMap<>()
            );
            if (loaded != null) {
                unlockedAchievements = new ConcurrentHashMap<>(loaded);
            }
        } catch (Throwable t) {
            System.err.println("[CraftCoreAchievement] Failed to load achievements.json: " + t.getMessage());
        }
    }

    public static synchronized void save() {
        try {
            JsonDataStore.saveDataAsync(DATA_FILE, unlockedAchievements);
        } catch (Throwable t) {
            System.err.println("[CraftCoreAchievement] Failed to save achievements.json: " + t.getMessage());
        }
    }

    public static void register() {
        load();

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
                if (isTick20) {
                    checkStatsAdvancements(player);
                    checkLookDownAdvancement(player);
                }
            }
        });
    }

    public static synchronized Set<String> getUnlockedAchievements(String username) {
        if (username == null) return Collections.emptySet();
        return unlockedAchievements.getOrDefault(username.toLowerCase(), Collections.emptySet());
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

            // 7. End 370,000 blocks distance
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
        if (player.getXRot() > 30.0f) {
            int current = lookDownSeconds.getOrDefault(uuid, 0) + 1;
            lookDownSeconds.put(uuid, current);
            if (current >= 600) {
                grantAdvancement(player, "look_down_10m");
            }
        } else {
            lookDownSeconds.put(uuid, 0);
        }
    }

    public static void onBlockBroken(ServerPlayer player) {
        try {
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

    public static synchronized void grantAdvancement(ServerPlayer player, String advName) {
        if (player == null || advName == null) return;
        String username = player.getName().getString();
        Set<String> set = unlockedAchievements.computeIfAbsent(username.toLowerCase(), k -> new HashSet<>());
        if (!set.contains(advName)) {
            set.add(advName);
            save();
        }

        if (player.level() == null || player.level().getServer() == null) return;
        try {
            Identifier id = Identifier.parse("craftcore:" + advName);
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
            System.err.println("[CraftCoreAchievement] Failed to grant advancement " + advName + ": " + e.getMessage());
        }
    }
}
