package com.craftcore.mixin;

import net.minecraft.server.network.ServerGamePacketListenerImpl;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.phys.Vec3;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.ModifyConstant;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(ServerGamePacketListenerImpl.class)
public class ServerGamePacketListenerImplMixin {
    @Shadow
    public ServerPlayer player;

    @ModifyConstant(
        method = "handleUseItemOn",
        constant = @Constant(doubleValue = 36.0),
        require = 0
    )
    private double modifyMaxInteractDistance36(double original) {
        return 4096.0;
    }

    @ModifyConstant(
        method = "handleUseItemOn",
        constant = @Constant(doubleValue = 64.0),
        require = 0
    )
    private double modifyMaxInteractDistance64(double original) {
        return 4096.0;
    }

    @Redirect(
        method = "handleUseItemOn",
        at = @At(
            value = "INVOKE",
            target = "Lnet/minecraft/world/phys/Vec3;distanceToSqr(Lnet/minecraft/world/phys/Vec3;)D"
        ),
        require = 0
    )
    private double redirectDistanceToSqr(Vec3 instance, Vec3 vec) {
        double realDistance = instance.distanceToSqr(vec);
        if (player != null) {
            // Check if player is standing near the target block (within 8 blocks / 64.0 sq distance)
            double distanceToPlayer = player.position().distanceToSqr(vec);
            if (distanceToPlayer <= 64.0) {
                return 0.0; // Legitimate Litematica placement near player: Bypass anchor rejection
            }
        }
        return realDistance; // Far away placement (Reach Hack): Enforce vanilla rejection!
    }
}
