package com.craftcore.mixin;

import net.minecraft.server.network.ServerGamePacketListenerImpl;
import net.minecraft.server.level.ServerPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.ModifyConstant;

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
        return 4096.0; // Expand to 64 blocks reach to allow Litematica Easy Place Mode without ghost blocks
    }

    @ModifyConstant(
        method = "handleUseItemOn",
        constant = @Constant(doubleValue = 64.0),
        require = 0
    )
    private double modifyMaxInteractDistance64(double original) {
        return 4096.0; // Expand to 64 blocks reach to allow Litematica Easy Place Mode without ghost blocks
    }
}
