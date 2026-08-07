package com.craftcore;

import com.craftcore.fish.FishCodexManager;
import com.craftcore.fish.FishSellManager;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class FishSellAndCodexTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @Test
    public void testFishCodexSpeciesList() {
        assertEquals(20, FishCodexManager.ALL_SPECIES.size());
    }

    @Test
    public void testEmptyItemPrice() {
        ItemStack empty = ItemStack.EMPTY;
        assertEquals(0.0, FishSellManager.calculateFishPrice(empty));
    }
}
