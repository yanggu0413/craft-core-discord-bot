package com.craftcore.claim.mixin;

import com.craftcore.claim.ClaimManager;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Explosion;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.function.BiConsumer;

@Mixin(BlockBehaviour.class)
public class ClaimExplosionMixin {
    @Inject(method = "onExplosionHit", at = @At("HEAD"), cancellable = true)
    private void onExplosionHit(BlockState state, ServerLevel level, BlockPos pos, Explosion explosion, BiConsumer<ItemStack, BlockPos> dropConsumer, CallbackInfo ci) {
        if (level != null) {
            String dim = level.dimension().identifier().toString();
            if ("craftcore:fishing".equals(dim) || "craftcore:lobby".equals(dim)) {
                ci.cancel();
                return;
            }
        }

        ClaimManager.Claim claim = ClaimManager.getClaimAt(pos, level);
        if (claim != null && claim.explosion_protection) {
            ci.cancel();
        }
    }
}
