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
import net.minecraft.server.level.ServerPlayer;

@Mixin(Player.class)
public abstract class PlayerMixin {

    @Inject(method = "hurtServer", at = @At("HEAD"), cancellable = true)
    private void onHurt(ServerLevel level, DamageSource source, float amount, CallbackInfoReturnable<Boolean> cir) {
        Player player = (Player) (Object) this;
        if (level.dimension().equals(com.craftcore.fish.FishingContestManager.FISHING_DIMENSION_KEY)) {
            if (source.getEntity() instanceof ServerPlayer attacker) {
                attacker.sendSystemMessage(Component.literal("§c[釣魚保護區] 釣魚專屬維度內強制 0 PvP！禁止玩家相互攻擊。"));
            }
            cir.setReturnValue(false);
            return;
        }

        if (AfkManager.isAfk(player)) {
            cir.setReturnValue(false); // Completely invulnerable when AFK
            return;
        }

        if (source.getEntity() instanceof ServerPlayer attacker) {
            String attackerName = attacker.getName().getString();
            String victimName = player.getName().getString();

            if (!com.craftcore.pvp.PvpManager.isPvpEnabled(attackerName)) {
                attacker.sendSystemMessage(Component.literal("§c[PvP] 無法攻擊！你目前已關閉 PvP 模式 (/pvp)。"));
                cir.setReturnValue(false);
                return;
            }

            if (!com.craftcore.pvp.PvpManager.isPvpEnabled(victimName)) {
                attacker.sendSystemMessage(Component.literal("§c[PvP] 無法攻擊！目標玩家 §e" + victimName + " §c已關閉 PvP 模式 (/pvp)。"));
                cir.setReturnValue(false);
                return;
            }
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
                prefix.append(Component.literal(customTitle.trim() + "§r "));
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
