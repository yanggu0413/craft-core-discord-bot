package com.craftcore.mixin;

import com.craftcore.claim.ClaimManager;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LevelAccessor;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.material.FlowingFluid;
import net.minecraft.world.level.material.FluidState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(FlowingFluid.class)
public class FlowingFluidMixin {
    @Inject(method = "spreadTo", at = @At("HEAD"), cancellable = true)
    private void onSpreadTo(LevelAccessor level, BlockPos pos, BlockState state, Direction direction, FluidState fluidState, CallbackInfo ci) {
        if (level instanceof Level l) {
            ClaimManager.Claim dstClaim = ClaimManager.getClaimAt(pos, l);
            if (dstClaim != null) {
                BlockPos srcPos = pos.relative(direction.getOpposite());
                ClaimManager.Claim srcClaim = ClaimManager.getClaimAt(srcPos, l);
                if (srcClaim == null || !srcClaim.owner.equalsIgnoreCase(dstClaim.owner)) {
                    ci.cancel();
                }
            }
        }
    }
}
