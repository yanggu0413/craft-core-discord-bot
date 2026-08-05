package com.craftcore;

import com.craftcore.claim.ClaimManager;
import net.minecraft.core.BlockPos;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class ClaimPerformanceTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @Test
    public void testClaimBoundsParsing() {
        ClaimManager.Claim claim = new ClaimManager.Claim();
        claim.id = "test_claim";
        claim.name = "Performance Test Claim";
        claim.owner = "TestUser";
        claim.dimension = "minecraft:overworld";
        claim.corners = new String[] { "0,64,0", "100,64,100" };

        claim.parseBoundsIfNeeded();
        assertTrue(claim.boundsParsed);
        assertEquals(0, claim.minX);
        assertEquals(100, claim.maxX);
        assertEquals(0, claim.minZ);
        assertEquals(100, claim.maxZ);
    }
}
