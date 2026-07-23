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

import net.minecraft.server.level.ServerLevel;

@Mixin(Player.class)
public abstract class PlayerMixin {

    @Inject(method = "hurtServer", at = @At("HEAD"), cancellable = true)
    private void onHurt(ServerLevel level, DamageSource source, float amount, CallbackInfoReturnable<Boolean> cir) {
        Player player = (Player) (Object) this;
        if (AfkManager.isAfk(player)) {
            cir.setReturnValue(false); // Completely invulnerable when AFK
        }
    }

    @Inject(method = "getDisplayName", at = @At("RETURN"), cancellable = true)
    private void onGetDisplayName(CallbackInfoReturnable<Component> cir) {
        Player player = (Player) (Object) this;
        String username = player.getName().getString();
        boolean isAfk = AfkManager.isAfk(player);
        boolean isFakePlayer = username.toLowerCase().startsWith("fp_");
        String customTitle = com.craftcore.title.TitleManager.getTitlePrefix(username);

        if (isAfk || isFakePlayer || !customTitle.isEmpty()) {
            Component original = cir.getReturnValue();
            MutableComponent prefix = Component.empty();
            if (isAfk) {
                prefix.append(Component.literal("§7[AFK] "));
            }
            if (!customTitle.isEmpty()) {
                prefix.append(Component.literal(customTitle));
            }
            if (isFakePlayer) {
                prefix.append(Component.literal("§8[假人] "));
            }

            if (original != null) {
                cir.setReturnValue(prefix.append(original));
            } else {
                cir.setReturnValue(prefix.append(player.getName()));
            }
        }
    }
}
