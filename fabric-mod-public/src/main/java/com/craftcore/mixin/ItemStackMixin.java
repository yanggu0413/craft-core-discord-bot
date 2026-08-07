package com.craftcore.mixin;

import com.craftcore.util.ShulkerBoxUtil;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ItemStack.class)
public class ItemStackMixin {

    @Inject(method = "getMaxCount", at = @At("HEAD"), cancellable = true, require = 0)
    private void onGetMaxCount(CallbackInfoReturnable<Integer> cir) {
        ItemStack stack = (ItemStack) (Object) this;
        if (ShulkerBoxUtil.isEmptyShulkerBox(stack)) {
            cir.setReturnValue(16);
        }
    }

    @Inject(method = "getMaxStackSize", at = @At("HEAD"), cancellable = true, require = 0)
    private void onGetMaxStackSize(CallbackInfoReturnable<Integer> cir) {
        ItemStack stack = (ItemStack) (Object) this;
        if (ShulkerBoxUtil.isEmptyShulkerBox(stack)) {
            cir.setReturnValue(16);
        }
    }
}
