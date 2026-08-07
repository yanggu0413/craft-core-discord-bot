package com.craftcore.util;

import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.item.component.ResolvableProfile;

import java.util.ArrayList;
import java.util.List;

public class ItemUtil {

    public static Item getItem(String id) {
        if (id == null || id.isEmpty()) return Items.PAPER;
        String cleanId = id.contains(":") ? id : "minecraft:" + id;
        try {
            Item item = BuiltInRegistries.ITEM.getValue(Identifier.parse(cleanId));
            return item != null ? item : Items.PAPER;
        } catch (Throwable t) {
            return Items.PAPER;
        }
    }

    public static ItemStack createGuiItem(Item item, int count, String displayName, List<String> loreLines) {
        ItemStack stack = new ItemStack(item != null ? item : Items.PAPER, Math.max(1, count));
        if (displayName != null && !displayName.isEmpty()) {
            stack.set(DataComponents.CUSTOM_NAME, TextUtil.parse(displayName));
        }
        if (loreLines != null && !loreLines.isEmpty()) {
            List<Component> components = new ArrayList<>();
            for (String line : loreLines) {
                components.add(TextUtil.parse(line));
            }
            stack.set(DataComponents.LORE, new ItemLore(components));
        }
        return stack;
    }

    public static ItemStack createGuiItem(Item item, String displayName, List<String> loreLines) {
        return createGuiItem(item, 1, displayName, loreLines);
    }

    public static ItemStack createGuiItem(String itemId, String displayName, List<String> loreLines) {
        return createGuiItem(getItem(itemId), 1, displayName, loreLines);
    }

    public static ItemStack createGuiItem(String itemId, int count, String displayName, List<String> loreLines) {
        return createGuiItem(getItem(itemId), count, displayName, loreLines);
    }

    public static ItemStack createPlayerHead(String username) {
        ItemStack headStack = new ItemStack(Items.PLAYER_HEAD);
        if (username != null && !username.isEmpty()) {
            try {
                headStack.set(DataComponents.PROFILE, ResolvableProfile.createUnresolved(username));
            } catch (Throwable ignored) {
            }
        }
        return headStack;
    }

    public static void setGlint(ItemStack stack, boolean glint) {
        if (stack != null && !stack.isEmpty()) {
            stack.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, glint);
        }
    }
}
