package com.craftcore.mixin;

import com.craftcore.claim.ClaimManager;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.decoration.HangingEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(HangingEntity.class)
public class HangingEntityMixin {
    @Inject(method = "hurtServer", at = @At("HEAD"), cancellable = true)
    private void onHurtServer(ServerLevel level, DamageSource damageSource, float amount, CallbackInfoReturnable<Boolean> cir) {
        HangingEntity entity = (HangingEntity) (Object) this;
        BlockPos pos = entity.blockPosition();
        ClaimManager.Claim claim = ClaimManager.getClaimAt(pos, level);
        if (claim != null) {
            if (damageSource.getEntity() instanceof ServerPlayer player) {
                if (!ClaimManager.checkPermission(player, pos, level, "break") && !ClaimManager.checkPermission(player, pos, level, "interact")) {
                    cir.setReturnValue(false);
                }
            } else {
                if (claim.explosion_protection) {
                    cir.setReturnValue(false);
                }
            }
        }
    }
}
