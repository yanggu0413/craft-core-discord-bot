package com.craftcore.mixin;

import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Explosion;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import java.util.function.BiConsumer;
import net.minecraft.world.item.ItemStack;
import com.craftcore.shop.ShopManager;
import net.minecraft.world.level.block.ChestBlock;
import net.minecraft.core.Direction;

@Mixin(BlockBehaviour.class)
public class BlockBehaviourMixin {
    @Inject(method = "onExplosionHit", at = @At("HEAD"), cancellable = true)
    private void onExplosionHit(BlockState state, ServerLevel level, BlockPos pos, Explosion explosion, BiConsumer<ItemStack, BlockPos> dropConsumer, CallbackInfo ci) {
        String coords = pos.getX() + "," + pos.getY() + "," + pos.getZ();
        String dimension = level.dimension().identifier().toString();
        String key = dimension + ":" + coords;
        
        // Check if the block being exploded is a chest shop
        if (state.getBlock() instanceof ChestBlock) {
            ShopManager.Shop shop = ShopManager.getShop(key);
            if (shop == null) {
                // Check double chest neighbor
                net.minecraft.world.level.block.state.properties.ChestType chestType = state.getValue(ChestBlock.TYPE);
                if (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT || chestType == net.minecraft.world.level.block.state.properties.ChestType.RIGHT) {
                    Direction facing = state.getValue(ChestBlock.FACING);
                    Direction dirToAttached = (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT) 
                        ? facing.getClockWise() 
                        : facing.getCounterClockWise();
                    BlockPos neighborPos = pos.relative(dirToAttached);
                    String neighborKey = dimension + ":" + neighborPos.getX() + "," + neighborPos.getY() + "," + neighborPos.getZ();
                    shop = ShopManager.getShop(neighborKey);
                }
            }
            if (shop != null) {
                ci.cancel(); // Cancel chest destruction!
                return;
            }
        }
        
        // Check if it's a sign block attached to any shop
        if (state.getBlock() instanceof net.minecraft.world.level.block.SignBlock) {
            for (Direction dir : Direction.values()) {
                BlockPos adjacentPos = pos.relative(dir);
                var adjacentState = level.getBlockState(adjacentPos);
                if (adjacentState.getBlock() instanceof ChestBlock) {
                    String adjCoords = adjacentPos.getX() + "," + adjacentPos.getY() + "," + adjacentPos.getZ();
                    String adjKey = dimension + ":" + adjCoords;
                    ShopManager.Shop shop = ShopManager.getShop(adjKey);
                    if (shop == null) {
                        net.minecraft.world.level.block.state.properties.ChestType chestType = adjacentState.getValue(ChestBlock.TYPE);
                        if (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT || chestType == net.minecraft.world.level.block.state.properties.ChestType.RIGHT) {
                            Direction facing = adjacentState.getValue(ChestBlock.FACING);
                            Direction dirToAttached = (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT) 
                                ? facing.getClockWise() 
                                : facing.getCounterClockWise();
                            BlockPos neighborPos = adjacentPos.relative(dirToAttached);
                            String neighborKey = dimension + ":" + neighborPos.getX() + "," + neighborPos.getY() + "," + neighborPos.getZ();
                            shop = ShopManager.getShop(neighborKey);
                        }
                    }
                    if (shop != null) {
                        ci.cancel(); // Cancel sign destruction!
                        return;
                    }
                }
            }
        }
    }
}
