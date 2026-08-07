package com.craftcore.claim.mixin;

import com.craftcore.claim.ClaimManager;
import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.monster.EnderMan;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(targets = "net.minecraft.world.entity.monster.EnderMan$EndermanTakeBlockGoal")
public class EndermanTakeBlockGoalMixin {
    @Shadow @Final private EnderMan enderman;

    @Inject(method = "canUse", at = @At("HEAD"), cancellable = true)
    private void onCanUse(CallbackInfoReturnable<Boolean> cir) {
        if (ClaimManager.isEmpty()) return;
        if (enderman != null && enderman.level() != null) {
            BlockPos pos = enderman.blockPosition();
            ClaimManager.Claim claim = ClaimManager.getClaimAt(pos, enderman.level());
            if (claim != null && claim.explosion_protection) {
                cir.setReturnValue(false);
            }
        }
    }
}
