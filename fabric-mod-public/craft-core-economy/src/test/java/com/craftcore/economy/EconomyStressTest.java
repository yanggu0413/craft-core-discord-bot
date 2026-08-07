package com.craftcore.economy;

import com.craftcore.check.CheckManager;
import com.craftcore.data.AsyncSaveExecutor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

public class EconomyStressTest {

    @TempDir
    Path tempDir;

    @BeforeEach
    public void setUp() {
        AsyncSaveExecutor.flush();
        EconomyManager.setConfigPath(tempDir.resolve("economy_stress_" + System.nanoTime() + ".json"));
        EconomyManager.clearAll();
        AsyncSaveExecutor.flush();
    }

    @AfterEach
    public void tearDown() {
        AsyncSaveExecutor.flush();
    }

    @Test
    public void testConcurrentTransfersTotalMoneyConservation() throws InterruptedException {
        String[] users = {"UserA", "UserB", "UserC", "UserD", "UserE"};
        double initialBalancePerUser = 10000.0;
        double totalInitialMoney = users.length * initialBalancePerUser;

        for (String user : users) {
            EconomyManager.setBalance(user, initialBalancePerUser);
        }

        assertEquals(totalInitialMoney, EconomyManager.getTotalMoney(), 0.01);

        int numThreads = 10;
        int transfersPerThread = 50;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < numThreads; i++) {
            final int threadIdx = i;
            futures.add(executor.submit(() -> {
                for (int j = 0; j < transfersPerThread; j++) {
                    String sender = users[(threadIdx + j) % users.length];
                    String recipient = users[(threadIdx + j + 1) % users.length];
                    double amount = 10.0 + (j % 5);
                    EconomyManager.transferMoney(sender, recipient, amount, true);
                }
            }));
        }

        executor.shutdown();
        assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS));

        for (Future<?> future : futures) {
            assertDoesNotThrow(() -> future.get());
        }

        // Verify total money in system is conserved (no money created or lost in transfers)
        double totalFinalMoney = EconomyManager.getTotalMoney();
        assertEquals(totalInitialMoney, totalFinalMoney, 0.05, "Total money should be conserved during transfers!");
    }

    @Test
    public void testRoundingAndPrecision() {
        String user = "PreciseUser";
        EconomyManager.setBalance(user, 0.0);

        for (int i = 0; i < 100; i++) {
            EconomyManager.addMoney(user, 0.01);
        }
        assertEquals(1.00, EconomyManager.getBalance(user), 0.001);

        for (int i = 0; i < 50; i++) {
            EconomyManager.removeMoney(user, 0.01);
        }
        assertEquals(0.50, EconomyManager.getBalance(user), 0.001);
    }

    @Test
    public void testInvalidNumberSafeguards() {
        String user = "SafeUser";
        EconomyManager.setBalance(user, 100.0);

        assertFalse(EconomyManager.addMoney(user, -50.0));
        assertFalse(EconomyManager.addMoney(user, Double.NaN));
        assertFalse(EconomyManager.addMoney(user, Double.POSITIVE_INFINITY));

        assertFalse(EconomyManager.removeMoney(user, -20.0));
        assertFalse(EconomyManager.removeMoney(user, Double.NaN));
        assertFalse(EconomyManager.removeMoney(user, Double.POSITIVE_INFINITY));

        assertEquals(100.0, EconomyManager.getBalance(user));
    }

    @Test
    public void testCaseInsensitiveAndDotPrefixMatching() {
        EconomyManager.setBalance("Alex", 500.0);
        assertEquals(500.0, EconomyManager.getBalance(".alex"));
        assertEquals(500.0, EconomyManager.getBalance("ALEX"));

        EconomyManager.addMoney(".ALEX", 100.0);
        assertEquals(600.0, EconomyManager.getBalance("Alex"));

        // Case-insensitive self transfer check
        EconomyManager.TransferResult res = EconomyManager.transferMoney("Alex", ".alex", 50.0, true);
        assertFalse(res.success, "Should disallow self transfer despite dot prefix or casing!");
        assertEquals("不能轉帳給自己。", res.message);
    }

    @Test
    public void testCheckItemDataRecord() {
        CheckManager.CheckData check = new CheckManager.CheckData("CHK9999", 750.25, "System", System.currentTimeMillis());
        assertEquals("CHK9999", check.id());
        assertEquals(750.25, check.amount());
        assertEquals("System", check.issuer());
    }
}
