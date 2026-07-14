package com.craftcore;

import com.craftcore.websocket.Packet;
import com.craftcore.websocket.PacketHandler;
import com.craftcore.websocket.CraftCoreWSClient;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.players.PlayerList;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Item;
import net.minecraft.resources.Identifier;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class InventoryVerificationTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
            
            net.minecraft.core.HolderLookup.Provider provider = net.minecraft.core.HolderLookup.Provider.create(
                BuiltInRegistries.REGISTRY.stream().map(r -> (net.minecraft.core.HolderLookup.RegistryLookup<?>) r)
            );
            
            net.minecraft.core.component.DataComponentInitializers initializers = new net.minecraft.core.component.DataComponentInitializers();
            java.util.List<net.minecraft.core.component.DataComponentInitializers.PendingComponents<?>> pending = initializers.build(provider);
            for (var p : pending) {
                p.apply();
            }
        } catch (Throwable t) {
            System.err.println("Could not bootstrap Minecraft registries: " + t.getMessage());
        }
        try {
            java.lang.reflect.Field field = net.minecraft.server.Bootstrap.class.getDeclaredField("initialized");
            field.setAccessible(true);
            field.set(null, true);
        } catch (Throwable t) {
            // ignore
        }
    }

    @Test
    public void testPlayerInventoryQueryAll41Slots() {
        MinecraftServer server = mock(MinecraftServer.class);
        CraftCoreWSClient client = mock(CraftCoreWSClient.class);
        PlayerList playerList = mock(PlayerList.class);

        // Stub server execution and player list
        doAnswer(invocation -> {
            Runnable runnable = invocation.getArgument(0);
            runnable.run();
            return null;
        }).when(server).execute(any(Runnable.class));
        when(server.getPlayerList()).thenReturn(playerList);

        // Mock player
        ServerPlayer mockPlayer = mock(ServerPlayer.class);
        Component nameComponent = mock(Component.class);
        when(nameComponent.getString()).thenReturn("Steve");
        when(mockPlayer.getName()).thenReturn(nameComponent);
        when(playerList.getPlayers()).thenReturn(List.of(mockPlayer));

        // Mock inventory
        Inventory mockInv = mock(Inventory.class);
        when(mockPlayer.getInventory()).thenReturn(mockInv);

        // Retrieve items from registry
        Item diamond = BuiltInRegistries.ITEM.getValue(Identifier.parse("minecraft:diamond"));
        Item iron = BuiltInRegistries.ITEM.getValue(Identifier.parse("minecraft:iron_ingot"));
        Item boots = BuiltInRegistries.ITEM.getValue(Identifier.parse("minecraft:leather_boots"));
        Item leggings = BuiltInRegistries.ITEM.getValue(Identifier.parse("minecraft:leather_leggings"));
        Item chestplate = BuiltInRegistries.ITEM.getValue(Identifier.parse("minecraft:leather_chestplate"));
        Item helmet = BuiltInRegistries.ITEM.getValue(Identifier.parse("minecraft:leather_helmet"));
        Item shield = BuiltInRegistries.ITEM.getValue(Identifier.parse("minecraft:shield"));

        assertNotNull(diamond, "Diamond item should not be null after bootstrap");

        ItemStack diamondStack = new ItemStack(diamond, 5);
        ItemStack ironStack = new ItemStack(iron, 64);
        ItemStack bootsStack = new ItemStack(boots, 1);
        ItemStack leggingsStack = new ItemStack(leggings, 1);
        ItemStack chestplateStack = new ItemStack(chestplate, 1);
        ItemStack helmetStack = new ItemStack(helmet, 1);
        ItemStack shieldStack = new ItemStack(shield, 1);

        // Mock Inventory slots
        when(mockInv.getItem(anyInt())).thenAnswer(invocation -> {
            int slot = invocation.getArgument(0);
            switch (slot) {
                case 0: return diamondStack;
                case 9: return ironStack;
                case 36: return bootsStack;
                case 37: return leggingsStack;
                case 38: return chestplateStack;
                case 39: return helmetStack;
                case 40: return shieldStack;
                default: return ItemStack.EMPTY;
            }
        });

        // Construct mock websocket request message
        String jsonRequest = "{\n" +
                "  \"type\": \"player_inventory_query\",\n" +
                "  \"payload\": {\n" +
                "    \"query_id\": \"query-123\",\n" +
                "    \"username\": \"Steve\"\n" +
                "  }\n" +
                "}";

        // Invoke packet handler
        PacketHandler.handle(jsonRequest, server, client);

        // Capture response
        ArgumentCaptor<Packet> sentPacketCaptor = ArgumentCaptor.forClass(Packet.class);
        verify(client, atLeastOnce()).send(sentPacketCaptor.capture());

        Packet response = sentPacketCaptor.getValue();
        assertEquals("player_inventory_response", response.type);

        Packet.PlayerInventoryResponsePayload payload = (Packet.PlayerInventoryResponsePayload) response.payload;
        assertTrue(payload.success);
        assertEquals("query-123", payload.query_id);

        List<Packet.InventoryItem> items = payload.items;
        assertEquals(7, items.size(), "Should have serialized exactly 7 non-empty slots");

        // Verify slot numbers, item ids, counts
        boolean foundSlot0 = false;
        boolean foundSlot9 = false;
        boolean foundSlot36 = false;
        boolean foundSlot37 = false;
        boolean foundSlot38 = false;
        boolean foundSlot39 = false;
        boolean foundSlot40 = false;

        for (Packet.InventoryItem item : items) {
            switch (item.slot) {
                case 0:
                    foundSlot0 = true;
                    assertEquals("minecraft:diamond", item.itemId);
                    assertEquals(5, item.count);
                    break;
                case 9:
                    foundSlot9 = true;
                    assertEquals("minecraft:iron_ingot", item.itemId);
                    assertEquals(64, item.count);
                    break;
                case 36:
                    foundSlot36 = true;
                    assertEquals("minecraft:leather_boots", item.itemId);
                    assertEquals(1, item.count);
                    break;
                case 37:
                    foundSlot37 = true;
                    assertEquals("minecraft:leather_leggings", item.itemId);
                    assertEquals(1, item.count);
                    break;
                case 38:
                    foundSlot38 = true;
                    assertEquals("minecraft:leather_chestplate", item.itemId);
                    assertEquals(1, item.count);
                    break;
                case 39:
                    foundSlot39 = true;
                    assertEquals("minecraft:leather_helmet", item.itemId);
                    assertEquals(1, item.count);
                    break;
                case 40:
                    foundSlot40 = true;
                    assertEquals("minecraft:shield", item.itemId);
                    assertEquals(1, item.count);
                    break;
                default:
                    fail("Serialized slot " + item.slot + " which was not expected");
            }
        }

        assertTrue(foundSlot0, "Slot 0 (hotbar) missing");
        assertTrue(foundSlot9, "Slot 9 (inventory main) missing");
        assertTrue(foundSlot36, "Slot 36 (boots) missing");
        assertTrue(foundSlot37, "Slot 37 (leggings) missing");
        assertTrue(foundSlot38, "Slot 38 (chestplate) missing");
        assertTrue(foundSlot39, "Slot 39 (helmet) missing");
        assertTrue(foundSlot40, "Slot 40 (offhand) missing");
    }
}
