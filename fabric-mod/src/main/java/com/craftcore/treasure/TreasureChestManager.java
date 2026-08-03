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

        // Clean up old active display entity if any
        cleanupActiveDisplay(overworld);

        int randX = (random.nextInt(1000) + 500) * (random.nextBoolean() ? 1 : -1);
        int randZ = (random.nextInt(1000) + 500) * (random.nextBoolean() ? 1 : -1);

        // Check claim collision
        if (ClaimManager.getClaimAt(new BlockPos(randX, 0, randZ), overworld) != null) {
            randX += 300;
            randZ += 300;
        }

        int randY = overworld.getHeightmapPos(net.minecraft.world.level.levelgen.Heightmap.Types.WORLD_SURFACE, new BlockPos(randX, 0, randZ)).getY();
        BlockPos chestPos = new BlockPos(randX, randY, randZ);

        overworld.setBlock(chestPos, Blocks.CHEST.defaultBlockState(), 3);
        if (overworld.getBlockEntity(chestPos) instanceof ChestBlockEntity chest) {
            chest.setItem(11, new ItemStack(Items.DIAMOND, 5));
            chest.setItem(13, new ItemStack(Items.GOLDEN_APPLE, 3));
            chest.setItem(15, new ItemStack(Items.EMERALD, 16));
        }

        // Spawn Text Display Hologram
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

        String hint = String.format("§6[藏寶廣播] 野外神秘寶箱已刷新！天空將升起金色粒子光柱，大致區域: §eX: %d ~ %d, Z: %d ~ %d§6，快前去搜尋！", minX, maxX, minZ, maxZ);
        server.getPlayerList().broadcastSystemMessage(Component.literal(hint), false);
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

    public static synchronized boolean checkAndClaimTreasure(ServerPlayer player, BlockPos pos) {
        if (activeTreasure == null || activeTreasure.opened) return false;
        if (pos.getX() == activeTreasure.x && pos.getY() == activeTreasure.y && pos.getZ() == activeTreasure.z) {
            activeTreasure.opened = true;
            String playerName = player.getName().getString();

            if (player.level() instanceof ServerLevel sl) {
                cleanupActiveDisplay(sl);
                // Spawn victory burst particles
                sl.sendParticles(ParticleTypes.TOTEM_OF_UNDYING, pos.getX() + 0.5, pos.getY() + 1.0, pos.getZ() + 0.5, 50, 0.5, 0.5, 0.5, 0.1);
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
        // Register Particle Beam Tick Event (Every 10 ticks = 0.5 second)
        ServerTickEvents.END_SERVER_TICK.register(srv -> {
            tickCounter++;
            if (tickCounter % 10 == 0) {
                TreasureLocation treasure = activeTreasure;
                if (treasure != null && !treasure.opened) {
                    ServerLevel overworld = srv.getLevel(ServerLevel.OVERWORLD);
                    if (overworld != null) {
                        double cx = treasure.x + 0.5;
                        double cz = treasure.z + 0.5;
                        int startY = treasure.y + 1;
                        int endY = Math.min(treasure.y + 45, 310);

                        for (int y = startY; y <= endY; y += 2) {
                            overworld.sendParticles(ParticleTypes.END_ROD, cx, y, cz, 1, 0.05, 0.1, 0.05, 0.01);
                            if (y % 4 == 0) {
                                overworld.sendParticles(ParticleTypes.TOTEM_OF_UNDYING, cx, y, cz, 2, 0.1, 0.1, 0.1, 0.02);
                            }
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
