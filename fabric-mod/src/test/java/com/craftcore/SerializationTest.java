package com.craftcore;

import com.craftcore.websocket.Packet;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class SerializationTest {
    private static final Gson GSON = new Gson();

    @Test
    public void testAuthPayloadSerialization() {
        Packet.AuthPayload payload = new Packet.AuthPayload("my_secret_token");
        Packet packet = new Packet("auth", payload);
        String json = GSON.toJson(packet);

        JsonObject obj = JsonParser.parseString(json).getAsJsonObject();
        assertEquals("auth", obj.get("type").getAsString());
        JsonObject payloadObj = obj.getAsJsonObject("payload");
        assertEquals("my_secret_token", payloadObj.get("secret").getAsString());
    }

    @Test
    public void testChatPayloadSerialization() {
        Packet.ChatPayload payload = new Packet.ChatPayload("Steve", "uuid-1234", "Hello World!");
        Packet packet = new Packet("chat", payload);
        String json = GSON.toJson(packet);

        JsonObject obj = JsonParser.parseString(json).getAsJsonObject();
        assertEquals("chat", obj.get("type").getAsString());
        JsonObject payloadObj = obj.getAsJsonObject("payload");
        assertEquals("Steve", payloadObj.get("sender").getAsString());
        assertEquals("uuid-1234", payloadObj.get("uuid").getAsString());
        assertEquals("Hello World!", payloadObj.get("message").getAsString());
    }

    @Test
    public void testEventPayloadSerialization() {
        Packet.EventPayload payload = new Packet.EventPayload("death", "Alex", "uuid-5678", "Alex was pricked by a sweet berry bush");
        Packet packet = new Packet("event", payload);
        String json = GSON.toJson(packet);

        JsonObject obj = JsonParser.parseString(json).getAsJsonObject();
        assertEquals("event", obj.get("type").getAsString());
        JsonObject payloadObj = obj.getAsJsonObject("payload");
        assertEquals("death", payloadObj.get("event_type").getAsString());
        assertEquals("Alex", payloadObj.get("username").getAsString());
        assertEquals("uuid-5678", payloadObj.get("uuid").getAsString());
        assertEquals("Alex was pricked by a sweet berry bush", payloadObj.get("details").getAsString());
    }

    @Test
    public void testStatusPayloadSerialization() {
        Packet.StatusPayload payload = new Packet.StatusPayload(true, 19.95, 12, 2, 20, List.of("Steve", "Alex"));
        Packet packet = new Packet("status", payload);
        String json = GSON.toJson(packet);

        JsonObject obj = JsonParser.parseString(json).getAsJsonObject();
        assertEquals("status", obj.get("type").getAsString());
        JsonObject payloadObj = obj.getAsJsonObject("payload");
        assertTrue(payloadObj.get("online").getAsBoolean());
        assertEquals(19.95, payloadObj.get("tps").getAsDouble(), 0.01);
        assertEquals(12, payloadObj.get("ping").getAsInt());
        assertEquals(2, payloadObj.get("current_players").getAsInt());
        assertEquals(20, payloadObj.get("max_players").getAsInt());
        assertEquals(2, payloadObj.getAsJsonArray("players").size());
    }

    @Test
    public void testTransactionLogPayloadSerialization() {
        Packet.TransactionLogPayload payload = new Packet.TransactionLogPayload(
            1626000000000L, "10,64,10", "Steve", "Alex", "minecraft:diamond", 3, 500.0, 0.0, 1500.0
        );
        Packet packet = new Packet("transaction_log", payload);
        String json = GSON.toJson(packet);

        JsonObject obj = JsonParser.parseString(json).getAsJsonObject();
        assertEquals("transaction_log", obj.get("type").getAsString());
        JsonObject payloadObj = obj.getAsJsonObject("payload");
        assertEquals(1626000000000L, payloadObj.get("timestamp").getAsLong());
        assertEquals("10,64,10", payloadObj.get("shop_coords").getAsString());
        assertEquals("Steve", payloadObj.get("buyer").getAsString());
        assertEquals("Alex", payloadObj.get("seller").getAsString());
        assertEquals("minecraft:diamond", payloadObj.get("item").getAsString());
        assertEquals(3, payloadObj.get("quantity").getAsInt());
        assertEquals(500.0, payloadObj.get("unit_price").getAsDouble(), 0.01);
        assertEquals(0.0, payloadObj.get("tax_deducted").getAsDouble(), 0.01);
        assertEquals(1500.0, payloadObj.get("net_profit").getAsDouble(), 0.01);
    }

    @Test
    public void testPlayerInventoryResponsePayloadSerialization() {
        Packet.InventoryItem item = new Packet.InventoryItem(40, "minecraft:shield", 1, "Shield", "");
        Packet.PlayerInventoryResponsePayload payload = new Packet.PlayerInventoryResponsePayload("query-1", true, List.of(item));
        Packet packet = new Packet("player_inventory_response", payload);
        String json = GSON.toJson(packet);

        JsonObject obj = JsonParser.parseString(json).getAsJsonObject();
        assertEquals("player_inventory_response", obj.get("type").getAsString());
        JsonObject payloadObj = obj.getAsJsonObject("payload");
        assertEquals("query-1", payloadObj.get("query_id").getAsString());
        assertTrue(payloadObj.get("success").getAsBoolean());
        assertEquals(1, payloadObj.getAsJsonArray("items").size());
        JsonObject itemObj = payloadObj.getAsJsonArray("items").get(0).getAsJsonObject();
        assertEquals(40, itemObj.get("slot").getAsInt());
        assertEquals("minecraft:shield", itemObj.get("itemId").getAsString());
    }
}
