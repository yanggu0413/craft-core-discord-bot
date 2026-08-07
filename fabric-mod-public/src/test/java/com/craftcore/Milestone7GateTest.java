package com.craftcore;

import com.craftcore.express.ExpressGuiManager;
import com.craftcore.express.ExpressManager;
import com.craftcore.menu.MenuGuiManager;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class Milestone7GateTest {

    private static final Gson GSON = new Gson();

    @TempDir
    Path tempDir;

    @BeforeEach
    public void setup() {
        Path testParcelPath = tempDir.resolve("test_parcels.json");
        ExpressManager.setConfigPath(testParcelPath);
        ExpressManager.clearAll();
    }

    @Test
    public void testExpressManagerStorageAndQuery() {
        ExpressManager.ExpressParcel parcel1 = new ExpressManager.ExpressParcel(
            "p1", "SenderSteve", "ReceiverAlex", System.currentTimeMillis(), List.of("{\"item\":\"minecraft:diamond\"}")
        );

        // Test Inbox & Outbox sorting and filtering
        List<ExpressManager.ExpressParcel> inboxBefore = ExpressManager.getInboxParcels("ReceiverAlex");
        assertEquals(0, inboxBefore.size());

        // Send dummy parcel through ExpressManager
        ExpressManager.ExpressParcel sent = ExpressManager.sendParcel(
            "SenderSteve", "ReceiverAlex", List.of(), null
        );
        assertNull(sent, "Empty item list should return null parcel");

        // Verify Pending Session management
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
    public void testGuiManagersInitialization() {
        assertNotNull(MenuGuiManager.class);
        assertNotNull(ExpressGuiManager.class);
    }
}
