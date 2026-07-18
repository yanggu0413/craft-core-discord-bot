package com.craftcore;

import com.craftcore.economy.EconomyManager;
import com.craftcore.economy.EconomyManager.TransferResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

public class PaySecurityTest {

    @TempDir
    Path tempDir;

    @BeforeEach
    public void setUp() {
        // Set temp file to isolate tests from production database
        EconomyManager.setConfigPath(tempDir.resolve("economy.json"));
        EconomyManager.clearAll();
    }

    @Test
    public void testSuccessfulOnlineTransfer() {
        EconomyManager.setBalance("Alice", 1000.0);
        EconomyManager.setBalance("Bob", 200.0);

        TransferResult result = EconomyManager.transferMoney("Alice", "Bob", 300.0, true);
        assertTrue(result.success);
        assertEquals(700.0, EconomyManager.getBalance("Alice"), 0.01);
        assertEquals(500.0, EconomyManager.getBalance("Bob"), 0.01);
    }

    @Test
    public void testNegativeOrZeroTransfer() {
        EconomyManager.setBalance("Alice", 1000.0);
        EconomyManager.setBalance("Bob", 200.0);

        TransferResult result1 = EconomyManager.transferMoney("Alice", "Bob", -100.0, true);
        assertFalse(result1.success);
        assertEquals(1000.0, EconomyManager.getBalance("Alice"), 0.01);

        TransferResult result2 = EconomyManager.transferMoney("Alice", "Bob", 0.0, true);
        assertFalse(result2.success);
        assertEquals(1000.0, EconomyManager.getBalance("Alice"), 0.01);
    }

    @Test
    public void testNaNOrInfinityTransfer() {
        EconomyManager.setBalance("Alice", 1000.0);
        EconomyManager.setBalance("Bob", 200.0);

        TransferResult resultNaN = EconomyManager.transferMoney("Alice", "Bob", Double.NaN, true);
        assertFalse(resultNaN.success);
        assertEquals(1000.0, EconomyManager.getBalance("Alice"), 0.01);

        TransferResult resultInf = EconomyManager.transferMoney("Alice", "Bob", Double.POSITIVE_INFINITY, true);
        assertFalse(resultInf.success);
        assertEquals(1000.0, EconomyManager.getBalance("Alice"), 0.01);
    }

    @Test
    public void testSelfTransfer() {
        EconomyManager.setBalance("Alice", 1000.0);

        TransferResult result = EconomyManager.transferMoney("Alice", "Alice", 100.0, true);
        assertFalse(result.success);
        assertEquals(1000.0, EconomyManager.getBalance("Alice"), 0.01);
    }

    @Test
    public void testOfflineTransferToExistingPlayer() {
        EconomyManager.setBalance("Alice", 1000.0);
        EconomyManager.setBalance("Bob", 200.0); // Existing player

        TransferResult result = EconomyManager.transferMoney("Alice", "bob", 300.0, false); // case insensitive test
        assertTrue(result.success);
        assertEquals(700.0, EconomyManager.getBalance("Alice"), 0.01);
        assertEquals(500.0, EconomyManager.getBalance("Bob"), 0.01);
    }

    @Test
    public void testOfflineTransferToNonExistentPlayer() {
        EconomyManager.setBalance("Alice", 1000.0);

        TransferResult result = EconomyManager.transferMoney("Alice", "Charlie", 300.0, false);
        assertFalse(result.success); // Charlie does not exist in db
        assertEquals(1000.0, EconomyManager.getBalance("Alice"), 0.01);
    }

    @Test
    public void testDailyLimitRestriction() {
        EconomyManager.setBalance("Alice", 100000.0);
        EconomyManager.setBalance("Bob", 200.0);

        // 1. Transfer 40,000 (Within limit of 50,000)
        TransferResult r1 = EconomyManager.transferMoney("Alice", "Bob", 40000.0, true);
        assertTrue(r1.success);

        // 2. Transfer another 11,000 (Exceeds daily limit)
        TransferResult r2 = EconomyManager.transferMoney("Alice", "Bob", 11000.0, true);
        assertFalse(r2.success);
        assertTrue(r2.message.contains("超出每日轉帳限制"));

        // Remaining balance checks
        assertEquals(60000.0, EconomyManager.getBalance("Alice"), 0.01);
        assertEquals(40200.0, EconomyManager.getBalance("Bob"), 0.01);
    }

    @Test
    public void testNameMigrationByUUID() {
        // Register initial data
        EconomyManager.setBalance("Alice", 1000.0);
        EconomyManager.handlePlayerLogin("Alice", "uuid-111");

        // Simulate name change to "AliceNew" but same UUID
        EconomyManager.handlePlayerLogin("AliceNew", "uuid-111");

        // Verify balance migrated to "AliceNew" and old entry is removed
        assertEquals(1000.0, EconomyManager.getBalance("AliceNew"), 0.01);
        assertEquals(0.0, EconomyManager.getBalance("Alice"), 0.01); // fallback getOrCreate creates new 0 balance entry
    }
}
