package com.craftcore.benchmark;

import com.craftcore.teleport.HomeManager;
import com.craftcore.teleport.WarpManager;
import com.craftcore.util.AsyncSaveExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class AsyncSaveBenchmarkTest {

    @BeforeEach
    void setUp() {
        HomeManager.clearAll();
    }

    @Test
    @DisplayName("Measure Empirical Main Thread Blocking Time for Async Save vs Sync Save")
    void benchmarkAsyncSaveExecutionTime() {
        int iterations = 100;

        // 1. Measure Synchronous Save Main Thread Blocking Time
        long syncStart = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            HomeManager.setHome("testuser", "home_" + i, i * 1.5, 64.0, i * 2.5, 0.0f, 0.0f, "minecraft:overworld");
            // Simulate synchronous disk save call
            HomeManager.save();
        }
        long syncEnd = System.nanoTime();
        long syncTotalTimeNanos = syncEnd - syncStart;
        double syncTotalTimeMs = syncTotalTimeNanos / 1_000_000.0;
        double syncAvgTimeMs = syncTotalTimeMs / iterations;

        // 2. Measure Non-Blocking Async Save Main Thread Time
        long asyncStart = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            HomeManager.setHome("testuser", "async_home_" + i, i * 1.5, 64.0, i * 2.5, 0.0f, 0.0f, "minecraft:overworld");
            // Non-blocking async save call
            AsyncSaveExecutor.submit(HomeManager::save);
        }
        long asyncEnd = System.nanoTime();
        long asyncTotalTimeNanos = asyncEnd - asyncStart;
        double asyncTotalTimeMs = asyncTotalTimeNanos / 1_000_000.0;
        double asyncAvgTimeMs = asyncTotalTimeMs / iterations;

        System.out.println("===========================================================");
        System.out.println("⚡ FABRIC MOD MAIN THREAD BLOCKING EMPIRICAL BENCHMARK");
        System.out.println("===========================================================");
        System.out.println(String.format("* Iterations: %d ops", iterations));
        System.out.println(String.format("* Synchronous File IO Main Thread Total Time: %.3f ms (Avg: %.4f ms / op)", syncTotalTimeMs, syncAvgTimeMs));
        System.out.println(String.format("* Non-Blocking Async Save Main Thread Total Time: %.3f ms (Avg: %.4f ms / op)", asyncTotalTimeMs, asyncAvgTimeMs));
        System.out.println(String.format("* Main Thread Stall Reduction: %.2f%%", (1.0 - (asyncTotalTimeMs / syncTotalTimeMs)) * 100.0));
        System.out.println(String.format("* Latency Speedup: %.1fx Faster!", syncTotalTimeMs / asyncTotalTimeMs));
        System.out.println("===========================================================");

        assertTrue(asyncTotalTimeMs < syncTotalTimeMs, "Async save must be significantly faster on main thread than synchronous save");
    }
}
