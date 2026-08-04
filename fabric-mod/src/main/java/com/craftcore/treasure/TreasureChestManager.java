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
            int tx = (random.nextInt(1200) + 400) * (random.nextBoolean() ? 1 : -1);
            int tz = (random.nextInt(1200) + 400) * (random.nextBoolean() ? 1 : -1);

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
            randX = 500;
            randZ = 500;
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

        int minX = (randX / 100) * 100;
        int maxX = minX + 100;
        int minZ = (randZ / 100) * 100;
        int maxZ = minZ + 100;

        String hint = String.format("§6[藏寶廣播] 🗺️ 野外神秘寶箱已刷新於地表！天空升起金色強光粒子柱，縮小範圍: §eX: %d ~ %d, Z: %d ~ %d §6(Y: %d)（輸入 /treasure 可開啟定向羅盤雷達！）", minX, maxX, minZ, maxZ, randY);
        server.getPlayerList().broadcastSystemMessage(Component.literal(hint), false);
    }

    public static String getTreasureRadarHint(ServerPlayer player) {
        if (activeTreasure == null || activeTreasure.opened) {
            return "§e目前野外尚無活躍寶箱，等待刷新中...";
        }
        if (player == null) return "§7請於遊戲內查看";

        if (!player.level().dimension().identifier().toString().equals(activeTreasure.dimension)) {
            int minX = (activeTreasure.x / 100) * 100;
            int minZ = (activeTreasure.z / 100) * 100;
            return String.format("§6[🗺 藏寶圖] 寶藏位於主世界 Overworld 地表: §eX: %d ~ %d, Z: %d ~ %d (高度 Y: %d)", minX, minX + 100, minZ, minZ + 100, activeTreasure.y);
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

        if (dist <= 35) {
            return String.format("§d✨ [強烈熱感應！] 寶箱就在您 %s 方向僅 %d 公尺地表！(高度 Y: %d)", dirStr, (int) dist, activeTreasure.y);
        } else if (dist <= 300) {
            return String.format("§a🧭 [羅盤精確感應] 寶箱在您的 %s 方向地表，距離約 %d 公尺 (高度 Y: %d)", dirStr, (int) dist, activeTreasure.y);
        } else {
            int minX = (activeTreasure.x / 100) * 100;
            int minZ = (activeTreasure.z / 100) * 100;
            return String.format("§6[🗺 藏寶圖] 範圍: §eX: %d ~ %d, Z: %d ~ %d §6(%s 方向 %dm, 地表 Y: %d)", minX, minX + 100, minZ, minZ + 100, dirStr, (int) dist, activeTreasure.y);
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
        // High-visibility particle beam tick event (Every 4 ticks = 0.2s)
        ServerTickEvents.END_SERVER_TICK.register(srv -> {
            tickCounter++;
            if (tickCounter % 4 == 0) {
                TreasureLocation treasure = activeTreasure;
                if (treasure != null && !treasure.opened) {
                    ServerLevel overworld = srv.getLevel(ServerLevel.OVERWORLD);
                    if (overworld != null) {
                        double cx = treasure.x + 0.5;
                        double cz = treasure.z + 0.5;
                        int startY = treasure.y + 1;
                        int endY = Math.min(treasure.y + 120, 310);

                        // 1. Towering Flame & End Rod Vertical Beam with overrideLimiter=true, alwaysShow=true (Visible across long distances)
                        for (int y = startY; y <= endY; y += 2) {
                            overworld.sendParticles(ParticleTypes.END_ROD, true, true, cx, y, cz, 4, 0.08, 0.08, 0.08, 0.01);
                            overworld.sendParticles(ParticleTypes.FLAME, true, true, cx, y, cz, 3, 0.1, 0.1, 0.1, 0.02);

                            if (y % 4 == 0) {
                                overworld.sendParticles(ParticleTypes.TOTEM_OF_UNDYING, true, true, cx, y, cz, 6, 0.25, 0.25, 0.25, 0.03);
                                overworld.sendParticles(ParticleTypes.GLOW, true, true, cx, y, cz, 3, 0.15, 0.15, 0.15, 0.01);
                            }
                        }

                        // 2. Dynamic Rotating Spiral Aura around chest
                        double radius = 1.2;
                        double angle = (tickCounter % 40) * (2.0 * Math.PI / 40.0);
                        double sx = cx + radius * Math.cos(angle);
                        double sz = cz + radius * Math.sin(angle);

                        for (int h = 0; h < 4; h++) {
                            overworld.sendParticles(ParticleTypes.SOUL_FIRE_FLAME, true, true, sx, startY + h * 0.8, sz, 4, 0.05, 0.05, 0.05, 0.01);
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
