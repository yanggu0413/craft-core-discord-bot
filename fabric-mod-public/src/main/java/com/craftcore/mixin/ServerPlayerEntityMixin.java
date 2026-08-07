package com.craftcore.mixin;

import com.craftcore.afk.AfkManager;
import com.craftcore.teleport.BackManager;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.server.level.ServerPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ServerPlayer.class)
public class ServerPlayerEntityMixin {
    @Inject(method = "tick", at = @At("HEAD"))
    private void onPlayerTick(CallbackInfo ci) {
        ServerPlayer player = (ServerPlayer) (Object) this;
        com.craftcore.fish.FishingContestManager.tickPlayerBuffs(player);
    }

    @Inject(method = "die", at = @At("HEAD"))
    private void onPlayerDeath(DamageSource damageSource, CallbackInfo ci) {
        ServerPlayer player = (ServerPlayer) (Object) this;
        String username = player.getName().getString();
        String uuid = player.getStringUUID();
        String deathMessage = player.getCombatTracker().getDeathMessage().getString();

        // 紀錄死亡位置為返回點
        BackManager.recordLocation(player);
    }

    @Inject(method = "getTabListDisplayName", at = @At("RETURN"), cancellable = true)
    private void onGetTabListDisplayName(CallbackInfoReturnable<Component> cir) {
        ServerPlayer player = (ServerPlayer) (Object) this;
        // 使用 player.getDisplayName() (由 PlayerMixin 統一加上單一 [AFK] 或 [服主] 標籤)，避免重複雙重 [服主]
        cir.setReturnValue(player.getDisplayName());
    }

    @Inject(method = "drop(Lnet/minecraft/world/item/ItemStack;ZZ)Lnet/minecraft/world/entity/item/ItemEntity;", at = @At("HEAD"), cancellable = true, require = 0)
    private void onDropItem(net.minecraft.world.item.ItemStack stack, boolean retainOwnership, boolean includeName, CallbackInfoReturnable<net.minecraft.world.entity.item.ItemEntity> cir) {
        if (com.craftcore.mushroom.MushroomManager.isMushroom(stack)) {
            ServerPlayer player = (ServerPlayer) (Object) this;
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 【洋菇】為個人專屬綁定物品，無法丟棄！"));
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), net.minecraft.sounds.SoundEvents.VILLAGER_NO, net.minecraft.sounds.SoundSource.PLAYERS, 1.0f, 1.0f);

            // Re-add to inventory and force client sync so it NEVER vanishes from hand/inventory
            player.getInventory().add(stack.copy());
            player.containerMenu.sendAllDataToRemote();
            player.inventoryMenu.sendAllDataToRemote();
            cir.setReturnValue(null);
        }
    }
}
