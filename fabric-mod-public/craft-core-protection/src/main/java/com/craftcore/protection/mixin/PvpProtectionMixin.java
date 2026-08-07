package com.craftcore.protection.mixin;

import com.craftcore.api.RebrandEngine;
import com.craftcore.protection.pvp.PvpManager;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Player.class)
public abstract class PvpProtectionMixin {

    @Inject(method = "hurtServer", at = @At("HEAD"), cancellable = true)
    private void onHurtServer(ServerLevel level, DamageSource source, float amount, CallbackInfoReturnable<Boolean> cir) {
        Player victim = (Player) (Object) this;
        if (source.getEntity() instanceof ServerPlayer attacker) {
            String attackerName = attacker.getName().getString();
            String victimName = victim.getName().getString();

            if (!PvpManager.isPvpEnabled(attackerName)) {
                attacker.sendSystemMessage(RebrandEngine.rebrandText("§c[PvP] 無法攻擊！你目前已關閉 PvP 模式 (/pvp)。"));
                cir.setReturnValue(false);
                return;
            }

            if (!PvpManager.isPvpEnabled(victimName)) {
                attacker.sendSystemMessage(RebrandEngine.rebrandText("§c[PvP] 無法攻擊！目標玩家 §e" + victimName + " §c已關閉 PvP 模式 (/pvp)。"));
                cir.setReturnValue(false);
                return;
            }
        }
    }
}
