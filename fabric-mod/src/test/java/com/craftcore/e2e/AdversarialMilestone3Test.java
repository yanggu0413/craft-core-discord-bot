package com.craftcore.e2e;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.Block;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.commands.CommandSourceStack;

import com.craftcore.shop.ShopManager;
import com.craftcore.economy.EconomyManager;

public class AdversarialMilestone3Test {

    @BeforeAll
    public static void beforeClass() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
            
            net.minecraft.core.HolderLookup.Provider provider = net.minecraft.core.HolderLookup.Provider.create(
                net.minecraft.core.registries.BuiltInRegistries.REGISTRY.stream().map(r -> (net.minecraft.core.HolderLookup.RegistryLookup<?>) r)
            );
            
            net.minecraft.core.component.DataComponentInitializers initializers = new net.minecraft.core.component.DataComponentInitializers();
            java.util.List<net.minecraft.core.component.DataComponentInitializers.PendingComponents<?>> pending = initializers.build(provider);
            for (var p : pending) {
                try {
                    p.apply();
                } catch (Throwable t) {
                    // ignore
                }
            }
        } catch (Throwable t) {
            System.err.println("Could not bootstrap Minecraft registries in AdversarialMilestone3Test: " + t.getMessage());
        }
        try {
            java.lang.reflect.Field field = net.minecraft.server.Bootstrap.class.getDeclaredField("initialized");
            field.setAccessible(true);
            field.set(null, true);
        } catch (Throwable t) {
            // ignore
        }
    }

    @BeforeEach
    public void setUp() {
        EconomyManager.clearAll();
        ShopManager.clearAll();
        com.craftcore.event.ServerLifecycleHandler.serverInstance = null;
    }

    private ServerPlayer createMockPlayer(String name) {
        ServerPlayer mockPlayer = mock(ServerPlayer.class);
        Component mockText = mock(Component.class);
        when(mockText.getString()).thenReturn(name);
        when(mockPlayer.getName()).thenReturn(mockText);

        CommandSourceStack mockSource = mock(CommandSourceStack.class);
        when(mockPlayer.createCommandSourceStack()).thenReturn(mockSource);
        net.minecraft.server.permissions.PermissionSet mockPerms = mock(net.minecraft.server.permissions.PermissionSet.class);
        when(mockSource.permissions()).thenReturn(mockPerms);
        when(mockPerms.hasPermission(any())).thenReturn(false);
        
        return mockPlayer;
    }

    @Test
    public void testBulkShopEnforcementAndTaxBurn() {
        String seller = "Alice";
        String buyer = "Bob";
        String coords = "10,20,30";
        String key = "minecraft:overworld:" + coords;

        // Register shop for Alice: sellPrice = 15.0, buyPrice = 0.0, stock = 100
        assertTrue(ShopManager.registerShop(seller, key, "minecraft:diamond", 15.0, 0.0, 100));
        
        // Configure bulk quantity = 8
        assertTrue(ShopManager.setBulkQuantity(key, 8));
        ShopManager.Shop shop = ShopManager.getShop(key);
        assertNotNull(shop);
        assertEquals(8, shop.bulkQuantity);

        // Bob has $1000
        EconomyManager.setBalance(buyer, 1000.0);
        EconomyManager.setBalance(seller, 0.0);

        // Create mock objects for world and player
        ServerLevel mockWorld = mock(ServerLevel.class);
        ServerPlayer mockBuyer = createMockPlayer(buyer);
        when(mockBuyer.level()).thenReturn(mockWorld);

        // Bob initiates purchase
        ShopManager.BuyingSession session1 = new ShopManager.BuyingSession(key);
        session1.mode = "buy";
        session1.step = 1;
        ShopManager.addBuyingSession(buyer, session1);

        // 1. Try to buy 5 items (not a multiple of 8) -> should be rejected
        ShopManager.ChatInterceptionResult result1 = ShopManager.handleChatInput(buyer, "5", mockBuyer, mockWorld);
        assertTrue(result1.intercepted);
        assertFalse(result1.success);
        assertTrue(result1.responseMessage.contains("multiple of 8"));
        
        // Verify no money was deducted
        assertEquals(1000.0, EconomyManager.getBalance(buyer));
        assertEquals(100, ShopManager.getShop(key).stock);

        // Bob initiates purchase again
        ShopManager.BuyingSession session2 = new ShopManager.BuyingSession(key);
        session2.mode = "buy";
        session2.step = 1;
        ShopManager.addBuyingSession(buyer, session2);

        // 2. Buy 16 items (a multiple of 8) -> should succeed
        // Total cost = 16 * 15 = 240
        // Tax (5%) = 12.0
        // Net revenue = 228.0
        ShopManager.ChatInterceptionResult result2 = ShopManager.handleChatInput(buyer, "16", mockBuyer, mockWorld);
        assertTrue(result2.intercepted);
        assertTrue(result2.success);
        assertTrue(result2.responseMessage.contains("successful"));

        // Verify balances
        // Bob pays $240, remaining balance $760
        assertEquals(760.0, EconomyManager.getBalance(buyer));
        // Alice's shop earns net revenue $228
        shop = ShopManager.getShop(key);
        assertEquals(228.0, shop.revenue);
        assertEquals(84, shop.stock);
    }

    @Test
    public void testTaxBurnPrecision() {
        String seller = "Alice";
        String buyer = "Bob";
        String coords = "11,22,33";
        String key = "minecraft:overworld:" + coords;

        // Buy price: $105.00. Quantity: 1. Total cost: $105.00
        // Tax: $5.25. Net: $99.75
        assertTrue(ShopManager.registerShop(seller, key, "minecraft:emerald", 105.0, 0.0, 10));
        EconomyManager.setBalance(buyer, 200.0);

        ServerLevel mockWorld = mock(ServerLevel.class);
        ServerPlayer mockBuyer = createMockPlayer(buyer);
        when(mockBuyer.level()).thenReturn(mockWorld);

        ShopManager.BuyingSession session = new ShopManager.BuyingSession(key);
        session.mode = "buy";
        session.step = 1;
        ShopManager.addBuyingSession(buyer, session);

        ShopManager.ChatInterceptionResult result = ShopManager.handleChatInput(buyer, "1", mockBuyer, mockWorld);
        assertTrue(result.success);

        // Verify decimal precision
        assertEquals(95.0, EconomyManager.getBalance(buyer)); // 200.00 - 105.00
        assertEquals(99.75, ShopManager.getShop(key).revenue); // 105.00 - 5.25
    }

    @Test
    public void testShopLimitUpgradesAndLimits() {
        String player = "Alice";
        EconomyManager.setBalance(player, 100000.0);

        // Alice starts with 0 upgraded slots
        assertEquals(0, EconomyManager.getUpgradedShopSlots(player));

        // Create 15 shops
        for (int i = 0; i < 15; i++) {
            String coords = "0,0," + i;
            assertTrue(ShopManager.registerShop(player, coords, "minecraft:stone", 1.0, 0));
        }

        // Try to create 16th shop -> should fail due to limit
        assertFalse(ShopManager.registerShop(player, "0,0,15", "minecraft:stone", 1.0, 0));

        // Pay for slot upgrade (slot 16 cost = $10,000)
        assertTrue(EconomyManager.upgradeShopLimit(player));
        assertEquals(1, EconomyManager.getUpgradedShopSlots(player));
        assertEquals(90000.0, EconomyManager.getBalance(player)); // 100000 - 10000

        // Create 16th shop -> should succeed now
        assertTrue(ShopManager.registerShop(player, "0,0,15", "minecraft:stone", 1.0, 0));

        // Try to create 17th shop -> should fail
        assertFalse(ShopManager.registerShop(player, "0,0,16", "minecraft:stone", 1.0, 0));

        // Upgrade again (slot 17 cost = $10,000)
        assertTrue(EconomyManager.upgradeShopLimit(player));
        assertEquals(2, EconomyManager.getUpgradedShopSlots(player));
        assertEquals(80000.0, EconomyManager.getBalance(player));

        // Create 17th shop -> should succeed
        assertTrue(ShopManager.registerShop(player, "0,0,16", "minecraft:stone", 1.0, 0));
    }

    @Test
    public void testUpgradeShopLimitInsufficientFunds() {
        String player = "Alice";
        EconomyManager.setBalance(player, 500.0);

        // Try to upgrade with only $500 (needs $10,000) -> should fail
        assertFalse(EconomyManager.upgradeShopLimit(player));
        assertEquals(0, EconomyManager.getUpgradedShopSlots(player));
        assertEquals(500.0, EconomyManager.getBalance(player));
    }
}
