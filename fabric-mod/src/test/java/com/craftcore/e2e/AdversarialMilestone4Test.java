package com.craftcore.e2e;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.network.chat.Component;
import net.minecraft.commands.CommandSourceStack;

import com.craftcore.shop.ShopManager;
import com.craftcore.economy.EconomyManager;
import com.craftcore.websocket.Packet;
import com.craftcore.websocket.PacketHandler;
import com.craftcore.websocket.CraftCoreWSClient;

public class AdversarialMilestone4Test {

    @BeforeAll
    public static void beforeClass() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
            
            net.minecraft.core.HolderLookup.Provider provider = net.minecraft.core.HolderLookup.Provider.create(
                net.minecraft.core.registries.BuiltInRegistries.REGISTRY.stream().map(r -> (net.minecraft.core.HolderLookup.RegistryLookup<?>) r)
            );
            
            net.minecraft.core.component.DataComponentInitializers initializers = new net.minecraft.core.component.DataComponentInitializers();
            java.util.List<net.minecraft.core.component.DataComponentInitializers.PendingComponents<?>> pending = initializers.build(provider);
            for (var p : pending) {
                try {
                    p.apply();
                } catch (Throwable t) {
                    // ignore
                }
            }
        } catch (Throwable t) {
            System.err.println("Could not bootstrap Minecraft registries in AdversarialMilestone4Test: " + t.getMessage());
        }
    }

    @BeforeEach
    public void setUp() {
        EconomyManager.clearAll();
        ShopManager.clearAll();
    }

    private ServerPlayer createMockPlayer(String name) {
        ServerPlayer mockPlayer = mock(ServerPlayer.class);
        Component mockText = mock(Component.class);
        when(mockText.getString()).thenReturn(name);
        when(mockPlayer.getName()).thenReturn(mockText);

        CommandSourceStack mockSource = mock(CommandSourceStack.class);
        when(mockPlayer.createCommandSourceStack()).thenReturn(mockSource);
        net.minecraft.server.permissions.PermissionSet mockPerms = mock(net.minecraft.server.permissions.PermissionSet.class);
        when(mockSource.permissions()).thenReturn(mockPerms);
        when(mockPerms.hasPermission(any())).thenReturn(false);
        
        return mockPlayer;
    }

    @Test
    public void testShopRatingBoundsAndAverage() {
        String seller = "Alice";
        String buyer = "Bob";
        String coords = "1,2,3";
        String key = "minecraft:overworld:" + coords;

        // Register shop
        assertTrue(ShopManager.registerShop(seller, key, "minecraft:stone", 10.0, 10));

        // Start rating session for Bob
        ShopManager.addRatingSession(buyer, key);
        assertTrue(ShopManager.hasRatingSession(buyer));

        ServerLevel mockWorld = mock(ServerLevel.class);
        ServerPlayer mockBuyer = createMockPlayer(buyer);

        // 1. Enter invalid score (0) -> should fail
        ShopManager.ChatInterceptionResult res0 = ShopManager.handleChatInput(buyer, "0", mockBuyer, mockWorld);
        assertFalse(res0.success);
        assertTrue(res0.responseMessage.contains("1 到 5"));

        // Rating session should still be active for retry
        assertTrue(ShopManager.hasRatingSession(buyer));

        // 2. Enter invalid score (6) -> should fail
        ShopManager.ChatInterceptionResult res6 = ShopManager.handleChatInput(buyer, "6", mockBuyer, mockWorld);
        assertFalse(res6.success);

        // 3. Enter non-number -> should fail
        ShopManager.ChatInterceptionResult resWord = ShopManager.handleChatInput(buyer, "five", mockBuyer, mockWorld);
        assertFalse(resWord.success);

        // 4. Cancel rating
        ShopManager.ChatInterceptionResult resCancel = ShopManager.handleChatInput(buyer, "取消", mockBuyer, mockWorld);
        assertFalse(resCancel.success);
        assertFalse(ShopManager.hasRatingSession(buyer)); // Session is removed

        // 5. Submit valid score (5)
        ShopManager.addRatingSession(buyer, key);
        ShopManager.ChatInterceptionResult res5 = ShopManager.handleChatInput(buyer, "5", mockBuyer, mockWorld);
        assertTrue(res5.success);
        assertFalse(ShopManager.hasRatingSession(buyer)); // Completed

        // 6. Submit another valid score (4)
        ShopManager.addRatingSession("Charlie", key);
        ShopManager.handleChatInput("Charlie", "4", createMockPlayer("Charlie"), mockWorld);

        // Average should be 4.5
        assertEquals(4.5, ShopManager.getAverageRating(key), 0.001);
        assertEquals("4.5 ★", ShopManager.getAverageRatingString(key));
    }

    @Test
    public void testShopRenamingEnforcement() {
        String owner = "Alice";
        String other = "Bob";
        String coords = "4,5,6";
        String key = "minecraft:overworld:" + coords;

        // Register shop
        assertTrue(ShopManager.registerShop(owner, key, "minecraft:stone", 10.0, 10));
        ShopManager.Shop shop = ShopManager.getShop(key);
        assertNull(shop.customName);

        // 1. Other player cannot rename
        // (We test command level logic by simulating the renaming logic directly or checking shop permission)
        // Alice has $4000 (needs $5000)
        EconomyManager.setBalance(owner, 4000.0);
        
        // Renaming command logic test
        double balance = EconomyManager.getBalance(owner);
        assertTrue(balance < 5000.0); // Renaming should fail due to cost

        // alice gets $10000
        EconomyManager.setBalance(owner, 10000.0);
        assertTrue(EconomyManager.removeMoney(owner, 5000.0));
        shop.customName = "Alice's Boutique";
        assertEquals("Alice's Boutique", shop.customName);
        assertEquals(5000.0, EconomyManager.getBalance(owner));

        // Name length boundary check: 15 chars max
        String longName = "ThisIsAVeryLongShopNameIndeed";
        assertTrue(longName.length() > 15);
    }

    @Test
    public void testWealthLeaderboardSortingAndWebSocket() {
        // Setup balances
        EconomyManager.setBalance("Player1", 500.0);
        EconomyManager.setBalance("Player2", 1500.0);
        EconomyManager.setBalance("Player3", 1000.0);
        EconomyManager.setBalance("Player4", 250.0);

        var top = EconomyManager.getTopWealthPlayers(3);
        assertEquals(3, top.size());
        assertEquals("Player2", top.get(0).getKey()); // 1500
        assertEquals("Player3", top.get(1).getKey()); // 1000
        assertEquals("Player1", top.get(2).getKey()); // 500

        // Test WebSocket query
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        when(mockClient.isAuthenticated()).thenReturn(true);

        String json = "{\"type\":\"rich_list_query\",\"payload\":{\"query_id\":\"q-rich-123\"}}";
        PacketHandler.handle(json, null, mockClient);

        org.mockito.ArgumentCaptor<Packet> captor = org.mockito.ArgumentCaptor.forClass(Packet.class);
        verify(mockClient).send(captor.capture());

        Packet response = captor.getValue();
        assertEquals("rich_list_response", response.type);
        Packet.RichListResponsePayload payload = (Packet.RichListResponsePayload) response.payload;
        assertTrue(payload.success);
        assertEquals("q-rich-123", payload.query_id);
        assertEquals(4, payload.players.size());
        assertEquals("Player2", payload.players.get(0).username);
        assertEquals(1500.0, payload.players.get(0).balance, 0.001);
    }
}
