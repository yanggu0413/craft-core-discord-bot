package com.craftcore.mixin;

import com.craftcore.task.DailyTaskManager;
import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Level.class)
public class LevelMixin {
    @Inject(method = "destroyBlock", at = @At("HEAD"))
    private void onDestroyBlock(BlockPos pos, boolean drop, Entity entity, int maxUpdateDepth, CallbackInfoReturnable<Boolean> cir) {
        if (entity instanceof Player player) {
            Level level = (Level) (Object) this;
            BlockState state = level.getBlockState(pos);
            BlockEntity blockEntity = level.getBlockEntity(pos);
            DailyTaskManager.handleBlockBreak(level, player, pos, state, blockEntity);
        }
    }
}
