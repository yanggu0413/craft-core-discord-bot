package com.craftcore.shop;

import com.craftcore.data.AsyncSaveExecutor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class ShopStressTest {

    @TempDir
    Path tempDir;

    @BeforeEach
    public void setUp() {
        AsyncSaveExecutor.flush();
        ShopManager.setConfigPath(tempDir.resolve("shops_stress_" + System.nanoTime() + ".json"));
        ShopManager.clearAll();
        AsyncSaveExecutor.flush();
    }

    @AfterEach
    public void tearDown() {
        AsyncSaveExecutor.flush();
    }

    @Test
    public void testShopSlotLimitEnforcement() {
        String owner = "ShopMaster";
        
        // Base slot limit is 15
        for (int i = 1; i <= 15; i++) {
            boolean created = ShopManager.registerShop(owner, "10," + i + ",20", "minecraft:diamond", 100.0, 50.0, 10);
            assertTrue(created, "Shop " + i + " should be created within default 15 limit");
        }

        // 16th shop should fail unless limit is upgraded
        boolean overflow = ShopManager.registerShop(owner, "10,16,20", "minecraft:diamond", 100.0, 50.0, 10);
        assertFalse(overflow, "16th shop creation should be rejected due to slot limit!");

        // Updating an existing shop should still be allowed
        boolean updateExisting = ShopManager.registerShop(owner, "10,1,20", "minecraft:diamond", 120.0, 60.0, 15);
        assertTrue(updateExisting, "Updating an existing shop key should be allowed");
    }

    @Test
    public void testShopRatingBoundsAndAverages() {
        String coords = "minecraft:overworld:100,64,200";
        ShopManager.registerShop("TraderBob", coords, "minecraft:iron_ingot", 50.0, 0.0, 10);

        assertEquals(0.0, ShopManager.getAverageRating(coords));
        assertEquals("N/A", ShopManager.getAverageRatingString(coords));

        ShopManager.addShopRating(coords, 5);
        ShopManager.addShopRating(coords, 3);

        assertEquals(4.0, ShopManager.getAverageRating(coords), 0.01);
        assertEquals("4.0 ★", ShopManager.getAverageRatingString(coords));

        // Rating flow via chat input
        ShopManager.addRatingSession("RaterUser", coords);
        assertTrue(ShopManager.hasRatingSession("RaterUser"));

        // Out of bounds rating input
        ShopManager.ChatInterceptionResult resInvalid = ShopManager.handleChatInput("RaterUser", "6");
        assertTrue(resInvalid.intercepted);
        assertFalse(resInvalid.success);
        assertTrue(resInvalid.responseMessage.contains("分數必須在 1 到 5 之間"));

        // Valid rating input
        ShopManager.ChatInterceptionResult resValid = ShopManager.handleChatInput("RaterUser", "4");
        assertTrue(resValid.intercepted);
        assertTrue(resValid.success);
        assertFalse(ShopManager.hasRatingSession("RaterUser"));
    }

    @Test
    public void testChatInputCreationSessionFlow() {
        String user = "BuilderAlex";
        String coords = "minecraft:overworld:50,70,50";

        ShopManager.addCreationSession(user, coords, "minecraft:coal", true);
        assertTrue(ShopManager.hasCreationSession(user));

        // Step 1: Set sell price
        ShopManager.ChatInterceptionResult step1 = ShopManager.handleChatInput(user, "25.0");
        assertTrue(step1.intercepted);
        assertTrue(step1.success);
        assertTrue(step1.responseMessage.contains("步驟 2/2"));

        // Step 2: Set buy price
        ShopManager.ChatInterceptionResult step2 = ShopManager.handleChatInput(user, "10.0");
        assertTrue(step2.intercepted);
        assertTrue(step2.success);
        assertFalse(ShopManager.hasCreationSession(user));

        ShopManager.Shop created = ShopManager.getShop(coords);
        assertNotNull(created);
        assertEquals(25.0, created.sellPrice);
        assertEquals(10.0, created.buyPrice);
    }

    @Test
    public void testBulkQuantitySetting() {
        String coords = "minecraft:overworld:10,20,30";
        ShopManager.registerShop("BulkOwner", coords, "minecraft:gold_ingot", 200.0, 0.0, 64);

        assertTrue(ShopManager.setBulkQuantity(coords, 16));
        ShopManager.Shop shop = ShopManager.getShop(coords);
        assertNotNull(shop);
        assertEquals(16, shop.bulkQuantity);

        assertFalse(ShopManager.setBulkQuantity(coords, 0));
        assertFalse(ShopManager.setBulkQuantity(coords, -5));
        assertEquals(16, shop.bulkQuantity);
    }
}
