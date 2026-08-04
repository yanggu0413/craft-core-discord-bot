package com.craftcore.treasure;

import com.craftcore.claim.ClaimManager;
import com.craftcore.title.TitleManager;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.tags.BlockTags;
import net.minecraft.world.entity.Display;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.entity.ChestBlockEntity;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class TreasureChestManager {

    public static class TreasureLocation {
        public String dimension;
        public int x;
        public int y;
        public int z;
        public boolean opened;
        public UUID displayUuid;

        public TreasureLocation(String dimension, int x, int y, int z, UUID displayUuid) {
            this.dimension = dimension;
            this.x = x;
            this.y = y;
            this.z = z;
            this.opened = false;
            this.displayUuid = displayUuid;
        }
    }

    private static TreasureLocation activeTreasure = null;
    private static ScheduledExecutorService scheduler = null;
    private static final Random random = new Random();
    private static final ConcurrentHashMap<String, Long> radarCooldowns = new ConcurrentHashMap<>();
    private static int tickCounter = 0;

    public static synchronized TreasureLocation getActiveTreasure() {
        return activeTreasure;
    }

    public static synchronized void spawnWildernessTreasure(MinecraftServer server) {
        if (server == null) return;
        ServerLevel overworld = server.getLevel(ServerLevel.OVERWORLD);
        if (overworld == null) return;

        // Clean up old active display entity and un-opened chest block if any
        cleanupActiveTreasureBlockAndDisplay(overworld);

        int randX = 0;
        int randZ = 0;
        int randY = 0;
        BlockPos surfacePos = null;

        // Try up to 15 random coordinates to find a clean, safe surface spot
        for (int attempt = 0; attempt < 15; attempt++) {
            int tx = (random.nextInt(1600) + 600) * (random.nextBoolean() ? 1 : -1);
            int tz = (random.nextInt(1600) + 600) * (random.nextBoolean() ? 1 : -1);

            if (ClaimManager.getClaimAt(new BlockPos(tx, 64, tz), overworld) != null) {
                continue;
            }

            // Force load/generate chunk so heightmaps & block states are valid
            overworld.getChunk(new BlockPos(tx, 64, tz));

            // Scan from top world height (Y = 310) down to Y = 60 for topmost solid ground
            int foundY = -1;
            for (int y = 310; y >= 60; y--) {
                BlockPos checkPos = new BlockPos(tx, y, tz);
                var state = overworld.getBlockState(checkPos);

                // Ignore air, bedrock, barriers, and leaves tag
                if (!state.isAir() && !state.is(Blocks.BEDROCK) && !state.is(Blocks.BARRIER) && !state.is(BlockTags.LEAVES)) {
                    foundY = y;
                    break;
                }
            }

            if (foundY >= 60) {
                randX = tx;
                randZ = tz;

                // Handle liquids (water/lava): place a solid mossy cobblestone block underneath
                BlockPos groundPos = new BlockPos(randX, foundY, randZ);
                var groundState = overworld.getBlockState(groundPos);
                if (groundState.is(Blocks.WATER) || groundState.is(Blocks.LAVA)
                        || groundState.is(Blocks.SEAGRASS) || groundState.is(Blocks.TALL_SEAGRASS)
                        || groundState.is(Blocks.KELP) || groundState.is(Blocks.KELP_PLANT)) {
                    overworld.setBlock(groundPos, Blocks.MOSSY_COBBLESTONE.defaultBlockState(), 3);
                }

                randY = foundY + 1;
                surfacePos = new BlockPos(randX, randY, randZ);
                break;
            }
        }

        // Safe fallback if loop failed to find ground
        if (surfacePos == null) {
            randX = 800;
            randZ = 800;
            randY = 71;
            overworld.getChunk(new BlockPos(randX, 64, randZ));
            overworld.setBlock(new BlockPos(randX, 70, randZ), Blocks.GRASS_BLOCK.defaultBlockState(), 3);
            surfacePos = new BlockPos(randX, randY, randZ);
        }

        // Place Chest on surface
        overworld.setBlock(surfacePos, Blocks.CHEST.defaultBlockState(), 3);
        if (overworld.getBlockEntity(surfacePos) instanceof ChestBlockEntity chest) {
            chest.setItem(11, new ItemStack(Items.DIAMOND, 5));
            chest.setItem(13, new ItemStack(Items.GOLDEN_APPLE, 3));
            chest.setItem(15, new ItemStack(Items.EMERALD, 16));
        }

        // Spawn Text Display Hologram above chest
        UUID displayUuid = null;
        try {
            @SuppressWarnings("unchecked")
            EntityType<Display.TextDisplay> textDisplayType = (EntityType<Display.TextDisplay>) (Object) net.minecraft.core.registries.BuiltInRegistries.ENTITY_TYPE.getValue(net.minecraft.resources.Identifier.parse("text_display"));
            if (textDisplayType != null) {
                Display.TextDisplay textDisplay = new Display.TextDisplay(textDisplayType, overworld);
                textDisplay.setPos(randX + 0.5, randY + 1.3, randZ + 0.5);
                textDisplay.setText(Component.literal("§6§l✨ 野外神秘藏寶箱 ✨\n§e[右鍵打開領取大獎]"));
                textDisplay.setBillboardConstraints(Display.BillboardConstraints.CENTER);
                textDisplay.setGlowingTag(true);
                overworld.addFreshEntity(textDisplay);
                displayUuid = textDisplay.getUUID();
            }
        } catch (Throwable t) {
            System.err.println("[CraftCore] Failed to spawn treasure TextDisplay: " + t.getMessage());
        }

        activeTreasure = new TreasureLocation("minecraft:overworld", randX, randY, randZ, displayUuid);

        int minX = (randX / 300) * 300;
        int maxX = minX + 300;
        int minZ = (randZ / 300) * 300;
        int maxZ = minZ + 300;

        String hint = String.format("§6[藏寶廣播] 🗺️ 野外神秘寶箱已刷新於地表！搜尋區域: §eX: %d ~ %d, Z: %d ~ %d§6（輸入 /treasure 可開啟羅盤雷達，每 45 秒注意天空的短暫脈衝光束！）", minX, maxX, minZ, maxZ);
        server.getPlayerList().broadcastSystemMessage(Component.literal(hint), false);
    }

    public static String getTreasureRadarHint(ServerPlayer player) {
        if (activeTreasure == null || activeTreasure.opened) {
            return "§e目前野外尚無活躍寶箱，等待刷新中...";
        }
        if (player == null) return "§7請於遊戲內查看";

        String username = player.getName().getString();
        long now = System.currentTimeMillis();
        long lastUsed = radarCooldowns.getOrDefault(username, 0L);
        if (now - lastUsed < 10000) { // 10s cooldown
            long remainingSec = (10000 - (now - lastUsed)) / 1000 + 1;
            return "§c[藏寶雷達] 系統冷卻中！請等待 " + remainingSec + " 秒後再重新進行掃描。";
        }
        radarCooldowns.put(username, now);

        if (!player.level().dimension().identifier().toString().equals(activeTreasure.dimension)) {
            int minX = (activeTreasure.x / 300) * 300;
            int minZ = (activeTreasure.z / 300) * 300;
            return String.format("§6[🗺 藏寶圖] 寶藏位於主世界 Overworld 地表區域: §eX: %d ~ %d, Z: %d ~ %d", minX, minX + 300, minZ, minZ + 300);
        }

        double dx = activeTreasure.x - player.getX();
        double dz = activeTreasure.z - player.getZ();
        double dist = Math.sqrt(dx * dx + dz * dz);

        double angle = Math.toDegrees(Math.atan2(-dx, dz));
        if (angle < 0) angle += 360;

        String dirStr;
        if (angle >= 337.5 || angle < 22.5) dirStr = "⬇ 正南";
        else if (angle >= 22.5 && angle < 67.5) dirStr = "↙ 西南";
        else if (angle >= 67.5 && angle < 112.5) dirStr = "⬅ 正西";
        else if (angle >= 112.5 && angle < 157.5) dirStr = "↖ 西北";
        else if (angle >= 157.5 && angle < 202.5) dirStr = "⬆ 正北";
        else if (angle >= 202.5 && angle < 247.5) dirStr = "↗ 東北";
        else if (angle >= 247.5 && angle < 292.5) dirStr = "➡ 正東";
        else dirStr = "↘ 東南";

        if (dist <= 25) {
            return "§e🔥 [極近距離！] 寶箱就在您身邊 25 公尺內地表！快尋找地表草叢與岩石附近的金色微光！";
        } else if (dist <= 100) {
            int band = ((int) dist / 10) * 10 + 10;
            return String.format("§d✨ [強烈熱感應！] 寶箱就在您 %s 方向約 %d 公尺內！仔細觀察週遭地貌與天空脈衝！", dirStr, band);
        } else if (dist <= 300) {
            int approxMin = ((int) dist / 50) * 50;
            return String.format("§a🧭 [羅盤中程感應] 寶箱在您的 %s 方向，距離約 %d~%d 公尺。每隔 45 秒留意天空短暫閃光！", dirStr, approxMin, approxMin + 50);
        } else {
            int minX = (activeTreasure.x / 300) * 300;
            int minZ = (activeTreasure.z / 300) * 300;
            return String.format("§6[🗺 藏寶圖] 廣域目標: §eX: %d ~ %d, Z: %d ~ %d §6(%s 方向, 距離較遠)", minX, minX + 300, minZ, minZ + 300, dirStr);
        }
    }

    private static void cleanupActiveDisplay(ServerLevel level) {
        if (activeTreasure != null && activeTreasure.displayUuid != null && level != null) {
            try {
                net.minecraft.world.entity.Entity entity = level.getEntity(activeTreasure.displayUuid);
                if (entity != null) {
                    entity.discard();
                }
            } catch (Throwable ignored) {}
        }
    }

    private static void cleanupActiveTreasureBlockAndDisplay(ServerLevel level) {
        if (activeTreasure != null && level != null) {
            if (!activeTreasure.opened) {
                BlockPos oldPos = new BlockPos(activeTreasure.x, activeTreasure.y, activeTreasure.z);
                if (level.getBlockState(oldPos).is(Blocks.CHEST)) {
                    level.setBlock(oldPos, Blocks.AIR.defaultBlockState(), 3);
                }
            }
            cleanupActiveDisplay(level);
        }
    }

    public static synchronized boolean checkAndClaimTreasure(ServerPlayer player, BlockPos pos) {
        if (activeTreasure == null || activeTreasure.opened) return false;
        if (pos.getX() == activeTreasure.x && pos.getY() == activeTreasure.y && pos.getZ() == activeTreasure.z) {
            activeTreasure.opened = true;
            String playerName = player.getName().getString();

            if (player.level() instanceof ServerLevel sl) {
                cleanupActiveDisplay(sl);
                // Spawn victory burst particles with longDistance = true
                sl.sendParticles(ParticleTypes.TOTEM_OF_UNDYING, true, true, pos.getX() + 0.5, pos.getY() + 1.0, pos.getZ() + 0.5, 100, 0.8, 0.8, 0.8, 0.15);
                sl.sendParticles(ParticleTypes.FIREWORK, true, true, pos.getX() + 0.5, pos.getY() + 1.0, pos.getZ() + 0.5, 50, 0.5, 0.5, 0.5, 0.1);
            }

            int currentKeys = com.craftcore.economy.EconomyManager.getLotteryKeys(playerName);
            com.craftcore.economy.EconomyManager.setLotteryKeys(playerName, currentKeys + 3);
            com.craftcore.economy.EconomyManager.addMoney(playerName, 1000.0);
            TitleManager.unlockTitle(playerName, "§6[🗺 尋寶獵人]");

            String msg = String.format("§a🎉 [全服通告] 玩家 §e%s §a成功找到了野外藏寶箱！獲得 §d$1000 元金幣 + 3 把幸運鑰匙 §a並解鎖稱號 §6[🗺 尋寶獵人]§a！", playerName);
            MinecraftServer srv = player.level().getServer();
            if (srv != null) {
                srv.getPlayerList().broadcastSystemMessage(Component.literal(msg), false);
            }
            return true;
        }
        return false;
    }

    public static void startLoop(MinecraftServer server) {
        ServerTickEvents.END_SERVER_TICK.register(srv -> {
            tickCounter++;
            TreasureLocation treasure = activeTreasure;
            if (treasure != null && !treasure.opened) {
                ServerLevel overworld = srv.getLevel(ServerLevel.OVERWORLD);
                if (overworld != null) {
                    double cx = treasure.x + 0.5;
                    double cz = treasure.z + 0.5;
                    int startY = treasure.y + 1;

                    // 1. Periodic Sonar Sky Pulse: Only triggers for 3 seconds (60 ticks) every 45 seconds (900 ticks)
                    boolean isPulseActive = (tickCounter % 900) < 60;
                    if (isPulseActive && (tickCounter % 5 == 0)) {
                        int endY = Math.min(treasure.y + 70, 310);
                        for (int y = startY; y <= endY; y += 3) {
                            overworld.sendParticles(ParticleTypes.END_ROD, true, true, cx, y, cz, 2, 0.08, 0.08, 0.08, 0.01);
                            if (y % 6 == 0) {
                                overworld.sendParticles(ParticleTypes.TOTEM_OF_UNDYING, true, true, cx, y, cz, 3, 0.2, 0.2, 0.2, 0.02);
                            }
                        }
                    }

                    // 2. Near-Field Proximity Particles: Only when players get within 25m
                    if (tickCounter % 10 == 0) {
                        boolean playerNearby = false;
                        for (ServerPlayer p : overworld.players()) {
                            if (p.distanceToSqr(cx, treasure.y, cz) <= 625) { // 25 meters
                                playerNearby = true;
                                break;
                            }
                        }
                        if (playerNearby) {
                            overworld.sendParticles(ParticleTypes.TOTEM_OF_UNDYING, true, true, cx, startY + 0.5, cz, 4, 0.4, 0.4, 0.4, 0.02);
                            overworld.sendParticles(ParticleTypes.GLOW, true, true, cx, startY + 0.5, cz, 2, 0.3, 0.3, 0.3, 0.01);
                        }
                    }
                }
            }
        });

        if (scheduler != null && !scheduler.isShutdown()) return;
        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(() -> {
            try {
                if (server != null) {
                    server.execute(() -> spawnWildernessTreasure(server));
                }
            } catch (Throwable t) {
                System.err.println("[CraftCore] Error in TreasureChest loop: " + t.getMessage());
            }
        }, 30, 120, TimeUnit.MINUTES);
    }
}
