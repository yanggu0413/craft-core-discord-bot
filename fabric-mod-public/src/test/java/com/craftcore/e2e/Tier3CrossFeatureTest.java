package com.craftcore.e2e;

import com.craftcore.economy.EconomyManager;
import com.craftcore.shop.ShopManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

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
    public void testSellItemLimitHitsWithdrawal() {
        // 1. Sell stones up to daily limit (80 stones -> 160.0 money)
        EconomyManager.SellResult sell1 = EconomyManager.sellItem("Player1", "minecraft:stone", 100);
        assertEquals(80, sell1.soldCount);
        assertEquals(160.0, sell1.moneyEarned, 0.001);

        // 2. Verify balance
        assertEquals(160.0, EconomyManager.getBalance("Player1"), 0.001);
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
