package com.craftcore.achievement;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

public class CustomAchievementManagerTest {

    @BeforeEach
    public void setUp() {
        CustomAchievementManager.load();
    }

    @Test
    public void testUnlockedAchievementsNotNull() {
        Set<String> unlocked = CustomAchievementManager.getUnlockedAchievements("NonExistentPlayer");
        assertNotNull(unlocked);
    }
}
