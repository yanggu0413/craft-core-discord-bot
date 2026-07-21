package com.craftcore.mixin;

import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.Level;
import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import com.craftcore.task.DailyTaskManager;

@Mixin(Block.class)
public class BlockMixin {
    @Inject(method = "playerDestroy", at = @At("HEAD"))
    private void onPlayerDestroy(Level level, Player player, BlockPos pos, BlockState state, BlockEntity blockEntity, ItemStack tool, CallbackInfo ci) {
        DailyTaskManager.handleBlockBreak(level, player, pos, state, blockEntity);
    }

    @Inject(method = "playerWillDestroy", at = @At("HEAD"))
    private void onPlayerWillDestroy(Level level, BlockPos pos, BlockState state, Player player, CallbackInfoReturnable<BlockState> cir) {
        DailyTaskManager.handleBlockBreak(level, player, pos, state, level.getBlockEntity(pos));
    }
}
