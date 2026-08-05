package com.craftcore.mixin;

import com.craftcore.fish.FishingContestManager;
import com.craftcore.task.AiDailyTaskManager;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.FishingHook;
import net.minecraft.world.item.ItemStack;
import org.jetbrains.annotations.Nullable;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(FishingHook.class)
public abstract class FishingHookMixin {

    @Shadow
    @Nullable
    public abstract Player getPlayerOwner();

    @Shadow
    private int nibble;

    @Shadow
    private int timeUntilHooked;

    @Inject(method = "retrieve", at = @At("HEAD"))
    private void onRetrieve(ItemStack stack, CallbackInfoReturnable<Integer> cir) {
        Player owner = getPlayerOwner();
        if (owner instanceof ServerPlayer player) {
            if (this.nibble > 0 && player.level().dimension().identifier().toString().equals("craftcore:fishing")) { // Catching something in fishing dimension
                AiDailyTaskManager.updateProgress(player, "FISH", "craftcore:fish", 1);
            }
        }
    }

    @Inject(method = "tick", at = @At("HEAD"))
    private void onTick(org.spongepowered.asm.mixin.injection.callback.CallbackInfo ci) {
        Player owner = getPlayerOwner();
        if (owner instanceof ServerPlayer player && FishingContestManager.hasSpeedBuff(player.getUUID())) {
            if (this.timeUntilHooked > 1) {
                this.timeUntilHooked--; // Double speed ticking for wait time
            }
        }
    }
}
