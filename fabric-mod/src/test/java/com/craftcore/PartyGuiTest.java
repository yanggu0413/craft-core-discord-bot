package com.craftcore;

import com.craftcore.fish.FishingContestManager;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class PartyGuiTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @Test
    public void testPartyMatchesMapNotNull() {
        assertNotNull(FishingContestManager.getFishingDimensionKey());
    }
}
