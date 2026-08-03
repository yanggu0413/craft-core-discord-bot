package com.craftcore.util;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * 高效非同步存檔執行器 (Async Save Executor)
 * 將全服 JSON 檔案寫入任務移出 Minecraft 主執行緒，實現 0ms 主執行緒停頓。
 */
public class AsyncSaveExecutor {
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "CraftCore-AsyncSaveWorker");
        t.setDaemon(true);
        return t;
    });

    public static void submit(Runnable task) {
        if (task != null) {
            EXECUTOR.submit(task);
        }
    }

    public static void flush() {
        try {
            EXECUTOR.submit(() -> {}).get(5, TimeUnit.SECONDS);
        } catch (Throwable ignored) {}
    }
}
