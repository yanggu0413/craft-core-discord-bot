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

    @Shadow
    @Nullable
    private net.minecraft.world.entity.Entity hookedIn;

    @Inject(method = "retrieve", at = @At("HEAD"))
    private void onRetrieve(ItemStack stack, CallbackInfoReturnable<Integer> cir) {
        Player owner = getPlayerOwner();
        if (owner instanceof ServerPlayer player) {
            boolean inFishingDim = player.level().dimension().identifier().toString().equals("craftcore:fishing");

            if (this.nibble > 0 || this.hookedIn != null || inFishingDim) {
                if (inFishingDim) {
                    AiDailyTaskManager.updateProgress(player, "FISH", "craftcore:fish", 1);
                }
                if (this.nibble > 0) {
                    ItemStack caught = FishingContestManager.onPlayerCatchFish(player, new ItemStack(net.minecraft.world.item.Items.COD));
                    if (caught != null && !caught.isEmpty()) {
                        net.minecraft.world.entity.item.ItemEntity entity = new net.minecraft.world.entity.item.ItemEntity(
                                player.level(), player.getX(), player.getY() + 0.5, player.getZ(), caught
                        );
                        entity.setDeltaMovement(0, 0.2, 0);
                        player.level().addFreshEntity(entity);
                    }
                }
            }
        }
    }

    @Inject(method = "tick", at = @At("HEAD"))
    private void onTick(org.spongepowered.asm.mixin.injection.callback.CallbackInfo ci) {
        Player owner = getPlayerOwner();
        if (owner instanceof ServerPlayer player) {
            boolean inFishingDim = player.level().dimension().identifier().toString().equals("craftcore:fishing");
            if (inFishingDim || FishingContestManager.hasSpeedBuff(player.getUUID())) {
                if (this.timeUntilHooked > 2) {
                    this.timeUntilHooked = Math.max(1, this.timeUntilHooked - 4); // 5x speed: bite in 2 ~ 4 seconds!
                }
            }
        }
    }
}
