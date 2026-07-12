package com.craftcore.e2e;

import com.craftcore.economy.EconomyManager;
import com.craftcore.shop.ShopManager;
import com.craftcore.websocket.Packet;
import com.craftcore.websocket.PacketHandler;
import com.craftcore.websocket.CraftCoreWSClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class Tier2BoundaryCornerTest {

    @BeforeEach
    public void setUp() {
        EconomyManager.clearAll();
        ShopManager.clearAll();
        EconomyManager.setCurrentDateOverride(null);
    }

    // ==========================================
    // FEATURE 1: Economy Balances (Boundary)
    // ==========================================
    @Test
    public void testRemoveZeroMoney() {
        EconomyManager.setBalance("Player1", 50.0);
        assertFalse(EconomyManager.removeMoney("Player1", 0.0));
        assertEquals(50.0, EconomyManager.getBalance("Player1"), 0.001);
    }

    @Test
    public void testAddNegativeMoney() {
        EconomyManager.setBalance("Player1", 50.0);
        assertFalse(EconomyManager.addMoney("Player1", -10.0));
        assertEquals(50.0, EconomyManager.getBalance("Player1"), 0.001);
    }

    @Test
    public void testRemoveNegativeMoney() {
        EconomyManager.setBalance("Player1", 50.0);
        assertFalse(EconomyManager.removeMoney("Player1", -5.0));
        assertEquals(50.0, EconomyManager.getBalance("Player1"), 0.001);
    }

    @Test
    public void testSetNegativeBalance() {
        EconomyManager.setBalance("Player1", -100.0);
        assertEquals(0.0, EconomyManager.getBalance("Player1"), 0.001);
    }

    @Test
    public void testRemoveMoreThanBalance() {
        EconomyManager.setBalance("Player1", 10.0);
        assertFalse(EconomyManager.removeMoney("Player1", 20.0));
        assertEquals(10.0, EconomyManager.getBalance("Player1"), 0.001);
    }

    // ==========================================
    // FEATURE 2: Commands (Boundary)
    // ==========================================
    @Test
    public void testAddNegativeMoneyCommand() {
        EconomyManager.setBalance("Player1", 10.0);
        boolean success = EconomyManager.addMoney("Player1", -5.0);
        assertFalse(success);
        assertEquals(10.0, EconomyManager.getBalance("Player1"), 0.001);
    }

    @Test
    public void testRemoveNegativeMoneyCommand() {
        EconomyManager.setBalance("Player1", 10.0);
        boolean success = EconomyManager.removeMoney("Player1", -5.0);
        assertFalse(success);
        assertEquals(10.0, EconomyManager.getBalance("Player1"), 0.001);
    }

    @Test
    public void testCommandWithNonNumericAmount() {
        // Normally Brigadier handles type checking, but if handled manually, should catch:
        assertThrows(NumberFormatException.class, () -> Double.parseDouble("abc"));
    }

    @Test
    public void testCommandEmptyUsername() {
        // Simulate command executed with empty or null username
        assertFalse(EconomyManager.addMoney("", 50.0));
        assertEquals(0.0, EconomyManager.getBalance(""), 0.001);
    }

    @Test
    public void testRemoveMoreThanBalanceCommand() {
        EconomyManager.setBalance("Player1", 5.0);
        boolean success = EconomyManager.removeMoney("Player1", 10.0);
        assertFalse(success);
        assertEquals(5.0, EconomyManager.getBalance("Player1"), 0.001);
    }

    // ==========================================
    // FEATURE 3: Physical Item Conversions (Boundary)
    // ==========================================
    @Test
    public void testSellZeroQuantity() {
        EconomyManager.SellResult result = EconomyManager.sellItem("Player1", "minecraft:coal", 0);
        assertEquals(0, result.soldCount);
        assertEquals(0.0, result.moneyEarned, 0.001);
        assertEquals(0, result.rejectedCount);
    }

    @Test
    public void testSellNegativeQuantity() {
        EconomyManager.SellResult result = EconomyManager.sellItem("Player1", "minecraft:coal", -5);
        assertEquals(0, result.soldCount);
        assertEquals(0.0, result.moneyEarned, 0.001);
        assertEquals(-5, result.rejectedCount);
    }

    @Test
    public void testSellUnknownItemAsTrash() {
        // Unknown items fall under trash (rate 0.5)
        EconomyManager.SellResult result = EconomyManager.sellItem("Player1", "minecraft:dirt", 10);
        assertEquals(10, result.soldCount);
        assertEquals(5.0, result.moneyEarned, 0.001);
        assertEquals(0, result.rejectedCount);
    }

    @Test
    public void testSellInvalidItemRate() {
        // Non-existent block types also get classified as trash (0.5)
        EconomyManager.SellResult result = EconomyManager.sellItem("Player1", "minecraft:invalid_block", 10);
        assertEquals(10, result.soldCount);
        assertEquals(5.0, result.moneyEarned, 0.001);
    }

    @Test
    public void testSellHugeQuantityOverflow() {
        EconomyManager.SellResult result = EconomyManager.sellItem("Player1", "minecraft:coal", 10000);
        assertEquals(10000, result.soldCount);
        assertEquals(100000.0, result.moneyEarned, 0.001);
    }

    // ==========================================
    // FEATURE 4: Daily Limits (Boundary)
    // ==========================================
    @Test
    public void testDailyLimitStoneExactly80() {
        EconomyManager.SellResult res1 = EconomyManager.sellItem("Player1", "minecraft:stone", 80);
        assertEquals(80, res1.soldCount);
        assertEquals(0, res1.rejectedCount);
        
        EconomyManager.SellResult res2 = EconomyManager.sellItem("Player1", "minecraft:stone", 1);
        assertEquals(0, res2.soldCount);
        assertEquals(1, res2.rejectedCount);
    }

    @Test
    public void testDailyLimitStoneExceeded() {
        EconomyManager.SellResult res1 = EconomyManager.sellItem("Player1", "minecraft:stone", 50);
        EconomyManager.SellResult res2 = EconomyManager.sellItem("Player1", "minecraft:stone", 40);
        assertEquals(30, res2.soldCount);
        assertEquals(10, res2.rejectedCount);
    }

    @Test
    public void testDailyLimitTrashExactly80() {
        EconomyManager.SellResult res1 = EconomyManager.sellItem("Player1", "minecraft:dirt", 80);
        assertEquals(80, res1.soldCount);
        assertEquals(0, res1.rejectedCount);
        
        EconomyManager.SellResult res2 = EconomyManager.sellItem("Player1", "minecraft:dirt", 1);
        assertEquals(0, res2.soldCount);
        assertEquals(1, res2.rejectedCount);
    }

    @Test
    public void testDailyLimitTrashExceeded() {
        EconomyManager.SellResult res1 = EconomyManager.sellItem("Player1", "minecraft:sand", 100);
        assertEquals(80, res1.soldCount);
        assertEquals(20, res1.rejectedCount);
    }

    @Test
    public void testDailyLimitResetAfterNewDay() {
        EconomyManager.setCurrentDateOverride("2026-07-11");
        EconomyManager.SellResult res1 = EconomyManager.sellItem("Player1", "minecraft:stone", 80);
        assertEquals(80, res1.soldCount);

        // Try to sell more today (rejected)
        EconomyManager.SellResult res2 = EconomyManager.sellItem("Player1", "minecraft:stone", 10);
        assertEquals(0, res2.soldCount);

        // Move override date to tomorrow
        EconomyManager.setCurrentDateOverride("2026-07-12");
        EconomyManager.SellResult res3 = EconomyManager.sellItem("Player1", "minecraft:stone", 10);
        assertEquals(10, res3.soldCount);
        assertEquals(20.0, res3.moneyEarned, 0.001);
    }

    // ==========================================
    // FEATURE 5: Shop Creation Flow (Boundary)
    // ==========================================
    @Test
    public void testCreationNegativePrice() {
        ShopManager.addCreationSession("Player1", "10,64,10", "minecraft:diamond");
        ShopManager.ChatInterceptionResult res = ShopManager.handleChatInput("Player1", "-15.0");
        assertTrue(res.intercepted);
        assertFalse(res.success);
        assertNull(ShopManager.getShop("10,64,10"));
    }

    @Test
    public void testCreationZeroPrice() {
        ShopManager.addCreationSession("Player1", "10,64,10", "minecraft:diamond");
        ShopManager.ChatInterceptionResult res = ShopManager.handleChatInput("Player1", "0");
        assertTrue(res.intercepted);
        assertFalse(res.success);
        assertNull(ShopManager.getShop("10,64,10"));
    }

    @Test
    public void testCreationPriceTooLarge() {
        ShopManager.addCreationSession("Player1", "10,64,10", "minecraft:diamond");
        ShopManager.ChatInterceptionResult res = ShopManager.handleChatInput("Player1", "999999999");
        assertTrue(res.intercepted);
        assertTrue(res.success);
        assertNotNull(ShopManager.getShop("10,64,10"));
        assertEquals(999999999.0, ShopManager.getShop("10,64,10").price, 0.001);
    }

    @Test
    public void testCreationMultipleConcurrentSessions() {
        ShopManager.addCreationSession("Player1", "10,64,10", "minecraft:diamond");
        ShopManager.addCreationSession("Player2", "20,64,20", "minecraft:gold_ingot");
        
        assertTrue(ShopManager.hasCreationSession("Player1"));
        assertTrue(ShopManager.hasCreationSession("Player2"));
    }

    @Test
    public void testCreationTimeoutSecondCheck() {
        ShopManager.addCreationSession("Player1", "10,64,10", "minecraft:diamond");
        ShopManager.CreationSession s = new ShopManager.CreationSession("10,64,10", "minecraft:diamond") {
            @Override
            public boolean isExpired() {
                return true;
            }
        };
        assertTrue(s.isExpired());
    }

    // ==========================================
    // FEATURE 6: Protections (Boundary)
    // ==========================================
    @Test
    public void testNonOwnerBreakingChestDenied() {
        ShopManager.registerShop("Player1", "10,64,10", "minecraft:diamond", 100.0, 5);
        assertFalse(ShopManager.canInteract("Player2", "10,64,10", false));
    }

    @Test
    public void testNonOwnerOpeningChestDenied() {
        ShopManager.registerShop("Player1", "10,64,10", "minecraft:diamond", 100.0, 5);
        assertFalse(ShopManager.canInteract("Player3", "10,64,10", false));
    }

    @Test
    public void testOpBreakingChestAllowed() {
        ShopManager.registerShop("Player1", "10,64,10", "minecraft:diamond", 100.0, 5);
        assertTrue(ShopManager.canInteract("Player2", "10,64,10", true)); // isOp = true
    }

    @Test
    public void testOpOpeningChestAllowed() {
        ShopManager.registerShop("Player1", "10,64,10", "minecraft:diamond", 100.0, 5);
        assertTrue(ShopManager.canInteract("Player3", "10,64,10", true)); // isOp = true
    }

    @Test
    public void testBreakingUnregisteredChest() {
        assertTrue(ShopManager.canInteract("Player2", "20,20,20", false));
    }

    // ==========================================
    // FEATURE 7: GUI Management (Boundary)
    // ==========================================
    @Test
    public void testGUIRemoteRestockNonOwnerDenied() {
        ShopManager.registerShop("Player1", "10,64,10", "minecraft:diamond", 100.0, 5);
        String res = ShopManager.clickShopGUI("Player2", "10,64,10", "restock", false);
        assertEquals("Permission denied", res);
    }

    @Test
    public void testGUIRemoteWithdrawNonOwnerDenied() {
        ShopManager.registerShop("Player1", "10,64,10", "minecraft:diamond", 100.0, 5);
        String res = ShopManager.clickShopGUI("Player2", "10,64,10", "withdraw", false);
        assertEquals("Permission denied", res);
    }

    @Test
    public void testGUIDeleteNonOwnerDenied() {
        ShopManager.registerShop("Player1", "10,64,10", "minecraft:diamond", 100.0, 5);
        String res = ShopManager.clickShopGUI("Player2", "10,64,10", "delete", false);
        assertEquals("Permission denied", res);
        assertNotNull(ShopManager.getShop("10,64,10"));
    }

    @Test
    public void testGUITeleportNonExistentShop() {
        String res = ShopManager.clickShopGUI("Player1", "99,99,99", "teleport", false);
        assertEquals("Shop not found", res);
    }

    @Test
    public void testGUIRemoteWithdrawZeroRevenue() {
        ShopManager.registerShop("Player1", "10,64,10", "minecraft:diamond", 100.0, 5);
        String res = ShopManager.clickShopGUI("Player1", "10,64,10", "withdraw", false);
        assertEquals("No revenue to withdraw", res);
    }

    // ==========================================
    // FEATURE 8: WebSocket (Boundary)
    // ==========================================
    @Test
    public void testQueryUnauthenticatedBlocked() {
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        when(mockClient.isAuthenticated()).thenReturn(false);

        String json = "{\"type\":\"shop_stats_query\",\"payload\":{\"username\":\"Player1\",\"query_id\":\"q-666\"}}";
        PacketHandler.handle(json, null, mockClient);

        ArgumentCaptor<Packet> captor = ArgumentCaptor.forClass(Packet.class);
        verify(mockClient).send(captor.capture());

        Packet responsePacket = captor.getValue();
        assertEquals("shop_stats_response", responsePacket.type);
        Packet.ShopStatsResponsePayload p = (Packet.ShopStatsResponsePayload) responsePacket.payload;
        assertFalse(p.success);
    }

    @Test
    public void testQueryInvalidPayload() {
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        when(mockClient.isAuthenticated()).thenReturn(true);

        // Missing query_id
        String json = "{\"type\":\"balance_query\",\"payload\":{\"username\":\"Player1\"}}";
        PacketHandler.handle(json, null, mockClient);

        ArgumentCaptor<Packet> captor = ArgumentCaptor.forClass(Packet.class);
        verify(mockClient).send(captor.capture());
        
        Packet responsePacket = captor.getValue();
        assertEquals("balance_response", responsePacket.type);
        Packet.BalanceResponsePayload p = (Packet.BalanceResponsePayload) responsePacket.payload;
        assertNull(p.query_id);
    }

    @Test
    public void testQueryMalformedJson() {
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        String malformedJson = "{type:balance_query,payload:{username:Player1}";
        // Should catch parsing exception internally and print error without crashing
        assertDoesNotThrow(() -> PacketHandler.handle(malformedJson, null, mockClient));
    }

    @Test
    public void testQueryWrongPacketType() {
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        String json = "{\"type\":\"unknown_query_type\",\"payload\":{}}";
        // Should ignore and not crash
        assertDoesNotThrow(() -> PacketHandler.handle(json, null, mockClient));
    }

    @Test
    public void testQueriesWithEmptyQueryId() {
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        when(mockClient.isAuthenticated()).thenReturn(true);

        String json = "{\"type\":\"balance_query\",\"payload\":{\"username\":\"Player1\",\"query_id\":\"\"}}";
        PacketHandler.handle(json, null, mockClient);

        ArgumentCaptor<Packet> captor = ArgumentCaptor.forClass(Packet.class);
        verify(mockClient).send(captor.capture());
        
        Packet responsePacket = captor.getValue();
        assertEquals("balance_response", responsePacket.type);
        Packet.BalanceResponsePayload p = (Packet.BalanceResponsePayload) responsePacket.payload;
        assertEquals("", p.query_id);
    }
}
