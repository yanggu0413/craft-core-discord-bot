package com.craftcore.mixin;

import com.craftcore.fish.FishingContestManager;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.boss.wither.WitherBoss;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ServerLevel.class)
public class ServerLevelMixin {

    @Inject(method = "addFreshEntity", at = @At("HEAD"), cancellable = true)
    private void onAddFreshEntity(Entity entity, CallbackInfoReturnable<Boolean> cir) {
        ServerLevel level = (ServerLevel) (Object) this;
        String dim = level.dimension().identifier().toString();
        if ("craftcore:fishing".equals(dim) || "craftcore:lobby".equals(dim)) {
            if (entity instanceof Mob || entity instanceof WitherBoss) {
                cir.setReturnValue(false);
            }
        }
    }
}
