package com.craftcore;

import com.craftcore.mining.MiningDimensionManager;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class MiningDimensionTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @Test
    public void testMiningDimensionKeyRegistration() {
        assertNotNull(MiningDimensionManager.getMiningDimensionKey());
        assertTrue(MiningDimensionManager.getMiningDimensionKey().toString().contains("craftcore:mining"));
    }
}
