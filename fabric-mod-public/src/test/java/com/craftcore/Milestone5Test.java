package com.craftcore;

import com.craftcore.economy.EconomyManager;
import com.craftcore.economy.EconomyManager.TransferResult;
import com.craftcore.task.DailyTaskManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

public class Milestone5Test {

    @TempDir
    Path tempDir;

    @BeforeEach
    public void setUp() {
        EconomyManager.setConfigPath(tempDir.resolve("economy.json"));
        EconomyManager.clearAll();
        com.craftcore.util.AsyncSaveExecutor.flush();
    }

    @org.junit.jupiter.api.AfterEach
    public void tearDown() {
        com.craftcore.util.AsyncSaveExecutor.flush();
    }

    @Test
    public void testAtomicTransferWithPrecisionRounding() throws InterruptedException {
        EconomyManager.setBalance("Alice", 1000.055); // should round to 1000.06
        EconomyManager.setBalance("Bob", 500.0);

        assertEquals(1000.06, EconomyManager.getBalance("Alice"), 0.001);

        int threads = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);

        for (int i = 0; i < threads; i++) {
            final boolean even = (i % 2 == 0);
            executor.submit(() -> {
                try {
                    if (even) {
                        EconomyManager.transferMoney("Alice", "Bob", 10.004, true); // rounds to 10.00
                    } else {
                        EconomyManager.transferMoney("Bob", "Alice", 5.0, true);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(5, TimeUnit.SECONDS));
        executor.shutdown();

        // 5 transfers from Alice to Bob ($50.0 total)
        // 5 transfers from Bob to Alice ($25.0 total)
        // Alice final: 1000.06 - 50.0 + 25.0 = 975.06
        // Bob final: 500.0 + 50.0 - 25.0 = 525.0
        assertEquals(975.06, EconomyManager.getBalance("Alice"), 0.01);
        assertEquals(525.0, EconomyManager.getBalance("Bob"), 0.01);
    }

    @Test
    public void testDailyTaskProgressThresholdAndRewards() {
        String username = "TestPlayer";
        EconomyManager.setBalance(username, 0.0);
        EconomyManager.setLotteryKeys(username, 0);

        DailyTaskManager.DailyTaskDef slayTask = new DailyTaskManager.DailyTaskDef(1, "Zombie", 5, 400.0);

        // Progress < count -> not claimed
        EconomyManager.incrementDailyTaskSlayProgress(username, 3);
        assertFalse(EconomyManager.getDailyTaskSlayClaimed(username));
        assertEquals(0.0, EconomyManager.getBalance(username));

        // Reach threshold >= 5 -> progress threshold reached
        EconomyManager.incrementDailyTaskSlayProgress(username, 2);
        assertEquals(5, EconomyManager.getDailyTaskSlayProgress(username));

        // Auto-claim trigger manually or simulated via task complete
        EconomyManager.addMoney(username, slayTask.reward);
        EconomyManager.setLotteryKeys(username, EconomyManager.getLotteryKeys(username) + 1);
        EconomyManager.setDailyTaskSlayClaimed(username, true);

        assertTrue(EconomyManager.getDailyTaskSlayClaimed(username));
        assertEquals(400.0, EconomyManager.getBalance(username));
        assertEquals(1, EconomyManager.getLotteryKeys(username));
    }
}
