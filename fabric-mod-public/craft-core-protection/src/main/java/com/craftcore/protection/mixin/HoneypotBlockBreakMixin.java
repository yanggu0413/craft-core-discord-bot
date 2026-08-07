package com.craftcore.protection.mixin;

import com.craftcore.protection.antixray.HoneypotTrapManager;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Level.class)
public class HoneypotBlockBreakMixin {

    @Inject(method = "destroyBlock", at = @At("HEAD"))
    private void onDestroyBlock(BlockPos pos, boolean drop, Entity entity, int maxUpdateDepth, CallbackInfoReturnable<Boolean> cir) {
        if (entity instanceof ServerPlayer serverPlayer) {
            HoneypotTrapManager.checkAndTriggerTrap(serverPlayer, pos);
        }
    }
}
