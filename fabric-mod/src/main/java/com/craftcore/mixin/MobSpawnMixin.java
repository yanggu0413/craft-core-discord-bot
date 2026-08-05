package com.craftcore.mixin;

import com.craftcore.fish.FishingContestManager;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.Mob;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Mob.class)
public class MobSpawnMixin {
    @Inject(method = "checkSpawnRules", at = @At("HEAD"), cancellable = true)
    private void onCheckSpawnRules(net.minecraft.world.level.LevelAccessor level, EntitySpawnReason spawnReason, CallbackInfoReturnable<Boolean> cir) {
        if (level instanceof ServerLevel serverLevel) {
            if (serverLevel.dimension().equals(FishingContestManager.FISHING_DIMENSION_KEY)) {
                cir.setReturnValue(false);
            }
        }
    }
}
