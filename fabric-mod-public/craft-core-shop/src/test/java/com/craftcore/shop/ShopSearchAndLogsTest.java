package com.craftcore.shop;

import com.craftcore.data.AsyncSaveExecutor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class ShopSearchAndLogsTest {

    @TempDir
    Path tempDir;

    @BeforeEach
    public void setUp() {
        AsyncSaveExecutor.flush();
        ShopManager.setConfigPath(tempDir.resolve("shops_" + System.nanoTime() + ".json"));
        ShopManager.clearAll();
        AsyncSaveExecutor.flush();
    }

    @AfterEach
    public void tearDown() {
        AsyncSaveExecutor.flush();
    }

    @Test
    public void testTranslationManagerMatchesRegistryId() {
        assertTrue(TranslationManager.matches(null, "minecraft:diamond", "diamond"));
        assertTrue(TranslationManager.matches(null, "minecraft:diamond", "minecraft:diamond"));
        assertTrue(TranslationManager.matches(null, "diamond", "dia"));
        assertFalse(TranslationManager.matches(null, "minecraft:diamond", "coal"));
    }

    @Test
    public void testTranslationManagerMatchesChineseTranslations() {
        assertTrue(TranslationManager.matches(null, "minecraft:coal", "煤炭"));
        assertTrue(TranslationManager.matches(null, "minecraft:coal", "coal"));
    }

    @Test
    public void testShopSearchSorting() {
        List<ShopManager.Shop> shops = new ArrayList<>();
        ShopManager.Shop s1 = new ShopManager.Shop("player1", "10,64,20", "minecraft:diamond", 10.0, 5.0, 10);
        ShopManager.Shop s2 = new ShopManager.Shop("player2", "10,64,21", "minecraft:diamond", 5.0, 2.0, 10);
        ShopManager.Shop s3 = new ShopManager.Shop("player3", "10,64,22", "minecraft:diamond", 15.0, 10);
        s3.sellPrice = 0.0;
        s3.price = 15.0;
        s3.buyPrice = 3.0;
        ShopManager.Shop s4 = new ShopManager.Shop("player4", "10,64,23", "minecraft:diamond", 0.0, 10.0, 10);
        ShopManager.Shop s5 = new ShopManager.Shop("player5", "10,64,24", "minecraft:diamond", 0.0, 8.0, 10);

        shops.add(s1);
        shops.add(s4);
        shops.add(s2);
        shops.add(s5);
        shops.add(s3);

        shops.sort((o1, o2) -> {
            double p1 = o1.sellPrice > 0 ? o1.sellPrice : o1.price;
            double p2 = o2.sellPrice > 0 ? o2.sellPrice : o2.price;
            boolean has1 = p1 > 0;
            boolean has2 = p2 > 0;
            if (has1 && has2) {
                if (p1 != p2) {
                    return Double.compare(p1, p2);
                }
            } else if (has1) {
                return -1;
            } else if (has2) {
                return 1;
            }
            return Double.compare(o2.buyPrice, o1.buyPrice);
        });

        assertEquals("player2", shops.get(0).player);
        assertEquals("player1", shops.get(1).player);
        assertEquals("player3", shops.get(2).player);
        assertEquals("player4", shops.get(3).player);
        assertEquals("player5", shops.get(4).player);
    }

    @Test
    public void testTransactionLogCapacityLimiting() {
        ShopManager.setConfigPath(tempDir.resolve("shops_capacity.json"));
        ShopManager.clearAll();
        String merchant = "merchant1";
        for (int i = 1; i <= 25; i++) {
            ShopManager.TransactionLog log = new ShopManager.TransactionLog(
                "buy", "buyer" + i, merchant, "minecraft:diamond", i, i * 100.0, System.currentTimeMillis() + i
            );
            ShopManager.addTransactionLog(log);
        }

        List<ShopManager.TransactionLog> logs = ShopManager.getMerchantLogs(merchant);
        assertEquals(20, logs.size());

        assertEquals("buyer6", logs.get(0).buyer);
        assertEquals("buyer25", logs.get(19).buyer);
    }

    @Test
    public void testTransactionLogSerializationDeserialization() {
        String merchant = "merchant_serial";
        ShopManager.TransactionLog log1 = new ShopManager.TransactionLog(
            "buy", "buyerA", merchant, "minecraft:diamond", 5, 500.0, 1000L
        );
        ShopManager.TransactionLog log2 = new ShopManager.TransactionLog(
            "sell", "buyerB", merchant, "minecraft:iron_ingot", 10, 200.0, 2000L
        );

        Path originalPath = tempDir.resolve("shops.json");
        ShopManager.setConfigPath(originalPath);

        ShopManager.addTransactionLog(log1);
        ShopManager.addTransactionLog(log2);

        ShopManager.saveLogs();
        AsyncSaveExecutor.flush();

        Path subDir = tempDir.resolve("temp_subdir");
        try {
            Files.createDirectories(subDir);
        } catch (Throwable ignored) {}
        ShopManager.setConfigPath(subDir.resolve("shops.json"));
        assertEquals(0, ShopManager.getMerchantLogs(merchant).size());

        ShopManager.setConfigPath(originalPath);

        List<ShopManager.TransactionLog> logs = ShopManager.getMerchantLogs(merchant);
        assertEquals(2, logs.size());

        ShopManager.TransactionLog loadedLog1 = logs.get(0);
        assertEquals("buy", loadedLog1.type);
        assertEquals("buyerA", loadedLog1.buyer);
        assertEquals("minecraft:diamond", loadedLog1.itemId);
        assertEquals(5, loadedLog1.quantity);
        assertEquals(500.0, loadedLog1.totalPrice);
        assertEquals(1000L, loadedLog1.timestamp);

        ShopManager.TransactionLog loadedLog2 = logs.get(1);
        assertEquals("sell", loadedLog2.type);
        assertEquals("buyerB", loadedLog2.buyer);
        assertEquals("minecraft:iron_ingot", loadedLog2.itemId);
        assertEquals(10, loadedLog2.quantity);
        assertEquals(200.0, loadedLog2.totalPrice);
        assertEquals(2000L, loadedLog2.timestamp);
    }
}
