package com.craftcore.protection;

import com.craftcore.protection.lockbox.LockboxManager;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class LockboxCommandTest {



    @Test
    public void testLockboxPasswordHashingAndVerification() {
        String plain = "123456";
        String hashed = LockboxManager.hashPassword(plain);
        assertTrue(hashed.startsWith("$SHA256$"));
        assertTrue(LockboxManager.verifyPassword("123456", hashed));
        assertFalse(LockboxManager.verifyPassword("wrongpass", hashed));
    }

    @Test
    public void testLockboxPermissionGrantAndRevoke() {
        String id = "minecraft:overworld:10,64,10";
        LockboxManager.Lockbox lb = new LockboxManager.Lockbox();
        lb.id = id;
        lb.location = "10,64,10";
        lb.owner = "Player1";
        lb.password = LockboxManager.hashPassword("secret");
        
        LockboxManager.changePassword(id, lb.password);
        LockboxManager.grantPermission(id, "Player2");
        LockboxManager.revokePermission(id, "Player2");
        LockboxManager.removeLockbox(id);
    }
}
