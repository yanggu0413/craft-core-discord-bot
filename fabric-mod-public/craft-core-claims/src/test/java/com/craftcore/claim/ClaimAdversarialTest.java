package com.craftcore.claim;

import net.minecraft.core.BlockPos;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

public class ClaimAdversarialTest {

    @BeforeEach
    public void setUp() {
        ClaimManager.getClaims().forEach(c -> ClaimManager.removeClaim(c.id));
    }

    @Test
    public void testUnparsedBoundsIntersectionBypass() {
        // Create an existing claim with invalid/unparsed corners
        ClaimManager.Claim existing = new ClaimManager.Claim();
        existing.id = UUID.randomUUID().toString();
        existing.name = "Corrupted Claim";
        existing.owner = "Victim";
        existing.dimension = "minecraft:overworld";
        existing.corners = new String[]{"invalid", "data"}; // Will fail to parse bounds

        ClaimManager.addClaim(existing);

        // Try to check intersection with a new claim overlapping the area (0,0 to 10,10)
        BlockPos a = new BlockPos(0, 64, 0);
        BlockPos b = new BlockPos(10, 64, 10);

        // Because existing.boundsParsed is false, doesIntersect returns TRUE (intersection detected!), preventing claim overlap!
        boolean intersects = ClaimManager.doesIntersect(a, b, "minecraft:overworld", existing);
        assertTrue(intersects, "Unparsed claim bounds must trigger intersection detection to prevent overlap");
    }

    @Test
    public void testValidBoundsIntersectionDetection() {
        ClaimManager.Claim existing = new ClaimManager.Claim();
        existing.id = UUID.randomUUID().toString();
        existing.name = "Valid Claim";
        existing.owner = "Victim";
        existing.dimension = "minecraft:overworld";
        existing.corners = new String[]{"0,64,0", "16,64,16"};

        ClaimManager.addClaim(existing);

        BlockPos a = new BlockPos(10, 64, 10);
        BlockPos b = new BlockPos(20, 64, 20);

        boolean intersects = ClaimManager.doesIntersect(a, b, "minecraft:overworld", existing);
        assertTrue(intersects, "Valid overlapping claim bounds correctly trigger intersection detection");
    }

    @Test
    public void testCalculateChunksCoordinateMath() {
        // Chunk boundary spanning positive and negative coordinates
        BlockPos a = new BlockPos(-5, 64, -5);
        BlockPos b = new BlockPos(5, 64, 5);

        // -5 >> 4 is -1 (Chunk -1), 5 >> 4 is 0 (Chunk 0).
        // Total chunk width in X = (-0 - (-1) + 1) = 2. Total chunk height in Z = 2. Chunks = 4.
        int chunks = ClaimManager.calculateChunks(a, b);
        assertEquals(4, chunks, "Spanning origin (0,0) across negative and positive blocks should calculate 4 chunks");
    }
}
