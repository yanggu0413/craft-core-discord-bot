package com.craftcore.claim.mixin;

import com.craftcore.claim.ClaimManager;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.piston.PistonStructureResolver;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import java.util.List;

@Mixin(PistonStructureResolver.class)
public class PistonStructureResolverMixin {
    @Shadow @Final private Level level;
    @Shadow @Final private BlockPos pistonPos;
    @Shadow @Final private Direction pushDirection;
    @Shadow @Final private List<BlockPos> toPush;
    @Shadow @Final private List<BlockPos> toDestroy;

    @Inject(method = "resolve", at = @At("RETURN"), cancellable = true)
    private void onResolve(CallbackInfoReturnable<Boolean> cir) {
        if (!cir.getReturnValueZ()) return;
        if (level == null || pistonPos == null) return;

        ClaimManager.Claim pistonClaim = ClaimManager.getClaimAt(pistonPos, level);
        String pistonOwner = (pistonClaim != null) ? pistonClaim.owner : null;

        if (toPush != null) {
            for (BlockPos pos : toPush) {
                ClaimManager.Claim srcClaim = ClaimManager.getClaimAt(pos, level);
                String srcOwner = (srcClaim != null) ? srcClaim.owner : null;

                BlockPos targetPos = pos.relative(pushDirection);
                ClaimManager.Claim dstClaim = ClaimManager.getClaimAt(targetPos, level);
                String dstOwner = (dstClaim != null) ? dstClaim.owner : null;

                if (srcClaim != null && (pistonOwner == null || !pistonOwner.equalsIgnoreCase(srcOwner))) {
                    cir.setReturnValue(false);
                    return;
                }
                if (dstClaim != null && (pistonOwner == null || !pistonOwner.equalsIgnoreCase(dstOwner))) {
                    cir.setReturnValue(false);
                    return;
                }
                if (srcClaim != null && dstClaim != null && !srcOwner.equalsIgnoreCase(dstOwner)) {
                    cir.setReturnValue(false);
                    return;
                }
            }
        }

        if (toDestroy != null) {
            for (BlockPos pos : toDestroy) {
                ClaimManager.Claim destroyClaim = ClaimManager.getClaimAt(pos, level);
                if (destroyClaim != null) {
                    String destroyOwner = destroyClaim.owner;
                    if (pistonOwner == null || !pistonOwner.equalsIgnoreCase(destroyOwner)) {
                        cir.setReturnValue(false);
                        return;
                    }
                }
            }
        }
    }
}
