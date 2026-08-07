package com.craftcore.luckydraw;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class LuckyDrawManagerTest {

    @BeforeEach
    public void setUp() {
        LuckyDrawManager.load();
    }

    @Test
    public void testKeyManagement() {
        String testUser = "TestUserKeys";
        LuckyDrawManager.setKeys(testUser, 10);
        assertEquals(10, LuckyDrawManager.getKeys(testUser));

        assertTrue(LuckyDrawManager.addKeys(testUser, 5));
        assertEquals(15, LuckyDrawManager.getKeys(testUser));

        assertTrue(LuckyDrawManager.removeKeys(testUser, 3));
        assertEquals(12, LuckyDrawManager.getKeys(testUser));

        assertFalse(LuckyDrawManager.removeKeys(testUser, 100));
        assertEquals(12, LuckyDrawManager.getKeys(testUser));
    }
}
