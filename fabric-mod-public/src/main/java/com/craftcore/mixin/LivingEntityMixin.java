package com.craftcore.mixin;

import com.craftcore.task.DailyTaskManager;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.damagesource.DamageSource;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import com.craftcore.afk.AfkManager;
import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(LivingEntity.class)
public class LivingEntityMixin {
    @Inject(method = "die", at = @At("HEAD"))
    private void onEntityDeath(DamageSource damageSource, CallbackInfo ci) {
        LivingEntity entity = (LivingEntity) (Object) this;
        DailyTaskManager.handleEntityKill(entity, damageSource);
        if (damageSource.getEntity() instanceof net.minecraft.server.level.ServerPlayer attacker) {
            String entityId = net.minecraft.core.registries.BuiltInRegistries.ENTITY_TYPE.getKey(entity.getType()).toString();
            com.craftcore.task.AiDailyTaskManager.updateProgress(attacker, "KILL", entityId, 1);
            com.craftcore.achievement.CustomAchievementManager.checkMacePigKill(attacker, entity, attacker.fallDistance);
        }
    }

    @Inject(method = "hurtServer", at = @At("HEAD"))
    private void onEntityHurt(net.minecraft.server.level.ServerLevel level, DamageSource source, float amount, CallbackInfoReturnable<Boolean> cir) {
        if (source.getEntity() instanceof net.minecraft.server.level.ServerPlayer attacker) {
            LivingEntity target = (LivingEntity) (Object) this;
            com.craftcore.trail.ParticleTrailManager.onPlayerAttack(attacker, target.getX(), target.getY(), target.getZ());
        }
    }

    @Inject(method = "isPushable", at = @At("HEAD"), cancellable = true)
    private void onIsPushable(CallbackInfoReturnable<Boolean> cir) {
        if ((Object) this instanceof Player player) {
            if (AfkManager.isAfk(player)) {
                cir.setReturnValue(false); // Cannot be pushed when AFK
            }
        }
    }
}
