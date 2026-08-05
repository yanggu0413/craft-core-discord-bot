package com.craftcore.mixin;

import com.craftcore.mushroom.MushroomManager;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.context.BlockPlaceContext;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(BlockItem.class)
public class BlockItemMixin {

    @Inject(method = "place", at = @At("HEAD"), cancellable = true, require = 0)
    private void onPlaceBlock(BlockPlaceContext context, CallbackInfoReturnable<InteractionResult> cir) {
        if (context != null && MushroomManager.isMushroom(context.getItemInHand())) {
            if (context.getPlayer() != null) {
                context.getPlayer().sendSystemMessage(Component.literal("§c[Craft-Core] 【洋菇】為個人綁定物品，無法放置至地面！"));
                if (context.getPlayer() instanceof ServerPlayer sp) {
                    sp.containerMenu.sendAllDataToRemote();
                    sp.inventoryMenu.sendAllDataToRemote();
                }
            }
            cir.setReturnValue(InteractionResult.FAIL);
        }
    }
}
