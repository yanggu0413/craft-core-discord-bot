package com.craftcore;

import com.craftcore.fish.FishingContestManager;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class FishingContestManagerTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @Test
    public void testContestInitialState() {
        assertFalse(FishingContestManager.isActive());
        assertEquals(0, FishingContestManager.getSecondsRemaining());
        assertNotNull(FishingContestManager.getCurrentContestBestMap());
        assertNotNull(FishingContestManager.getCurrentTopFishList());
        assertNotNull(FishingContestManager.getHallOfFame());
    }
}
