package com.craftcore;

import com.craftcore.shop.ShopManager;
import com.craftcore.shop.TranslationManager;
import net.minecraft.world.item.Item;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.ArrayList;
import java.util.List;

public class SearchAndLogTest {

    @BeforeEach
    public void setUp() {
        ShopManager.clearAll();
    }

    public static class DummyItem {
        public String getDescriptionId() {
            return "item.minecraft.diamond";
        }
    }

    @Test
    public void testTranslationMatchesChineseAndEnglish() {
        DummyItem mockItem = new DummyItem();

        // 1. Chinese (Traditional) match
        assertTrue(TranslationManager.matches(mockItem, "minecraft:diamond", "鑽石"));

        // 2. Chinese (Simplified) match
        assertTrue(TranslationManager.matches(mockItem, "minecraft:diamond", "钻石"));

        // 3. English key/registry match
        assertTrue(TranslationManager.matches(mockItem, "minecraft:diamond", "diamond"));
        assertTrue(TranslationManager.matches(mockItem, "minecraft:diamond", "dia"));

        // 4. Case insensitivity
        assertTrue(TranslationManager.matches(mockItem, "minecraft:diamond", "DiAmOnD"));

        // 5. No match
        assertFalse(TranslationManager.matches(mockItem, "minecraft:diamond", "coal"));
    }

    @Test
    public void testLoggingCapacityLimit() {
        String merchant = "Steve";
        
        for (int i = 0; i < 25; i++) {
            ShopManager.TransactionLog log = new ShopManager.TransactionLog(
                "buy", "Buyer" + i, merchant, "minecraft:diamond", 1, 10.0, System.currentTimeMillis()
            );
            ShopManager.addTransactionLog(log);
        }

        List<ShopManager.TransactionLog> logs = ShopManager.getMerchantLogs(merchant);
        assertEquals(20, logs.size());
        assertEquals("Buyer5", logs.get(0).buyer);
        assertEquals("Buyer24", logs.get(19).buyer);
    }

    @Test
    public void testSearchSorting() {
        List<ShopManager.Shop> shops = new ArrayList<>();
        
        ShopManager.Shop s1 = new ShopManager.Shop("Owner1", "10,64,10", "minecraft:diamond", 0.0, 100.0, 10);
        ShopManager.Shop s2 = new ShopManager.Shop("Owner2", "20,64,20", "minecraft:diamond", 500.0, 0.0, 10);
        ShopManager.Shop s3 = new ShopManager.Shop("Owner3", "30,64,30", "minecraft:diamond", 300.0, 0.0, 10);
        ShopManager.Shop s4 = new ShopManager.Shop("Owner4", "40,64,40", "minecraft:diamond", 0.0, 200.0, 10);

        shops.add(s1);
        shops.add(s2);
        shops.add(s3);
        shops.add(s4);

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

        assertEquals(s3, shops.get(0));
        assertEquals(s2, shops.get(1));
        assertEquals(s4, shops.get(2));
        assertEquals(s1, shops.get(3));
    }
}
