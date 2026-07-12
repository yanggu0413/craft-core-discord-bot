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

public class Tier3CrossFeatureTest {

    @BeforeEach
    public void setUp() {
        EconomyManager.clearAll();
        ShopManager.clearAll();
        EconomyManager.setCurrentDateOverride(null);
    }

    @Test
    public void testCreateShopAndBuyAndVerifyBalance() {
        // 1. Create shop
        ShopManager.registerShop("Owner", "10,64,10", "minecraft:diamond", 100.0, 10);
        
        // 2. Fund buyer
        EconomyManager.setBalance("Buyer", 500.0);
        
        // 3. Buyer buys 3 diamonds
        ShopManager.addBuyingSession("Buyer", "10,64,10");
        ShopManager.ChatInterceptionResult buyResult = ShopManager.handleChatInput("Buyer", "3");
        
        assertTrue(buyResult.intercepted);
        assertTrue(buyResult.success);
        
        // 4. Verify balances
        assertEquals(200.0, EconomyManager.getBalance("Buyer"), 0.001);
        assertEquals(0.0, EconomyManager.getBalance("Owner"), 0.001);
        assertEquals(7, ShopManager.getShop("10,64,10").stock);
        assertEquals(285.0, ShopManager.getShop("10,64,10").revenue, 0.001);

        // 5. Withdraw revenue
        ShopManager.clickShopGUI("Owner", "10,64,10", "withdraw", false);
        assertEquals(285.0, EconomyManager.getBalance("Owner"), 0.001);
    }

    @Test
    public void testSellItemsToEarnMoneyAndCreateShop() {
        // 1. Sell coal to economy to earn money
        EconomyManager.SellResult sellResult = EconomyManager.sellItem("Player1", "minecraft:coal", 20);
        assertEquals(200.0, sellResult.moneyEarned, 0.001);
        assertEquals(200.0, EconomyManager.getBalance("Player1"), 0.001);

        // 2. Start creation session and register a shop with that price
        ShopManager.addCreationSession("Player1", "10,64,10", "minecraft:coal");
        ShopManager.ChatInterceptionResult createResult = ShopManager.handleChatInput("Player1", "10.0");
        assertTrue(createResult.success);
        
        assertNotNull(ShopManager.getShop("10,64,10"));
        assertEquals(10.0, ShopManager.getShop("10,64,10").price, 0.001);
    }

    @Test
    public void testAddMoneyCommandAndBuy() {
        // 1. Add money via command-like method
        EconomyManager.addMoney("Player1", 100.0);
        
        // 2. Register shop
        ShopManager.registerShop("Owner", "15,64,15", "minecraft:iron_ingot", 20.0, 5);
        
        // 3. Buy
        ShopManager.addBuyingSession("Player1", "15,64,15");
        ShopManager.ChatInterceptionResult buyResult = ShopManager.handleChatInput("Player1", "2");
        assertTrue(buyResult.success);
        
        assertEquals(60.0, EconomyManager.getBalance("Player1"), 0.001);
        assertEquals(0.0, EconomyManager.getBalance("Owner"), 0.001);
        ShopManager.clickShopGUI("Owner", "15,64,15", "withdraw", false);
        assertEquals(38.0, EconomyManager.getBalance("Owner"), 0.001);
    }

    @Test
    public void testWebSocketQueryReflectsShopBuyStock() {
        // 1. Create shop and buy
        ShopManager.registerShop("Owner", "10,64,10", "minecraft:diamond", 100.0, 10);
        EconomyManager.setBalance("Buyer", 500.0);
        
        ShopManager.addBuyingSession("Buyer", "10,64,10");
        ShopManager.handleChatInput("Buyer", "2"); // Revenue = 200, Stock = 8

        // 2. Query stats via WebSocket
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        when(mockClient.isAuthenticated()).thenReturn(true);

        String json = "{\"type\":\"shop_stats_query\",\"payload\":{\"username\":\"Owner\",\"query_id\":\"q-999\"}}";
        PacketHandler.handle(json, null, mockClient);

        ArgumentCaptor<Packet> captor = ArgumentCaptor.forClass(Packet.class);
        verify(mockClient).send(captor.capture());

        Packet responsePacket = captor.getValue();
        assertEquals("shop_stats_response", responsePacket.type);
        Packet.ShopStatsResponsePayload p = (Packet.ShopStatsResponsePayload) responsePacket.payload;
        
        assertEquals(1, p.shops.size());
        assertEquals("10,64,10", p.shops.get(0).location);
        assertEquals(8, p.shops.get(0).stock);
        assertEquals(190.0, p.shops.get(0).escrow_revenue, 0.001);
    }

    @Test
    public void testWebSocketQueryReflectsAddMoneyCommand() {
        // 1. Add money command
        EconomyManager.addMoney("Player1", 120.0);

        // 2. Query balance via WebSocket
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        when(mockClient.isAuthenticated()).thenReturn(true);

        String json = "{\"type\":\"balance_query\",\"payload\":{\"username\":\"Player1\",\"query_id\":\"q-888\"}}";
        PacketHandler.handle(json, null, mockClient);

        ArgumentCaptor<Packet> captor = ArgumentCaptor.forClass(Packet.class);
        verify(mockClient).send(captor.capture());

        Packet response = captor.getValue();
        Packet.BalanceResponsePayload payload = (Packet.BalanceResponsePayload) response.payload;
        assertEquals(120.0, payload.balance, 0.001);
    }

    @Test
    public void testSellItemLimitHitsWithdrawal() {
        // 1. Sell stones up to daily limit (80 stones -> 160.0 money)
        EconomyManager.SellResult sell1 = EconomyManager.sellItem("Player1", "minecraft:stone", 100);
        assertEquals(80, sell1.soldCount);
        assertEquals(160.0, sell1.moneyEarned, 0.001);

        // 2. Verify balance
        assertEquals(160.0, EconomyManager.getBalance("Player1"), 0.001);
    }

    @Test
    public void testCreateShopWithdrawRevenueAndCheckWebSocket() {
        // 1. Setup shop & purchase
        ShopManager.registerShop("Owner", "10,64,10", "minecraft:diamond", 100.0, 5);
        EconomyManager.setBalance("Buyer", 300.0);
        
        ShopManager.addBuyingSession("Buyer", "10,64,10");
        ShopManager.handleChatInput("Buyer", "2");

        // 2. Withdraw revenue
        String res = ShopManager.clickShopGUI("Owner", "10,64,10", "withdraw", false);
        assertEquals("Withdrew 190.0", res);

        // 3. WebSocket query
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        when(mockClient.isAuthenticated()).thenReturn(true);

        String json = "{\"type\":\"balance_query\",\"payload\":{\"username\":\"Owner\",\"query_id\":\"q-777\"}}";
        PacketHandler.handle(json, null, mockClient);

        ArgumentCaptor<Packet> captor = ArgumentCaptor.forClass(Packet.class);
        verify(mockClient).send(captor.capture());

        Packet response = captor.getValue();
        Packet.BalanceResponsePayload payload = (Packet.BalanceResponsePayload) response.payload;
        assertEquals(190.0, payload.balance, 0.001);
    }

    @Test
    public void testDeleteShopWithdrawRemainingAndVerify() {
        // 1. Setup shop & purchase
        ShopManager.registerShop("Owner", "10,64,10", "minecraft:diamond", 100.0, 5);
        EconomyManager.setBalance("Buyer", 300.0);
        
        ShopManager.addBuyingSession("Buyer", "10,64,10");
        ShopManager.handleChatInput("Buyer", "1"); // 100 revenue

        // 2. Delete shop
        String delRes = ShopManager.clickShopGUI("Owner", "10,64,10", "delete", false);
        assertEquals("Shop deleted", delRes);
        assertNull(ShopManager.getShop("10,64,10"));
    }
}
