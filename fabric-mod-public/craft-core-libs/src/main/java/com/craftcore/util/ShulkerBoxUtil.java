package com.craftcore.util;

import net.minecraft.core.component.DataComponents;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.Tag;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.component.ItemContainerContents;
import net.minecraft.world.level.block.ShulkerBoxBlock;

public class ShulkerBoxUtil {

    public static boolean isShulkerBox(ItemStack stack) {
        if (stack == null || stack.isEmpty()) return false;
        return stack.getItem() instanceof BlockItem blockItem && blockItem.getBlock() instanceof ShulkerBoxBlock;
    }

    public static boolean isEmptyShulkerBox(ItemStack stack) {
        if (!isShulkerBox(stack)) return false;

        ItemContainerContents container = stack.get(DataComponents.CONTAINER);
        if (container != null && container.nonEmptyItems().iterator().hasNext()) {
            return false;
        }

        CustomData customData = stack.get(DataComponents.CUSTOM_DATA);
        if (customData != null) {
            try {
                CompoundTag tag = customData.copyTag();
                if (tag.contains("Items")) {
                    Tag itemsTag = tag.get("Items");
                    if (itemsTag instanceof ListTag listTag && !listTag.isEmpty()) {
                        return false;
                    }
                }
            } catch (Throwable ignored) {
            }
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
