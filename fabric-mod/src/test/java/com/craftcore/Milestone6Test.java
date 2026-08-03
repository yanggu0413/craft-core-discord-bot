package com.craftcore;

import com.craftcore.claim.ClaimManager;
import com.craftcore.claim.ClaimManager.Claim;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class Milestone6Test {

    @BeforeEach
    void setUp() {
        ClaimManager.getClaims().forEach(claim -> ClaimManager.removeClaim(claim.id));
    }

    @Test
    @DisplayName("Claim safety flags initialization test")
    void testClaimSafetyFlags() {
        ClaimManager.Claim claim = new ClaimManager.Claim();
        claim.id = "test-claim-1";
        claim.name = "Test Safe Zone";
        claim.owner = "Alice";
        claim.dimension = "minecraft:overworld";
        claim.corners = new String[]{"0,64,0", "100,64,100"};

        assertTrue(claim.explosion_protection, "Explosion protection should default to true");
        assertFalse(claim.pvp, "PvP should default to false");
        assertFalse(claim.mob_spawn, "Mob spawn should default to false");
        assertTrue(claim.public_entry, "Public entry should default to true");
        assertFalse(claim.public_containers, "Public containers should default to false");
        assertFalse(claim.public_interact, "Public interact should default to false");
    }

    @Test
    @DisplayName("Claim addition and retrieval test")
    void testClaimStorage() {
        ClaimManager.Claim claim = new ClaimManager.Claim();
        claim.id = "test-claim-2";
        claim.name = "Bob Base";
        claim.owner = "Bob";
        claim.dimension = "minecraft:overworld";
        claim.corners = new String[]{"10,64,10", "50,64,50"};
        claim.explosion_protection = true;

        ClaimManager.addClaim(claim);

        ClaimManager.Claim fetched = ClaimManager.getClaim("test-claim-2");
        assertNotNull(fetched, "Claim should be retrievable by ID");
        assertEquals("Bob", fetched.owner);
        assertTrue(fetched.explosion_protection);

        ClaimManager.removeClaim("test-claim-2");
        assertNull(ClaimManager.getClaim("test-claim-2"), "Claim should be deleted after removal");
    }
}
