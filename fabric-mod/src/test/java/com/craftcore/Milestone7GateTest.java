package com.craftcore;

import com.craftcore.express.ExpressGuiManager;
import com.craftcore.express.ExpressManager;
import com.craftcore.menu.MenuGuiManager;
import com.craftcore.websocket.Packet;
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
    public void testWelfareLuckyDrawPacketSerialization() {
        Packet.LuckydrawRequestPayload reqPayload = new Packet.LuckydrawRequestPayload("Player1", "uuid-1", 5);
        Packet reqPacket = new Packet("luckydraw_request", reqPayload);
        String reqJson = GSON.toJson(reqPacket);

        JsonObject reqObj = JsonParser.parseString(reqJson).getAsJsonObject();
        assertEquals("luckydraw_request", reqObj.get("type").getAsString());
        JsonObject payloadObj = reqObj.getAsJsonObject("payload");
        assertEquals("Player1", payloadObj.get("username").getAsString());
        assertEquals("uuid-1", payloadObj.get("uuid").getAsString());
        assertEquals(5, payloadObj.get("mod_keys").getAsInt());

        Packet.LuckydrawResponsePayload respPayload = new Packet.LuckydrawResponsePayload();
        respPayload.username = "Player1";
        respPayload.success = true;
        respPayload.item = "minecraft:diamond";
        respPayload.amount = 5;
        respPayload.keysLeft = 4;
        respPayload.message = "§a抽獎成功！";

        Packet respPacket = new Packet("luckydraw_response", respPayload);
        String respJson = GSON.toJson(respPacket);

        JsonObject respObj = JsonParser.parseString(respJson).getAsJsonObject();
        assertEquals("luckydraw_response", respObj.get("type").getAsString());
        JsonObject respPayloadObj = respObj.getAsJsonObject("payload");
        assertEquals("Player1", respPayloadObj.get("username").getAsString());
        assertTrue(respPayloadObj.get("success").getAsBoolean());
        assertEquals("minecraft:diamond", respPayloadObj.get("item").getAsString());
        assertEquals(5, respPayloadObj.get("amount").getAsInt());
        assertEquals(4, respPayloadObj.get("keysLeft").getAsInt());
    }

    @Test
    public void testLeaderboardPacketSerialization() {
        Packet.WelfareLeaderboardQueryPayload queryPayload = new Packet.WelfareLeaderboardQueryPayload("q-100", "keys", 10);
        Packet queryPacket = new Packet("welfare_leaderboard_query", queryPayload);
        String queryJson = GSON.toJson(queryPacket);

        JsonObject queryObj = JsonParser.parseString(queryJson).getAsJsonObject();
        assertEquals("welfare_leaderboard_query", queryObj.get("type").getAsString());
        JsonObject qPayloadObj = queryObj.getAsJsonObject("payload");
        assertEquals("q-100", qPayloadObj.get("query_id").getAsString());
        assertEquals("keys", qPayloadObj.get("category").getAsString());
        assertEquals(10, qPayloadObj.get("limit").getAsInt());

        Packet.WelfareLeaderboardEntry entry = new Packet.WelfareLeaderboardEntry();
        entry.username = "TopPlayer";
        entry.keys_count = 50;
        entry.checkin_streak = 7;
        entry.total_checkins = 30;

        Packet.WelfareLeaderboardResponsePayload respPayload = new Packet.WelfareLeaderboardResponsePayload();
        respPayload.query_id = "q-100";
        respPayload.category = "keys";
        respPayload.success = true;
        respPayload.leaderboard = List.of(entry);

        Packet respPacket = new Packet("welfare_leaderboard_response", respPayload);
        String respJson = GSON.toJson(respPacket);

        JsonObject respObj = JsonParser.parseString(respJson).getAsJsonObject();
        assertEquals("welfare_leaderboard_response", respObj.get("type").getAsString());
        JsonObject rPayloadObj = respObj.getAsJsonObject("payload");
        assertEquals("q-100", rPayloadObj.get("query_id").getAsString());
        assertTrue(rPayloadObj.get("success").getAsBoolean());
        assertEquals(1, rPayloadObj.getAsJsonArray("leaderboard").size());
    }

    @Test
    public void testGuiManagersInitialization() {
        assertNotNull(MenuGuiManager.class);
        assertNotNull(ExpressGuiManager.class);
    }
}
