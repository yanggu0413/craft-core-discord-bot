package com.craftcore;

import com.craftcore.title.TitleManager;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class CustomAchievementManagerTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @Test
    public void testTitleUnlocksForAdvancements() {
        String testUser = "Steve_Achiever";

        // Unlock titles associated with craftcore advancements
        TitleManager.unlockTitle(testUser, "§c[重鎚大師]");
        TitleManager.unlockTitle(testUser, "§e[挖掘機]");
        TitleManager.unlockTitle(testUser, "§a[繁殖高手]");
        TitleManager.unlockTitle(testUser, "§d[蜘蛛人]");
        TitleManager.unlockTitle(testUser, "§6[老玩家]");
        TitleManager.unlockTitle(testUser, "§b[一隻鳥]");
        TitleManager.unlockTitle(testUser, "§8[低頭族]");
        TitleManager.unlockTitle(testUser, "§e[黑貓宅急便]");
        TitleManager.unlockTitle(testUser, "§e[我愛簽到]");
        TitleManager.unlockTitle(testUser, "§6[百萬富翁]");

        var unlocked = TitleManager.getUnlockedTitles(testUser);
        assertTrue(unlocked.contains("§c[重鎚大師]"));
        assertTrue(unlocked.contains("§e[挖掘機]"));
        assertTrue(unlocked.contains("§a[繁殖高手]"));
        assertTrue(unlocked.contains("§d[蜘蛛人]"));
        assertTrue(unlocked.contains("§6[老玩家]"));
        assertTrue(unlocked.contains("§b[一隻鳥]"));
        assertTrue(unlocked.contains("§8[低頭族]"));
        assertTrue(unlocked.contains("§e[黑貓宅急便]"));
        assertTrue(unlocked.contains("§e[我愛簽到]"));
        assertTrue(unlocked.contains("§6[百萬富翁]"));
    }
}
