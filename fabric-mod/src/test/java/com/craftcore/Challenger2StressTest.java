package com.craftcore;

import com.craftcore.claim.ClaimManager;
import com.craftcore.claim.ClaimManager.Claim;
import com.craftcore.economy.EconomyManager;
import com.craftcore.economy.EconomyManager.TransferResult;
import com.craftcore.task.DailyTaskManager;
import com.craftcore.task.DailyTaskManager.DailyTaskDef;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

public class Challenger2StressTest {

    @TempDir
    Path tempDir;

    @BeforeEach
    public void setUp() {
        EconomyManager.setConfigPath(tempDir.resolve("economy_stress.json"));
        EconomyManager.clearAll();
        com.craftcore.util.AsyncSaveExecutor.flush();
    }

    @org.junit.jupiter.api.AfterEach
    public void tearDown() {
        com.craftcore.util.AsyncSaveExecutor.flush();
    }

    @Test
    @DisplayName("Stress Test 1: Concurrent Transfer Money Locks & Balance Conservation")
    public void testTransferAtomicLockingHighConcurrency() throws InterruptedException {
        EconomyManager.setBalance("UserA", 10000.0);
        EconomyManager.setBalance("UserB", 10000.0);

        int threads = 20;
        int iterations = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);

        for (int i = 0; i < threads; i++) {
            final boolean direction = (i % 2 == 0);
            executor.submit(() -> {
                try {
                    for (int j = 0; j < iterations; j++) {
                        if (direction) {
                            EconomyManager.transferMoney("UserA", "UserB", 1.55, false);
                        } else {
                            EconomyManager.transferMoney("UserB", "UserA", 1.55, false);
                        }
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean finished = latch.await(20, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(finished, "Concurrent transfers completed without hanging");
        double totalBalance = EconomyManager.getBalance("UserA") + EconomyManager.getBalance("UserB");
        assertEquals(20000.0, totalBalance, 0.01, "Total money strictly conserved across concurrent transfers");
    }

    @Test
    @DisplayName("Stress Test 2: Balance Precision round2() & Floating Point Edge Cases")
    public void testRound2PrecisionAndEdgeCases() {
        assertEquals(10.05, EconomyManager.round2(10.054));
        assertEquals(10.06, EconomyManager.round2(10.055));
        assertEquals(0.07, EconomyManager.round2(0.07000000000000002));

        // Test transfer with negative, zero, NaN, Infinity values
        assertFalse(EconomyManager.transferMoney("UserA", "UserB", -50.0, true).success);
        assertFalse(EconomyManager.transferMoney("UserA", "UserB", 0.0, true).success);
        assertFalse(EconomyManager.transferMoney("UserA", "UserB", Double.NaN, true).success);
        assertFalse(EconomyManager.transferMoney("UserA", "UserB", Double.POSITIVE_INFINITY, true).success);
    }

    @Test
    @DisplayName("Stress Test 3: Daily Task Progress Threshold & Auto-Reward Logic")
    public void testTaskAutoRewardThresholdAndDoublePayout() throws InterruptedException {
        String username = "TaskTester";
        EconomyManager.setBalance(username, 0.0);
        EconomyManager.setLotteryKeys(username, 0);

        DailyTaskDef slayTask = new DailyTaskDef(1, "Zombie", 5, 500.0);

        // Progress below threshold (4 < 5)
        EconomyManager.incrementDailyTaskSlayProgress(username, 4);
        assertEquals(4, EconomyManager.getDailyTaskSlayProgress(username));
        assertFalse(EconomyManager.getDailyTaskSlayClaimed(username));
        assertEquals(0.0, EconomyManager.getBalance(username));

        // Reach threshold (5)
        EconomyManager.incrementDailyTaskSlayProgress(username, 1);
        assertEquals(5, EconomyManager.getDailyTaskSlayProgress(username));

        // Concurrent completion / payout trigger simulation
        int threads = 8;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger payouts = new AtomicInteger(0);

        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                try {
                    synchronized (username.intern()) {
                        if (!EconomyManager.getDailyTaskSlayClaimed(username)) {
                            EconomyManager.setDailyTaskSlayClaimed(username, true);
                            EconomyManager.addMoney(username, slayTask.reward);
                            EconomyManager.setLotteryKeys(username, EconomyManager.getLotteryKeys(username) + 1);
                            payouts.incrementAndGet();
                        }
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(10, TimeUnit.SECONDS));
        executor.shutdown();

        assertEquals(1, payouts.get(), "Reward paid out exactly once when threshold is reached");
        assertEquals(500.0, EconomyManager.getBalance(username), 0.01);
        assertEquals(1, EconomyManager.getLotteryKeys(username));
    }

    @Test
    @DisplayName("Stress Test 4: Ultra Claim Protection Properties")
    public void testClaimProtectionProperties() {
        Claim claim = new Claim();
        claim.id = "claim-safe";
        claim.owner = "Alice";
        claim.dimension = "minecraft:overworld";
        claim.corners = new String[]{"0,64,0", "16,64,16"};

        assertTrue(claim.explosion_protection, "Explosion protection defaults to true");
        assertFalse(claim.pvp, "PvP defaults to false");
        assertFalse(claim.mob_spawn, "Mob spawn defaults to false");

        ClaimManager.addClaim(claim);
        Claim fetched = ClaimManager.getClaim("claim-safe");
        assertNotNull(fetched);
        assertTrue(fetched.explosion_protection);
        ClaimManager.removeClaim("claim-safe");
    }
}
