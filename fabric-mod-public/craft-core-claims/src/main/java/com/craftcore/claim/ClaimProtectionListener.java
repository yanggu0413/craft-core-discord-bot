package com.craftcore.claim;

import net.fabricmc.fabric.api.event.player.AttackBlockCallback;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.AnvilBlock;
import net.minecraft.world.level.block.BaseEntityBlock;
import net.minecraft.world.level.block.ButtonBlock;
import net.minecraft.world.level.block.ChestBlock;
import net.minecraft.world.level.block.DoorBlock;
import net.minecraft.world.level.block.EnchantingTableBlock;
import net.minecraft.world.level.block.FenceGateBlock;
import net.minecraft.world.level.block.LeverBlock;
import net.minecraft.world.level.block.TrapDoorBlock;
import net.minecraft.world.level.block.state.BlockState;

public class ClaimProtectionListener {

    public static void register() {
        AttackBlockCallback.EVENT.register((player, world, hand, pos, direction) -> {
            if (!world.isClientSide() && hand == InteractionHand.MAIN_HAND && player instanceof ServerPlayer sp) {
                if (player.getMainHandItem().is(Items.WOODEN_HOE)) {
                    ClaimManager.setCornerA(sp, pos, world);
                    return InteractionResult.FAIL;
                }

                if (!ClaimManager.checkPermission(sp, pos, world, "break")) {
                    String dim = world.dimension().identifier().toString();
                    if ("craftcore:fishing".equals(dim)) {
                        sp.sendSystemMessage(Component.literal("§c[釣魚維度] 釣魚世界受保護，非 OP 服主無法破壞地形！"));
                    } else if ("craftcore:lobby".equals(dim)) {
                        sp.sendSystemMessage(Component.literal("§c[大廳維度] 全服大廳受保護，非 OP 服主無法破壞地形！"));
                    } else {
                        sp.sendSystemMessage(Component.literal("§c[Craft-Core] 您在此領地沒有破壞方塊的權限！"));
                    }
                    return InteractionResult.FAIL;
                }
            }
            return InteractionResult.PASS;
        });

        UseBlockCallback.EVENT.register((player, world, hand, hitResult) -> {
            if (!world.isClientSide() && hand == InteractionHand.MAIN_HAND && player instanceof ServerPlayer sp) {
                BlockPos pos = hitResult.getBlockPos();
                BlockState state = world.getBlockState(pos);

                if (player.getMainHandItem().is(Items.WOODEN_HOE)) {
                    ClaimManager.setCornerB(sp, pos, world);
                    return InteractionResult.FAIL;
                }

                if (isContainer(state)) {
                    if (!ClaimManager.checkPermission(sp, pos, world, "containers")) {
                        sp.sendSystemMessage(Component.literal("§c[Craft-Core] 您在此領地沒有開啟容器的權限！"));
                        return InteractionResult.FAIL;
                    }
                }

                if (isInteractable(state)) {
                    if (!ClaimManager.checkPermission(sp, pos, world, "interact")) {
                        sp.sendSystemMessage(Component.literal("§c[Craft-Core] 您在此領地沒有互動權限！"));
                        return InteractionResult.FAIL;
                    }
                }

                BlockPos placePos = pos.relative(hitResult.getDirection());
                if (!player.getItemInHand(hand).isEmpty()) {
                    if (!ClaimManager.checkPermission(sp, placePos, world, "build")) {
                        sp.sendSystemMessage(Component.literal("§c[Craft-Core] 您在此領地沒有建造方塊的權限！"));
                        return InteractionResult.FAIL;
                    }
                }
            }
            return InteractionResult.PASS;
        });
    }

    private static boolean isContainer(BlockState state) {
        return state.getBlock() instanceof BaseEntityBlock || state.getBlock() instanceof ChestBlock;
    }

    private static boolean isInteractable(BlockState state) {
        return state.getBlock() instanceof DoorBlock
                || state.getBlock() instanceof TrapDoorBlock
                || state.getBlock() instanceof ButtonBlock
                || state.getBlock() instanceof LeverBlock
                || state.getBlock() instanceof AnvilBlock
                || state.getBlock() instanceof EnchantingTableBlock
                || state.getBlock() instanceof FenceGateBlock;
    }
}
