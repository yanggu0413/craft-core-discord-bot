package com.craftcore.data;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class AsyncSaveExecutor {
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "CraftCore-AsyncSaveWorker");
        t.setDaemon(true);
        return t;
    });

    public static void submit(Runnable task) {
        if (task != null && !EXECUTOR.isShutdown()) {
            EXECUTOR.submit(task);
        }
    }

    public static void flush() {
        if (EXECUTOR.isShutdown()) {
            return;
        }
        try {
            EXECUTOR.submit(() -> {}).get(5, TimeUnit.SECONDS);
        } catch (Throwable ignored) {
        }
    }

    public static void shutdown() {
        if (EXECUTOR.isShutdown()) {
            return;
        }
        EXECUTOR.shutdown();
        try {
            if (!EXECUTOR.awaitTermination(5, TimeUnit.SECONDS)) {
                EXECUTOR.shutdownNow();
            }
        } catch (InterruptedException e) {
            EXECUTOR.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
