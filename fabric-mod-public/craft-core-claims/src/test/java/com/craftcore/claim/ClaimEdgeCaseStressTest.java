package com.craftcore.claim;

import net.minecraft.core.BlockPos;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

public class ClaimEdgeCaseStressTest {

    @BeforeEach
    public void setUp() {
        ClaimManager.getClaims().forEach(c -> ClaimManager.removeClaim(c.id));
    }

    @Test
    public void testNegativeCoordinatesIntersection() {
        ClaimManager.Claim existing = new ClaimManager.Claim();
        existing.id = UUID.randomUUID().toString();
        existing.name = "Negative Claim";
        existing.owner = "Player1";
        existing.dimension = "minecraft:overworld";
        existing.corners = new String[]{"-50,64,-50", "-10,64,-10"};

        ClaimManager.addClaim(existing);

        // Test overlap in negative space
        BlockPos a = new BlockPos(-20, 64, -20);
        BlockPos b = new BlockPos(0, 64, 0);

        boolean intersects = ClaimManager.doesIntersect(a, b, "minecraft:overworld", existing);
        assertTrue(intersects, "Overlapping claims in negative coordinates must return true");

        // Test non-overlapping claim in negative space
        BlockPos c = new BlockPos(-100, 64, -100);
        BlockPos d = new BlockPos(-60, 64, -60);
        boolean intersectsNonOverlapping = ClaimManager.doesIntersect(c, d, "minecraft:overworld", existing);
        assertFalse(intersectsNonOverlapping, "Non-overlapping claims in negative space must return false");
    }

    @Test
    public void testDimensionCaseInsensitivity() {
        ClaimManager.Claim existing = new ClaimManager.Claim();
        existing.id = UUID.randomUUID().toString();
        existing.name = "Mixed Case Dim Claim";
        existing.owner = "Player1";
        existing.dimension = "Minecraft:Overworld";
        existing.corners = new String[]{"0,64,0", "10,64,10"};

        ClaimManager.addClaim(existing);

        BlockPos a = new BlockPos(5, 64, 5);
        BlockPos b = new BlockPos(15, 64, 15);

        boolean intersects = ClaimManager.doesIntersect(a, b, "minecraft:overworld", existing);
        assertTrue(intersects, "Dimension match should be case-insensitive");
    }

    @Test
    public void testDifferentDimensionNoIntersection() {
        ClaimManager.Claim existing = new ClaimManager.Claim();
        existing.id = UUID.randomUUID().toString();
        existing.name = "Nether Claim";
        existing.owner = "Player1";
        existing.dimension = "minecraft:the_nether";
        existing.corners = new String[]{"0,64,0", "10,64,10"};

        ClaimManager.addClaim(existing);

        BlockPos a = new BlockPos(5, 64, 5);
        BlockPos b = new BlockPos(15, 64, 15);

        boolean intersects = ClaimManager.doesIntersect(a, b, "minecraft:overworld", existing);
        assertFalse(intersects, "Claims in different dimensions must not intersect");
    }

    @Test
    public void testUnparsedBoundsInDifferentDimension() {
        ClaimManager.Claim existing = new ClaimManager.Claim();
        existing.id = UUID.randomUUID().toString();
        existing.name = "Corrupt Nether Claim";
        existing.owner = "Player1";
        existing.dimension = "minecraft:the_nether";
        existing.corners = new String[]{"invalid", "corners"};

        ClaimManager.addClaim(existing);

        BlockPos a = new BlockPos(5, 64, 5);
        BlockPos b = new BlockPos(15, 64, 15);

        boolean intersects = ClaimManager.doesIntersect(a, b, "minecraft:overworld", existing);
        assertFalse(intersects, "Unparsed claim in a different dimension must not block claims in overworld");
    }
}
