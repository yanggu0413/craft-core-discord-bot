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

import org.spongepowered.asm.mixin.Unique;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

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

    @Unique
    private int craftCoreNibbleTicks = 0;

    @Unique
    private static final Map<UUID, Long> CRAFTCORE_LAST_REEL_TIME = new ConcurrentHashMap<>();

    @Inject(method = "retrieve", at = @At("HEAD"))
    private void onRetrieve(ItemStack stack, CallbackInfoReturnable<Integer> cir) {
        Player owner = getPlayerOwner();
        if (owner instanceof ServerPlayer player) {
            FishingHook hook = (FishingHook) (Object) this;
            boolean inFishingDim = player.level().dimension().identifier().toString().equals("craftcore:fishing");

            if (this.nibble > 0) {
                long now = System.currentTimeMillis();
                long lastReel = CRAFTCORE_LAST_REEL_TIME.getOrDefault(player.getUUID(), 0L);

                // Anti-Autoclicker Rule 1: Reaction time check (< 0.2 seconds / 4 ticks is humanly impossible)
                if (this.craftCoreNibbleTicks < 4) {
                    player.sendSystemMessage(net.minecraft.network.chat.Component.literal(
                            "§c⚡ [防連點系統] 拉竿反應過快 (<0.2秒)，魚兒受到驚嚇逃跑了！"
                    ));
                    player.level().playSound(null, player.getX(), player.getY(), player.getZ(),
                            net.minecraft.sounds.SoundEvents.FISH_SWIM,
                            net.minecraft.sounds.SoundSource.PLAYERS, 1.0f, 0.8f);
                    return;
                }

                // Anti-Autoclicker Rule 2: Minimum 1.2s delay between successful catches
                if (now - lastReel < 1200) {
                    player.sendSystemMessage(net.minecraft.network.chat.Component.literal(
                            "§c⚡ [防連點系統] 出竿收竿太頻繁，請保持正常釣魚節奏！"
                    ));
                    return;
                }

                CRAFTCORE_LAST_REEL_TIME.put(player.getUUID(), now);

                if (inFishingDim) {
                    AiDailyTaskManager.updateProgress(player, "FISH", "craftcore:fish", 1);
                }

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

    @Inject(method = "tick", at = @At("HEAD"))
    private void onTick(org.spongepowered.asm.mixin.injection.callback.CallbackInfo ci) {
        Player owner = getPlayerOwner();
        if (owner instanceof ServerPlayer player) {
            FishingHook hook = (FishingHook) (Object) this;
            boolean inFishingDim = player.level().dimension().identifier().toString().equals("craftcore:fishing");
            boolean hasSpeed = FishingContestManager.hasSpeedBuff(player.getUUID());
            if (inFishingDim || hasSpeed) {
                if (hook.isInWater()) {
                    int minWait = hasSpeed ? 100 : 200; // Speed buff: 5~10s wait, Normal: 10~20s wait
                    int maxWait = hasSpeed ? 200 : 400;

                    if (this.timeUntilHooked > maxWait) {
                        this.timeUntilHooked = minWait + player.getRandom().nextInt(maxWait - minWait + 1);
                    }
                }
            }

            // Track nibble ticks & apply sharp bobber plunge effect for 2-second reel window
            if (this.nibble > 0) {
                if (this.craftCoreNibbleTicks == 0) {
                    // Force exact 2 seconds (40 ticks) bite window
                    this.nibble = 40;

                    // Sharp downward plunge into water (浮標往下猛沉)
                    hook.setDeltaMovement(new net.minecraft.world.phys.Vec3(hook.getDeltaMovement().x, -0.55, hook.getDeltaMovement().z));

                    // Deep splash sound cue
                    player.level().playSound(null, hook.getX(), hook.getY(), hook.getZ(),
                            net.minecraft.sounds.SoundEvents.FISHING_BOBBER_SPLASH,
                            net.minecraft.sounds.SoundSource.PLAYERS, 1.5f, 0.85f);
                }
                this.craftCoreNibbleTicks++;
            } else {
                this.craftCoreNibbleTicks = 0;
            }
        }
    }
}
