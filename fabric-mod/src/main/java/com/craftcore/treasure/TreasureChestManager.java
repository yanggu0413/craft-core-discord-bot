package com.craftcore.treasure;

import com.craftcore.claim.ClaimManager;
import com.craftcore.title.TitleManager;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.entity.ChestBlockEntity;

import java.util.Random;
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

        public TreasureLocation(String dimension, int x, int y, int z) {
            this.dimension = dimension;
            this.x = x;
            this.y = y;
            this.z = z;
            this.opened = false;
        }
    }

    private static TreasureLocation activeTreasure = null;
    private static ScheduledExecutorService scheduler = null;
    private static final Random random = new Random();

    public static synchronized TreasureLocation getActiveTreasure() {
        return activeTreasure;
    }

    public static synchronized void spawnWildernessTreasure(MinecraftServer server) {
        if (server == null) return;
        ServerLevel overworld = server.getLevel(ServerLevel.OVERWORLD);
        if (overworld == null) return;

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

        activeTreasure = new TreasureLocation("minecraft:overworld", randX, randY, randZ);

        int minX = (randX / 300) * 300;
        int maxX = minX + 300;
        int minZ = (randZ / 300) * 300;
        int maxZ = minZ + 300;

        String hint = String.format("§6[藏寶廣播] 野外神秘寶箱已刷新！大致座標區塊: §eX: %d ~ %d, Z: %d ~ %d§6，快前去搜尋！", minX, maxX, minZ, maxZ);
        server.getPlayerList().broadcastSystemMessage(Component.literal(hint), false);
    }

    public static synchronized boolean checkAndClaimTreasure(ServerPlayer player, BlockPos pos) {
        if (activeTreasure == null || activeTreasure.opened) return false;
        if (pos.getX() == activeTreasure.x && pos.getY() == activeTreasure.y && pos.getZ() == activeTreasure.z) {
            activeTreasure.opened = true;
            String playerName = player.getName().getString();

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
