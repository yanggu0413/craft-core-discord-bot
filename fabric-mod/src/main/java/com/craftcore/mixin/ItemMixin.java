package com.craftcore.mixin;

import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.ShulkerBoxBlock;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Item.class)
public class ItemMixin {

    @Inject(method = "getDefaultMaxStackSize", at = @At("HEAD"), cancellable = true, require = 0)
    private void onGetDefaultMaxStackSize(CallbackInfoReturnable<Integer> cir) {
        Item item = (Item) (Object) this;
        if (item instanceof BlockItem blockItem && blockItem.getBlock() instanceof ShulkerBoxBlock) {
            cir.setReturnValue(16);
        }
    }

    @Inject(method = "getMaxCount", at = @At("HEAD"), cancellable = true, require = 0)
    private void onGetMaxCount(CallbackInfoReturnable<Integer> cir) {
        Item item = (Item) (Object) this;
        if (item instanceof BlockItem blockItem && blockItem.getBlock() instanceof ShulkerBoxBlock) {
            cir.setReturnValue(16);
        }
    }
}
