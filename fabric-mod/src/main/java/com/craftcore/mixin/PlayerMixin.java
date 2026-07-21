package com.craftcore.mixin;

import com.craftcore.afk.AfkManager;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Player.class)
public abstract class PlayerMixin {

    @Inject(method = "hurt", at = @At("HEAD"), cancellable = true)
    private void onHurt(DamageSource source, float amount, CallbackInfoReturnable<Boolean> cir) {
        Player player = (Player) (Object) this;
        if (AfkManager.isAfk(player)) {
            cir.setReturnValue(false); // Completely invulnerable when AFK
        }
    }

    @Inject(method = "isPushable", at = @At("HEAD"), cancellable = true)
    private void onIsPushable(CallbackInfoReturnable<Boolean> cir) {
        Player player = (Player) (Object) this;
        if (AfkManager.isAfk(player)) {
            cir.setReturnValue(false); // Cannot be pushed when AFK
        }
    }

    @Inject(method = "getDisplayName", at = @At("RETURN"), cancellable = true)
    private void onGetDisplayName(CallbackInfoReturnable<Component> cir) {
        Player player = (Player) (Object) this;
        String username = player.getName().getString();
        boolean isOwner = "im_little_rory".equalsIgnoreCase(username);
        boolean isAfk = AfkManager.isAfk(player);

        if (isOwner || isAfk) {
            Component original = cir.getReturnValue();
            MutableComponent prefix = Component.empty();
            if (isAfk) {
                prefix.append(Component.literal("§7[AFK] "));
            }
            if (isOwner) {
                prefix.append(Component.literal("§c[服主] "));
            }

            if (original != null) {
                cir.setReturnValue(prefix.append(original));
            } else {
                cir.setReturnValue(prefix.append(player.getName()));
            }
        }
    }
}
