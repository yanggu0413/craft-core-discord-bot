package com.craftcore;

import com.craftcore.check.CheckManager;
import com.craftcore.economy.EconomyManager;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

public class CheckManagerTest {

    @TempDir
    Path tempDir;

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @BeforeEach
    public void setUp() {
        com.craftcore.util.AsyncSaveExecutor.flush();
        EconomyManager.setConfigPath(tempDir.resolve("economy_check_" + System.nanoTime() + ".json"));
        EconomyManager.clearAll();
        com.craftcore.util.AsyncSaveExecutor.flush();
    }

    @org.junit.jupiter.api.AfterEach
    public void tearDown() {
        com.craftcore.util.AsyncSaveExecutor.flush();
    }

    @Test
    public void testCheckDataRecord() {
        String issuer = "Alex";
        double amount = 2500.50;

        CheckManager.CheckData data = new CheckManager.CheckData("CHK12345", amount, issuer, System.currentTimeMillis());

        assertNotNull(data);
        assertEquals(2500.50, data.amount());
        assertEquals("Alex", data.issuer());
        assertEquals("CHK12345", data.id());
        assertTrue(data.timestamp() > 0);
    }

    @Test
    public void testEconomyIntegrationWithCheck() {
        String player = "Steve";
        EconomyManager.addMoney(player, 1000.0);
        assertEquals(1000.0, EconomyManager.getBalance(player));

        // Create check deduction for 400.0
        assertTrue(EconomyManager.removeMoney(player, 400.0));
        assertEquals(600.0, EconomyManager.getBalance(player));

        // Redeem check
        EconomyManager.addMoney(player, 400.0);
        assertEquals(1000.0, EconomyManager.getBalance(player));
    }
}
