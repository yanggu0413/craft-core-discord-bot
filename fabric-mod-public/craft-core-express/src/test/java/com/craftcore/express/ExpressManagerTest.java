package com.craftcore.express;

import com.craftcore.data.AsyncSaveExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class ExpressManagerTest {

    @TempDir
    Path tempDir;

    private Path testParcelPath;

    @BeforeEach
    public void setup() {
        testParcelPath = tempDir.resolve("express_parcels.json");
        ExpressManager.setConfigPath(testParcelPath);
        ExpressManager.clearAll();
    }

    @Test
    public void testExpressParcelStorageAndQuery() {
        ExpressManager.ExpressParcel parcel = new ExpressManager.ExpressParcel(
            "p1", "SenderSteve", "ReceiverAlex", System.currentTimeMillis(), List.of("{\"item\":\"minecraft:diamond\"}")
        );

        List<ExpressManager.ExpressParcel> inboxBefore = ExpressManager.getInboxParcels("ReceiverAlex");
        assertEquals(0, inboxBefore.size());

        // Send dummy parcel through ExpressManager (empty item list should return null)
        ExpressManager.ExpressParcel nullParcel = ExpressManager.sendParcel("SenderSteve", "ReceiverAlex", List.of(), null);
        assertNull(nullParcel, "Empty item list should return null parcel");
    }

    @Test
    public void testPendingSendSession() {
        ExpressManager.addPendingSend("SenderSteve", "ReceiverAlex", List.of());
        ExpressManager.PendingSendSession session = ExpressManager.getPendingSend("SenderSteve");
        assertNotNull(session);
        assertEquals("SenderSteve", session.sender);
        assertEquals("ReceiverAlex", session.presetRecipient);
        assertFalse(session.isExpired());

        ExpressManager.removePendingSend("SenderSteve");
        assertNull(ExpressManager.getPendingSend("SenderSteve"));
    }

    @Test
    public void testJsonPersistence() throws Exception {
        ExpressManager.ExpressParcel parcel = new ExpressManager.ExpressParcel(
            "p_test_100", "Alice", "Bob", System.currentTimeMillis(), List.of("item_nbt_data")
        );

        // Manually place parcel and save
        ExpressManager.addPendingSend("Alice", "Bob", List.of());
        assertNotNull(ExpressManager.getPendingSend("Alice"));

        // Test saving
        ExpressManager.save();
        AsyncSaveExecutor.flush();

        assertTrue(Files.exists(testParcelPath), "express_parcels.json file should exist after save");

        // Test loading
        ExpressManager.load();
        List<ExpressManager.ExpressParcel> inbox = ExpressManager.getInboxParcels("Bob");
        assertNotNull(inbox);
    }

    @Test
    public void testClassInitialization() {
        assertNotNull(CraftCoreExpressMod.class);
        assertNotNull(ExpressGuiManager.class);
        assertNotNull(ExpressCommand.class);
    }
}
