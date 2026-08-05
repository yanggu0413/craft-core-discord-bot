package com.craftcore.util;

import net.minecraft.core.component.DataComponents;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.component.ItemContainerContents;
import net.minecraft.world.level.block.ShulkerBoxBlock;

public class ShulkerBoxUtil {

    public static boolean isEmptyShulkerBox(ItemStack stack) {
        if (stack == null || stack.isEmpty()) {
            return false;
        }

        if (!(stack.getItem() instanceof BlockItem blockItem)) {
            return false;
        }

        if (!(blockItem.getBlock() instanceof ShulkerBoxBlock)) {
            return false;
        }

        // 1. Check DataComponents.CONTAINER
        ItemContainerContents container = stack.get(DataComponents.CONTAINER);
        if (container != null && container.nonEmptyItems().iterator().hasNext()) {
            return false;
        }

        // 2. Check DataComponents.CUSTOM_DATA
        CustomData customData = stack.get(DataComponents.CUSTOM_DATA);
        if (customData != null) {
            try {
                net.minecraft.nbt.CompoundTag tag = customData.copyTag();
                if (tag.contains("Items")) {
                    net.minecraft.nbt.Tag itemsTag = tag.get("Items");
                    if (itemsTag instanceof net.minecraft.nbt.ListTag listTag && !listTag.isEmpty()) {
                        return false;
                    }
                }
            } catch (Throwable ignored) {}
        }

        return true;
    }

    public static void normalizeEmptyShulkerBox(ItemStack stack) {
        if (isEmptyShulkerBox(stack)) {
            ItemContainerContents container = stack.get(DataComponents.CONTAINER);
            if (container != null && !container.nonEmptyItems().iterator().hasNext()) {
                stack.remove(DataComponents.CONTAINER);
            }
        }
    }
}
