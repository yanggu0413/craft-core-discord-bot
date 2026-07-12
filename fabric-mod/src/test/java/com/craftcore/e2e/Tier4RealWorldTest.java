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

public class Tier4RealWorldTest {

    @BeforeEach
    public void setUp() {
        EconomyManager.clearAll();
        ShopManager.clearAll();
        EconomyManager.setCurrentDateOverride(null);
    }

    @Test
    public void testOnboardingAndPhysicalSelling() {
        // Player joins server and sells resources
        String username = "Alice";

        // Sell 10 coal (10 * 10 = 100), 10 stone (10 * 2 = 20), 10 dirt (10 * 0.5 = 5)
        EconomyManager.SellResult r1 = EconomyManager.sellItem(username, "minecraft:coal", 10);
        EconomyManager.SellResult r2 = EconomyManager.sellItem(username, "minecraft:stone", 10);
        EconomyManager.SellResult r3 = EconomyManager.sellItem(username, "minecraft:dirt", 10);

        assertEquals(10, r1.soldCount);
        assertEquals(10, r2.soldCount);
        assertEquals(10, r3.soldCount);
        
        double expectedBalance = 125.0;
        assertEquals(expectedBalance, EconomyManager.getBalance(username), 0.001);

        // Verify WebSocket Balance query
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        when(mockClient.isAuthenticated()).thenReturn(true);

        String json = "{\"type\":\"balance_query\",\"payload\":{\"username\":\"Alice\",\"query_id\":\"q-onboard\"}}";
        PacketHandler.handle(json, null, mockClient);

        ArgumentCaptor<Packet> captor = ArgumentCaptor.forClass(Packet.class);
        verify(mockClient).send(captor.capture());

        Packet.BalanceResponsePayload p = (Packet.BalanceResponsePayload) captor.getValue().payload;
        assertEquals("q-onboard", p.query_id);
        assertEquals(expectedBalance, p.balance, 0.001);
    }

    @Test
    public void testShopSetupRestockAndQuery() {
        String owner = "Bob";
        String coords = "12,65,-30";
        
        // Hold Diamond -> Left-click chest -> Enter creation state
        ShopManager.addCreationSession(owner, coords, "minecraft:diamond");
        
        // Enter price 250 in chat
        ShopManager.ChatInterceptionResult res = ShopManager.handleChatInput(owner, "250");
        assertTrue(res.success);
        
        // Restock shop remotely with 5 diamonds
        assertTrue(ShopManager.remoteRestock(owner, coords, 5));

        // Query shop stats via WebSocket
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        when(mockClient.isAuthenticated()).thenReturn(true);

        String json = "{\"type\":\"shop_stats_query\",\"payload\":{\"username\":\"Bob\",\"query_id\":\"q-shop\"}}";
        PacketHandler.handle(json, null, mockClient);

        ArgumentCaptor<Packet> captor = ArgumentCaptor.forClass(Packet.class);
        verify(mockClient).send(captor.capture());

        Packet.ShopStatsResponsePayload p = (Packet.ShopStatsResponsePayload) captor.getValue().payload;
        assertEquals("q-shop", p.query_id);
        assertEquals(1, p.shops.size());
        assertEquals("12,65,-30", p.shops.get(0).location);
        assertEquals(5, p.shops.get(0).stock);
        assertEquals(250.0, p.shops.get(0).buy_price, 0.001);
    }

    @Test
    public void testDailyTradingAndLimitHit() {
        String username = "Charlie";
        EconomyManager.setCurrentDateOverride("2026-07-11");

        // Sell 100 Stones (80 accepted, 20 rejected)
        EconomyManager.SellResult r1 = EconomyManager.sellItem(username, "minecraft:stone", 100);
        assertEquals(80, r1.soldCount);
        assertEquals(20, r1.rejectedCount);

        // Sell 90 Dirt (Trash - 80 accepted, 10 rejected)
        EconomyManager.SellResult r2 = EconomyManager.sellItem(username, "minecraft:dirt", 90);
        assertEquals(80, r2.soldCount);
        assertEquals(10, r2.rejectedCount);

        // Try to sell more stone/trash -> should be fully rejected
        EconomyManager.SellResult r3 = EconomyManager.sellItem(username, "minecraft:stone", 5);
        assertEquals(0, r3.soldCount);
        assertEquals(5, r3.rejectedCount);

        // Move to next day
        EconomyManager.setCurrentDateOverride("2026-07-12");

        // Should be able to sell again
        EconomyManager.SellResult r4 = EconomyManager.sellItem(username, "minecraft:stone", 10);
        assertEquals(10, r4.soldCount);
        assertEquals(0, r4.rejectedCount);
    }

    @Test
    public void testChestShopTransaction() {
        String owner = "Bob";
        String buyer = "Charlie";
        String coords = "12,65,-30";

        // Setup shop: Price = 100, Stock = 5
        ShopManager.registerShop(owner, coords, "minecraft:diamond", 100.0, 5);

        // Buyer has 300 money
        EconomyManager.setBalance(buyer, 300.0);

        // Buyer left-clicks chest shop to enter buying state
        ShopManager.addBuyingSession(buyer, coords);

        // Types "3" in chat to purchase
        ShopManager.ChatInterceptionResult res = ShopManager.handleChatInput(buyer, "3");
        assertTrue(res.success);

        // Verify balances, stock, and revenue
        assertEquals(0.0, EconomyManager.getBalance(buyer), 0.001);
        assertEquals(0.0, EconomyManager.getBalance(owner), 0.001);
        assertEquals(2, ShopManager.getShop(coords).stock);
        assertEquals(285.0, ShopManager.getShop(coords).revenue, 0.001);

        // Owner withdraws revenue
        ShopManager.clickShopGUI(owner, coords, "withdraw", false);
        assertEquals(285.0, EconomyManager.getBalance(owner), 0.001);
    }

    @Test
    public void testShopTheftPreventionAndCleanDeletion() {
        String owner = "Bob";
        String thief = "Thief";
        String coords = "12,65,-30";

        // Owner sets up shop
        ShopManager.registerShop(owner, coords, "minecraft:diamond", 100.0, 5);

        // Thief attempts to interact / break the chest
        assertFalse(ShopManager.canInteract(thief, coords, false));

        // Thief attempts to manage the shop via GUI
        String restockRes = ShopManager.clickShopGUI(thief, coords, "restock", false);
        assertEquals("Permission denied", restockRes);

        // Owner breaks the chest (unregisters shop)
        assertTrue(ShopManager.unregisterShop(coords));
        assertNull(ShopManager.getShop(coords));

        // Now thief can interact since it's just a normal chest
        assertTrue(ShopManager.canInteract(thief, coords, false));
    }
}
