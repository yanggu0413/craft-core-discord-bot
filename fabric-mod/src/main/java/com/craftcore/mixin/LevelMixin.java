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
    @Inject(method = "destroyBlock", at = @At("HEAD"), cancellable = true)
    private void onDestroyBlock(BlockPos pos, boolean drop, Entity entity, int maxUpdateDepth, CallbackInfoReturnable<Boolean> cir) {
        Level level = (Level) (Object) this;
        BlockState state = level.getBlockState(pos);
        BlockEntity blockEntity = level.getBlockEntity(pos);
        Player player = (entity instanceof Player p) ? p : DailyTaskManager.getActiveMiningPlayer();
        if (player != null) {
            DailyTaskManager.handleBlockBreak(level, player, pos, state, blockEntity);
            if (player instanceof net.minecraft.server.level.ServerPlayer serverPlayer) {
                String blockId = net.minecraft.core.registries.BuiltInRegistries.BLOCK.getKey(state.getBlock()).toString();
                com.craftcore.task.AiDailyTaskManager.updateProgress(serverPlayer, "MINE", blockId, 1);
                com.craftcore.achievement.CustomAchievementManager.onBlockBroken(serverPlayer);
                boolean triggered = com.craftcore.antixray.HoneypotTrapManager.checkAndTriggerTrap(serverPlayer, pos);
                if (triggered) {
                    com.craftcore.antixray.HoneypotTrapManager.generateTrapForPlayer(serverPlayer);
                } else if (state.is(net.minecraft.world.level.block.Blocks.STONE) || state.is(net.minecraft.world.level.block.Blocks.DEEPSLATE) || state.is(net.minecraft.world.level.block.Blocks.NETHERRACK)) {
                    if (level.getRandom().nextInt(35) == 0) {
                        com.craftcore.antixray.HoneypotTrapManager.generateTrapForPlayer(serverPlayer);
                    }
                }
            }
        }
        for (net.minecraft.core.Direction dir : net.minecraft.core.Direction.values()) {
            BlockPos adjPos = pos.relative(dir);
            BlockState adjState = level.getBlockState(adjPos);
            if (com.craftcore.antixray.AntiXrayManager.isOre(adjState)) {
                level.sendBlockUpdated(adjPos, adjState, adjState, 3);
            }
        }
    }
}
