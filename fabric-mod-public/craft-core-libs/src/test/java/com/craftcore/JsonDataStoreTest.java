package com.craftcore;

import com.craftcore.data.AsyncSaveExecutor;
import com.craftcore.data.JsonDataStore;
import com.craftcore.util.FabricPathUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

public class JsonDataStoreTest {

    @TempDir
    Path tempDir;

    public static class TestData {
        public String name;
        public int amount;

        public TestData() {}

        public TestData(String name, int amount) {
            this.name = name;
            this.amount = amount;
        }
    }

    @BeforeEach
    public void setUp() {
        FabricPathUtil.setCustomConfigDir(tempDir);
    }

    @Test
    public void testLoadNonExistentFileReturnsDefault() {
        TestData defaultValue = new TestData("Default", 100);
        TestData loaded = JsonDataStore.loadData("non_existent.json", TestData.class, defaultValue);
        assertEquals(defaultValue, loaded);
        assertEquals("Default", loaded.name);
    }

    @Test
    public void testSaveDataSyncAndLoad() {
        TestData original = new TestData("SyncTest", 500);
        JsonDataStore.saveDataSync("test_sync.json", original);

        Path dataFile = tempDir.resolve("craft-core").resolve("data").resolve("test_sync.json");
        assertTrue(Files.exists(dataFile));

        TestData loaded = JsonDataStore.loadData("test_sync.json", TestData.class, new TestData());
        assertNotNull(loaded);
        assertEquals("SyncTest", loaded.name);
        assertEquals(500, loaded.amount);
    }

    @Test
    public void testSaveDataAsyncAndLoad() {
        TestData original = new TestData("AsyncTest", 999);
        JsonDataStore.saveDataAsync("test_async.json", original);

        // Ensure async write finishes
        AsyncSaveExecutor.flush();

        Path dataFile = tempDir.resolve("craft-core").resolve("data").resolve("test_async.json");
        assertTrue(Files.exists(dataFile));

        TestData loaded = JsonDataStore.loadData("test_async.json", TestData.class, new TestData());
        assertNotNull(loaded);
        assertEquals("AsyncTest", loaded.name);
        assertEquals(999, loaded.amount);
    }

    @Test
    public void testNestedDirectoryCreation() {
        TestData original = new TestData("NestedTest", 777);
        JsonDataStore.saveDataSync("sub/dir/nested.json", original);

        Path nestedFile = tempDir.resolve("craft-core").resolve("data").resolve("sub").resolve("dir").resolve("nested.json");
        assertTrue(Files.exists(nestedFile), "File sub/dir/nested.json should exist");
        assertTrue(Files.isDirectory(nestedFile.getParent()), "Parent directories sub/dir must be created");

        TestData loaded = JsonDataStore.loadData("sub/dir/nested.json", TestData.class, new TestData());
        assertNotNull(loaded);
        assertEquals("NestedTest", loaded.name);
        assertEquals(777, loaded.amount);
    }

    @Test
    public void testCorruptedFileBackupAndFallback() throws IOException {
        Path dataDir = tempDir.resolve("craft-core").resolve("data");
        Files.createDirectories(dataDir);
        Path corruptedFile = dataDir.resolve("corrupted_test.json");
        Files.writeString(corruptedFile, "{ INVALID JSON DATA ###");

        TestData defaultValue = new TestData("Fallback", 0);
        TestData loaded = JsonDataStore.loadData("corrupted_test.json", TestData.class, defaultValue);

        assertEquals("Fallback", loaded.name);
        assertFalse(Files.exists(corruptedFile), "Original corrupted file should have been moved/backed up");

        // Verify corrupted backup file exists
        boolean backupFound = false;
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dataDir, "corrupted_test.json.corrupted_*")) {
            for (Path path : stream) {
                backupFound = true;
                break;
            }
        }
        assertTrue(backupFound, "Backup file with .corrupted_ timestamp should exist");
    }
}
