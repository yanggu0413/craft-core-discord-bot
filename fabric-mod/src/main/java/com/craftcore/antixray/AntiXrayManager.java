package com.craftcore.antixray;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;

import java.util.HashSet;
import java.util.Set;

public class AntiXrayManager {
    private static final Set<Block> ORES = new HashSet<>();

    static {
        // Overworld Ores
        ORES.add(Blocks.DIAMOND_ORE);
        ORES.add(Blocks.DEEPSLATE_DIAMOND_ORE);
        ORES.add(Blocks.EMERALD_ORE);
        ORES.add(Blocks.DEEPSLATE_EMERALD_ORE);
        ORES.add(Blocks.GOLD_ORE);
        ORES.add(Blocks.DEEPSLATE_GOLD_ORE);
        ORES.add(Blocks.RAW_GOLD_BLOCK);
        ORES.add(Blocks.IRON_ORE);
        ORES.add(Blocks.DEEPSLATE_IRON_ORE);
        ORES.add(Blocks.RAW_IRON_BLOCK);
        ORES.add(Blocks.ANCIENT_DEBRIS);
        ORES.add(Blocks.NETHER_GOLD_ORE);
        ORES.add(Blocks.NETHER_QUARTZ_ORE);
        ORES.add(Blocks.LAPIS_ORE);
        ORES.add(Blocks.DEEPSLATE_LAPIS_ORE);
        ORES.add(Blocks.REDSTONE_ORE);
        ORES.add(Blocks.DEEPSLATE_REDSTONE_ORE);
    }

    public static boolean isOre(BlockState state) {
        if (state == null) return false;
        return ORES.contains(state.getBlock());
    }

    public static boolean isExposed(Level level, BlockPos pos) {
        if (level == null || pos == null) return true;
        for (Direction dir : Direction.values()) {
            BlockPos adjPos = pos.relative(dir);
            BlockState adjState = level.getBlockState(adjPos);
            if (adjState.isAir() || !adjState.isRedstoneConductor(level, adjPos)) {
                return true;
            }
        }
        return false;
    }

    public static BlockState getObfuscatedState(BlockState originalState, Level level, BlockPos pos) {
        if (!isOre(originalState)) return originalState;
        if (isExposed(level, pos)) return originalState;

        String dim = level.dimension().identifier().toString();
        if ("minecraft:the_nether".equalsIgnoreCase(dim)) {
            return Blocks.NETHERRACK.defaultBlockState();
        } else if ("minecraft:the_end".equalsIgnoreCase(dim)) {
            return Blocks.END_STONE.defaultBlockState();
        } else {
            if (pos.getY() < 0) {
                return Blocks.DEEPSLATE.defaultBlockState();
            } else {
                return Blocks.STONE.defaultBlockState();
            }
        }
    }
}
