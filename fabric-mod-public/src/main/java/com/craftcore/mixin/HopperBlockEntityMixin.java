package com.craftcore.mixin;

import com.craftcore.shop.ShopManager;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.Hopper;
import net.minecraft.world.level.block.entity.HopperBlockEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(HopperBlockEntity.class)
public class HopperBlockEntityMixin {
    @Inject(method = "extract", at = @At("HEAD"), cancellable = true, require = 0)
    private static void onExtract(Level level, Hopper hopper, CallbackInfoReturnable<Boolean> cir) {
        if (level != null && hopper != null) {
            BlockPos sourcePos = BlockPos.containing(hopper.getLevelX(), hopper.getLevelY() + 1.0D, hopper.getLevelZ());
            String coords = sourcePos.getX() + "," + sourcePos.getY() + "," + sourcePos.getZ();
            String dim = level.dimension().identifier().toString();
            String key = dim + ":" + coords;
            ShopManager.Shop shop = ShopManager.getShop(key);
            if (shop != null) {
                cir.setReturnValue(false);
            }
        }
    }

    @Inject(method = "suckInItems", at = @At("HEAD"), cancellable = true, require = 0)
    private static void onSuckInItems(Level level, Hopper hopper, CallbackInfoReturnable<Boolean> cir) {
        if (level != null && hopper != null) {
            BlockPos sourcePos = BlockPos.containing(hopper.getLevelX(), hopper.getLevelY() + 1.0D, hopper.getLevelZ());
            String coords = sourcePos.getX() + "," + sourcePos.getY() + "," + sourcePos.getZ();
            String dim = level.dimension().identifier().toString();
            String key = dim + ":" + coords;
            ShopManager.Shop shop = ShopManager.getShop(key);
            if (shop != null) {
                cir.setReturnValue(false);
            }
        }
    }
}
