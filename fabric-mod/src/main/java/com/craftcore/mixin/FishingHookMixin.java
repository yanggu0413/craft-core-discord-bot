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
            FishingHook hook = (FishingHook) (Object) this;
            boolean inFishingDim = player.level().dimension().identifier().toString().equals("craftcore:fishing");

            if (this.nibble > 0 || this.hookedIn != null || inFishingDim) {
                if (inFishingDim) {
                    AiDailyTaskManager.updateProgress(player, "FISH", "craftcore:fish", 1);
                }
                // Give fish if nibble > 0 or in fishing dimension when pulling rod in water
                if (this.nibble > 0 || (inFishingDim && hook.isInWater())) {
                    ItemStack caught = FishingContestManager.onPlayerCatchFish(player, new ItemStack(net.minecraft.world.item.Items.COD));
                    if (caught != null && !caught.isEmpty()) {
                        if (!player.getInventory().add(caught)) {
                            player.drop(caught, false);
                        }
                        player.level().playSound(null, player.getX(), player.getY(), player.getZ(),
                                net.minecraft.sounds.SoundEvents.ITEM_PICKUP,
                                net.minecraft.sounds.SoundSource.PLAYERS, 1.0f, 1.2f);
                    }
                }
            }
        }
    }

    @Inject(method = "tick", at = @At("HEAD"))
    private void onTick(org.spongepowered.asm.mixin.injection.callback.CallbackInfo ci) {
        Player owner = getPlayerOwner();
        if (owner instanceof ServerPlayer player) {
            FishingHook hook = (FishingHook) (Object) this;
            boolean inFishingDim = player.level().dimension().identifier().toString().equals("craftcore:fishing");
            if (inFishingDim || FishingContestManager.hasSpeedBuff(player.getUUID())) {
                if (hook.isInWater()) {
                    if (this.timeUntilHooked > 5) {
                        this.timeUntilHooked = 5; // Fast bite in 0.25 seconds!
                    } else if (this.timeUntilHooked <= 0 && this.nibble <= 0) {
                        this.nibble = 40; // 2 seconds splash & bite window!
                    }
                }
            }
        }
    }
}
