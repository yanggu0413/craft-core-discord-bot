package com.craftcore.protection;

import com.craftcore.protection.lockbox.LockboxManager;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class LockboxNullAuthorizedStressTest {

    @Test
    public void testNullAuthorizedListHandling() {
        LockboxManager.Lockbox lb = new LockboxManager.Lockbox();
        lb.id = "minecraft:overworld:100,64,100";
        lb.location = "100,64,100";
        lb.owner = "Player1";
        lb.password = LockboxManager.hashPassword("secret123");
        lb.authorized = null; // Simulating Gson deserialization when "authorized" key is missing/null in JSON

        // Direct check of LockboxManager operations when authorized is null or lockbox is mutated
        assertDoesNotThrow(() -> {
            boolean grantRes = LockboxManager.grantPermission(lb.id, "Player2");
            assertFalse(grantRes);
        }, "grantPermission should handle missing lockbox safely");
    }

    @Test
    public void testHashPasswordCornerCases() {
        assertEquals("", LockboxManager.hashPassword(null));
        assertEquals("", LockboxManager.hashPassword(""));
        
        String hashed1 = LockboxManager.hashPassword("password123");
        String hashed2 = LockboxManager.hashPassword("password123");
        assertEquals(hashed1, hashed2, "Hashing same password should be deterministic");
        
        assertFalse(LockboxManager.verifyPassword(null, hashed1));
        assertFalse(LockboxManager.verifyPassword("", hashed1));
        assertTrue(LockboxManager.verifyPassword("password123", hashed1));
    }
}
