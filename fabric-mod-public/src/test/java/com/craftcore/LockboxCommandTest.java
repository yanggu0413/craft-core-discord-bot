package com.craftcore;

import com.craftcore.claim.LockboxManager;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class LockboxCommandTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @Test
    public void testLockboxPasswordHashingAndVerification() {
        String plain = "123456";
        String hashed = LockboxManager.hashPassword(plain);
        assertTrue(hashed.startsWith("$SHA256$"));
        assertTrue(LockboxManager.verifyPassword("123456", hashed));
        assertFalse(LockboxManager.verifyPassword("wrongpass", hashed));
    }
}
