package com.craftcore;

import com.craftcore.util.ShulkerBoxUtil;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemContainerContents;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class ShulkerBoxUtilTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @Test
    public void testNonShulkerItems() {
        assertFalse(ShulkerBoxUtil.isEmptyShulkerBox(null));
        assertFalse(ShulkerBoxUtil.isEmptyShulkerBox(ItemStack.EMPTY));
        assertFalse(ShulkerBoxUtil.isEmptyShulkerBox(new ItemStack(Items.DIAMOND)));
    }

    @Test
    public void testEmptyShulkerBox() {
        ItemStack emptyBox = new ItemStack(Items.SHULKER_BOX);
        assertTrue(ShulkerBoxUtil.isEmptyShulkerBox(emptyBox));

        Item whiteShulker = BuiltInRegistries.ITEM.getValue(Identifier.parse("minecraft:white_shulker_box"));
        if (whiteShulker != null) {
            ItemStack whiteBox = new ItemStack(whiteShulker);
            assertTrue(ShulkerBoxUtil.isEmptyShulkerBox(whiteBox));
        }
    }

    @Test
    public void testNonEmptyShulkerBox() {
        ItemStack boxWithItems = new ItemStack(Items.SHULKER_BOX);
        boxWithItems.set(DataComponents.CONTAINER, ItemContainerContents.fromItems(List.of(new ItemStack(Items.DIAMOND, 64))));
        assertFalse(ShulkerBoxUtil.isEmptyShulkerBox(boxWithItems));
    }
}
