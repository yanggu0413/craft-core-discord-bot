package com.craftcore.mining;

import com.craftcore.back.BackManager;
import com.craftcore.data.AsyncSaveExecutor;
import com.craftcore.teleport.TeleportUtil;
import com.craftcore.util.FabricPathUtil;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
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

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.nio.file.Files;
import java.nio.file.Path;
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

    public static class MiningConfig {
        public String dimensionId = "craftcore:mining";
        public long lastResetTimestamp = System.currentTimeMillis();
        public boolean autoResetEnabled = true;
    }

    private static final Path CONFIG_PATH = FabricPathUtil.getDataFile("mining_dimension.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static MiningConfig config = new MiningConfig();

    static {
        load();
    }

    public static synchronized void load() {
        if (CONFIG_PATH != null && Files.exists(CONFIG_PATH)) {
            try (BufferedReader reader = Files.newBufferedReader(CONFIG_PATH)) {
                MiningConfig loaded = GSON.fromJson(reader, MiningConfig.class);
                if (loaded != null) {
                    config = loaded;
                }
            } catch (Exception e) {
                System.err.println("[CraftCore-Mining] Failed to load mining_dimension.json: " + e.getMessage());
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
                    GSON.toJson(config, writer);
                }
            } catch (Exception e) {
                System.err.println("[CraftCore-Mining] Failed to save mining_dimension.json: " + e.getMessage());
            }
        }
    }

    public static ResourceKey<Level> getMiningDimensionKey() {
        return MINING_DIMENSION_KEY;
    }

    public static String getNextResetCountdownString() {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Taipei"));
        ZonedDateTime nextReset = now.with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY))
                .withHour(4).withMinute(0).withSecond(0).withNano(0);
        if (now.isAfter(nextReset)) {
            nextReset = nextReset.plusWeeks(1);
        }
        long durationMillis = java.time.Duration.between(now, nextReset).toMillis();
        long days = TimeUnit.MILLISECONDS.toDays(durationMillis);
        long hours = TimeUnit.MILLISECONDS.toHours(durationMillis) % 24;
        long minutes = TimeUnit.MILLISECONDS.toMinutes(durationMillis) % 60;
        return String.format("%d 天 %d 小時 %d 分", days, hours, minutes);
    }

    public static void startLoop(MinecraftServer server) {
        if (scheduler != null && !scheduler.isShutdown()) return;
        scheduler = Executors.newSingleThreadScheduledExecutor();

        scheduler.scheduleAtFixedRate(() -> {
            try {
                ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Taipei"));
                if (now.getDayOfWeek() == DayOfWeek.MONDAY && now.getHour() == 3 && now.getMinute() == 50 && now.getSecond() < 10) {
                    if (server != null) {
                        server.execute(() -> server.getPlayerList().broadcastSystemMessage(Component.literal("§6[資源世界預告] 距離採礦世界 (craftcore:mining) 週自動重置倒數 10 分鐘！請在該世界玩家準備撤離！"), false));
                    }
                }
                if (now.getDayOfWeek() == DayOfWeek.MONDAY && now.getHour() == 3 && now.getMinute() == 55 && now.getSecond() < 10) {
                    if (server != null) {
                        server.execute(() -> server.getPlayerList().broadcastSystemMessage(Component.literal("§6[資源世界預告] 距離採礦世界週自動重置倒數 5 分鐘！玩家將於重置時自動安全撤離！"), false));
                    }
                }
                if (now.getDayOfWeek() == DayOfWeek.MONDAY && now.getHour() == 3 && now.getMinute() == 59 && now.getSecond() < 10) {
                    if (server != null) {
                        server.execute(() -> server.getPlayerList().broadcastSystemMessage(Component.literal("§c[資源世界預告] 距離採礦世界週自動重置剩餘 1 分鐘！即將執行撤離傳送！"), false));
                    }
                }

                if (server != null) {
                    server.execute(() -> {
                        ServerLevel miningLevel = server.getLevel(MINING_DIMENSION_KEY);
                        if (miningLevel != null) {
                            net.minecraft.world.level.saveddata.WeatherData wd = miningLevel.getWeatherData();
                            if (wd != null && (wd.isRaining() || wd.isThundering())) {
                                wd.setRaining(false);
                                wd.setThundering(false);
                                wd.setRainTime(0);
                                wd.setThunderTime(0);
                                wd.setClearWeatherTime(120000);
                                wd.setDirty();
                            }
                        }
                    });
                }
                if (now.getDayOfWeek() == DayOfWeek.MONDAY && now.getHour() == 4 && now.getMinute() == 0 && now.getSecond() < 10) {
                    if (server != null) {
                        server.execute(() -> {
                            evacuatePlayers(server);
                            config.lastResetTimestamp = System.currentTimeMillis();
                            AsyncSaveExecutor.submit(MiningDimensionManager::save);
                            server.getPlayerList().broadcastSystemMessage(Component.literal("§6[資源世界重置] 星期一凌晨 04:00！採礦世界已完成全服週自動重置與安全撤離！"), false);
                        });
                    }
                }
            } catch (Throwable t) {
                System.err.println("[CraftCore-Mining] Error in MiningDimension timer loop: " + t.getMessage());
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

        int randX = 0;
        int randZ = 0;
        int targetY = 70;
        boolean foundLand = false;

        for (int attempt = 0; attempt < 30; attempt++) {
            randX = (random.nextInt(2000) + 100) * (random.nextBoolean() ? 1 : -1);
            randZ = (random.nextInt(2000) + 100) * (random.nextBoolean() ? 1 : -1);

            miningLevel.getChunk(new BlockPos(randX, 64, randZ));

            for (int y = 310; y >= 60; y--) {
                BlockPos check = new BlockPos(randX, y, randZ);
                var state = miningLevel.getBlockState(check);
                if (!state.getFluidState().isEmpty()) continue;

                if (!state.isAir() && !state.is(Blocks.BEDROCK) && !state.is(Blocks.BARRIER)) {
                    targetY = y + 1;
                    var aboveState = miningLevel.getBlockState(new BlockPos(randX, targetY, randZ));
                    if (aboveState.getFluidState().isEmpty()) {
                        foundLand = true;
                        break;
                    }
                }
            }
            if (foundLand) break;
        }

        BackManager.recordLocation(player);
        TeleportUtil.teleport(player, miningLevel, randX + 0.5, targetY, randZ + 0.5, player.getYRot(), player.getXRot());
        player.addEffect(new MobEffectInstance(MobEffects.RESISTANCE, 100, 255, false, false, false));
        player.addEffect(new MobEffectInstance(MobEffects.SLOW_FALLING, 100, 0, false, false, false));
        player.sendSystemMessage(Component.literal(String.format("§a⛏️ [資源採礦世界] 成功為您隨機傳送落點至陸地 X: %d, Y: %d, Z: %d！祝您採礦大豐收！", randX, targetY, randZ)));
    }

    public static void evacuatePlayers(MinecraftServer server) {
        if (server == null) return;
        ServerLevel miningLevel = server.getLevel(MINING_DIMENSION_KEY);
        ServerLevel overworld = server.getLevel(Level.OVERWORLD);

        if (miningLevel != null && overworld != null) {
            BlockPos spawnPos = new BlockPos(0, 70, 0);
            for (ServerPlayer p : miningLevel.players()) {
                TeleportUtil.teleport(p, overworld, spawnPos.getX() + 0.5, spawnPos.getY() + 1.0, spawnPos.getZ() + 0.5, p.getYRot(), p.getXRot());
                p.sendSystemMessage(Component.literal("§6[資源世界撤離] 採礦世界進行重置維護，已將您安全撤離傳送回主世界 Spawn！"));
            }
        }
    }
}
