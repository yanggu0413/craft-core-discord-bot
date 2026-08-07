package com.craftcore;

import com.craftcore.api.RebrandEngine;
import com.craftcore.data.AsyncSaveExecutor;
import com.craftcore.data.JsonDataStore;
import com.craftcore.util.FabricPathUtil;
import net.minecraft.network.chat.Component;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

public class AdversarialM1Test {

    @TempDir
    Path tempDir;

    public static class SampleData {
        public String title;
        public int value;
        public List<String> items;

        public SampleData() {}

        public SampleData(String title, int value, List<String> items) {
            this.title = title;
            this.value = value;
            this.items = items;
        }
    }

    @BeforeEach
    public void setUp() {
        FabricPathUtil.setCustomConfigDir(tempDir);
        RebrandEngine.update("Craft-Core", "[&6%server_name%&r] ");
    }

    // ==========================================
    // Category 1: RebrandEngine Edge Cases
    // ==========================================

    @Test
    public void testRebrandEngineNullInputs() {
        assertDoesNotThrow(() -> {
            assertEquals("", RebrandEngine.rebrand(null));
            assertEquals("", RebrandEngine.translateColorCodes(null));
            Component comp = RebrandEngine.rebrandText(null);
            assertNotNull(comp);
            assertEquals("", comp.getString());

            RebrandEngine.update(null, null);
            assertEquals("Craft-Core", RebrandEngine.getServerName());
        });
    }

    @Test
    public void testRebrandEngineEmptyStrings() {
        assertEquals("", RebrandEngine.rebrand(""));
        assertEquals("", RebrandEngine.translateColorCodes(""));
        Component comp = RebrandEngine.rebrandText("");
        assertNotNull(comp);
        assertEquals("", comp.getString());

        // Empty server name should be ignored (keeps existing), but empty prefix should update
        RebrandEngine.update("", "");
        assertEquals("Craft-Core", RebrandEngine.getServerName());
        assertEquals("", RebrandEngine.getPrefix());
    }

    @Test
    public void testRebrandEngineNestedPlaceholders() {
        // Case 1: server_name set to literal "%server_name%"
        RebrandEngine.update("%server_name%", "[&6%server_name%&r] ");
        assertEquals("%server_name%", RebrandEngine.getServerName());
        assertEquals("Welcome to %server_name%", RebrandEngine.rebrand("Welcome to %server_name%"));

        // Case 2: server_name set to "%prefix%"
        RebrandEngine.update("%prefix%", "[&6%server_name%&r] ");
        String result = RebrandEngine.rebrand("%server_name%");
        assertEquals("[§6%prefix%§r] ", result);

        // Case 3: Multiple placeholders in one template
        RebrandEngine.update("MyServer", "[&e%server_name%&r] ");
        String multi = RebrandEngine.rebrand("%prefix% %server_name% %server_name% %prefix%");
        assertEquals("[§eMyServer§r]  MyServer MyServer [§eMyServer§r] ", multi);
    }

    @Test
    public void testRebrandEngineMultipleColorCodes() {
        // Upper case, lower case, formatting codes
        String input = "&0&1&2&3&4&5&6&7&8&9&a&b&c&d&e&f&k&l&m&n&o&r &A&B&C&D&E&F&K&L&M&N&O&R";
        String expected = "§0§1§2§3§4§5§6§7§8§9§a§b§c§d§e§f§k§l§m§n§o§r §a§b§c§d§e§f§k§l§m§n§o§r";
        assertEquals(expected, RebrandEngine.translateColorCodes(input));

        // Consecutive color codes
        assertEquals("§a§b§cText", RebrandEngine.translateColorCodes("&a&b&cText"));

        // Invalid codes & trailing ampersand
        assertEquals("&z&x§aGood &", RebrandEngine.translateColorCodes("&z&x&aGood &"));

        // Double ampersand
        assertEquals("&§aText", RebrandEngine.translateColorCodes("&&aText"));
    }

    // ==========================================
    // Category 2: JsonDataStore & AsyncSaveExecutor Edge Cases
    // ==========================================

    @Test
    public void testJsonDataStoreMissingRootDataDir() {
        Path rootFile = tempDir.resolve("craft-core").resolve("data").resolve("test_root.json");
        assertFalse(Files.exists(rootFile.getParent()));

        SampleData toSave = new SampleData("RootSaved", 100, List.of("c"));
        JsonDataStore.saveDataSync("test_root.json", toSave);
        assertTrue(Files.exists(rootFile), "Saving a simple file when root data dir is missing should succeed");

        SampleData reloaded = JsonDataStore.loadData("test_root.json", SampleData.class, new SampleData());
        assertEquals("RootSaved", reloaded.title);
    }

    @Test
    public void testJsonDataStoreNestedSubdirectorySaveSuccess() {
        SampleData toSave = new SampleData("NestedSaved", 200, List.of("d"));
        JsonDataStore.saveDataSync("sub/dir/test.json", toSave);

        Path nestedFile = tempDir.resolve("craft-core").resolve("data").resolve("sub").resolve("dir").resolve("test.json");
        assertTrue(Files.exists(nestedFile), "Nested file save succeeds because target parent directories are created");

        SampleData reloaded = JsonDataStore.loadData("sub/dir/test.json", SampleData.class, new SampleData());
        assertEquals("NestedSaved", reloaded.title);
    }

    @Test
    public void testJsonDataStoreCorruptedJsonInputs() throws IOException {
        Path dataDir = tempDir.resolve("craft-core").resolve("data");
        Files.createDirectories(dataDir);

        // 1. Truncated / malformed JSON syntax
        Path corrupted1 = dataDir.resolve("malformed.json");
        Files.writeString(corrupted1, "{\"title\": \"broken\", \"value\": ");

        SampleData default1 = new SampleData("Fallback1", -1, List.of());
        SampleData res1 = JsonDataStore.loadData("malformed.json", SampleData.class, default1);
        assertEquals("Fallback1", res1.title);
        assertFalse(Files.exists(corrupted1), "Malformed file should be backed up and removed from original path");

        // Verify corrupted backup file exists
        boolean backupFound1 = false;
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dataDir, "malformed.json.corrupted_*")) {
            for (Path path : stream) {
                backupFound1 = true;
                break;
            }
        }
        assertTrue(backupFound1, "Backup file for malformed JSON should exist");

        // 2. Type mismatch JSON (e.g. boolean/object where integer expected)
        Path corrupted2 = dataDir.resolve("typemismatch.json");
        Files.writeString(corrupted2, "{\"title\": \"mismatch\", \"value\": {\"nested\": true}}");

        SampleData default2 = new SampleData("Fallback2", -2, List.of());
        SampleData res2 = JsonDataStore.loadData("typemismatch.json", SampleData.class, default2);
        assertEquals("Fallback2", res2.title);
        assertFalse(Files.exists(corrupted2));
    }

    @Test
    public void testJsonDataStoreConcurrentAsyncWrites() throws InterruptedException, IOException {
        int numThreads = 50;
        int writesPerThread = 20;
        ExecutorService threadPool = Executors.newFixedThreadPool(numThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch finishLatch = new CountDownLatch(numThreads);

        AtomicInteger successCounter = new AtomicInteger(0);

        for (int i = 0; i < numThreads; i++) {
            final int threadId = i;
            threadPool.submit(() -> {
                try {
                    startLatch.await();
                    for (int j = 0; j < writesPerThread; j++) {
                        SampleData data = new SampleData("Thread-" + threadId, j, List.of("item-" + j));
                        // Test writing to a single shared file concurrently
                        JsonDataStore.saveDataAsync("concurrent_shared.json", data);
                        // Test writing to thread-specific files concurrently
                        JsonDataStore.saveDataAsync("concurrent_thread_" + threadId + ".json", data);
                        successCounter.incrementAndGet();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    finishLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean completed = finishLatch.await(10, TimeUnit.SECONDS);
        assertTrue(completed, "All worker threads should complete execution within timeout");
        threadPool.shutdown();

        // Flush all pending async save tasks
        AsyncSaveExecutor.flush();

        assertEquals(numThreads * writesPerThread, successCounter.get());

        // Verify shared file exists and is valid readable JSON
        SampleData sharedResult = JsonDataStore.loadData("concurrent_shared.json", SampleData.class, null);
        assertNotNull(sharedResult, "Shared file must be valid JSON and readable");
        assertTrue(sharedResult.title.startsWith("Thread-"));

        // Verify no leftover .tmp files
        Path dataDir = tempDir.resolve("craft-core").resolve("data");
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dataDir, "*.tmp")) {
            int tmpCount = 0;
            for (Path path : stream) {
                tmpCount++;
            }
            assertEquals(0, tmpCount, "No temporary (.tmp) files should remain after AsyncSaveExecutor.flush()");
        }

        // Verify thread-specific files
        for (int i = 0; i < numThreads; i++) {
            SampleData threadResult = JsonDataStore.loadData("concurrent_thread_" + i + ".json", SampleData.class, null);
            assertNotNull(threadResult);
            assertEquals("Thread-" + i, threadResult.title);
            assertEquals(writesPerThread - 1, threadResult.value);
        }
    }

    @Test
    public void testJsonDataStoreCallingThreadSnapshot() {
        SampleData mutableData = new SampleData("Initial", 1, new ArrayList<>(List.of("A")));
        JsonDataStore.saveDataAsync("snapshot_test.json", mutableData);

        // Mutate immediately on calling thread
        mutableData.title = "Mutated";
        mutableData.value = 999;
        mutableData.items.add("B");

        AsyncSaveExecutor.flush();

        SampleData loaded = JsonDataStore.loadData("snapshot_test.json", SampleData.class, null);
        assertNotNull(loaded);
        assertEquals("Initial", loaded.title, "Saved data should reflect state at call time, not post-mutation state");
        assertEquals(1, loaded.value);
        assertEquals(List.of("A"), loaded.items);
    }
}
