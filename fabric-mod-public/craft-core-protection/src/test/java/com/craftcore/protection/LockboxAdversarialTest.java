package com.craftcore.protection;

import com.craftcore.protection.lockbox.LockboxManager;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class LockboxAdversarialTest {

    @Test
    public void testSha256PrefixBypassVulnerability() {
        // Plain password starting with "$SHA256$"
        String vulnerableInput = "$SHA256$mysecretpassword";
        
        // hashPassword checks: if (password.startsWith("$SHA256$")) return password;
        // This causes raw user passwords starting with "$SHA256$" to be stored in PLAIN TEXT without hashing!
        String hashed = LockboxManager.hashPassword(vulnerableInput);
        
        assertNotEquals(vulnerableInput, hashed, "Raw user passwords starting with $SHA256$ must be hashed");
        assertTrue(hashed.startsWith("$SHA256$"));
        assertTrue(LockboxManager.verifyPassword(vulnerableInput, hashed));
    }

    @Test
    public void testNormalPasswordHashingSecurity() {
        String normalPassword = "mysecretpassword";
        String hashed = LockboxManager.hashPassword(normalPassword);
        
        assertTrue(hashed.startsWith("$SHA256$"));
        assertNotEquals(normalPassword, hashed);
        assertTrue(LockboxManager.verifyPassword(normalPassword, hashed));
        assertFalse(LockboxManager.verifyPassword("wrongpassword", hashed));
    }
}
