package com.craftcore.e2e;

import com.craftcore.economy.EconomyManager;
import com.craftcore.shop.ShopManager;
import com.craftcore.websocket.Packet;
import com.craftcore.websocket.PacketHandler;
import com.craftcore.websocket.CraftCoreWSClient;
import com.craftcore.websocket.WSCommandOutput;
import net.minecraft.server.MinecraftServer;
import net.minecraft.commands.Commands;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.network.chat.Component;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class AdversarialChallengerTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
            
            net.minecraft.core.HolderLookup.Provider provider = net.minecraft.core.HolderLookup.Provider.create(
                net.minecraft.core.registries.BuiltInRegistries.REGISTRY.stream().map(r -> (net.minecraft.core.HolderLookup.RegistryLookup<?>) r)
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

    @BeforeEach
    public void setUp() {
        EconomyManager.clearAll();
        ShopManager.clearAll();
        EconomyManager.setCurrentDateOverride(null);
    }

    // =========================================================================
    // CHALLENGE 1: Concurrent Balance Updates (Thread-Safety of EconomyManager)
    // =========================================================================
    @Test
    public void testConcurrentBalanceUpdates() throws InterruptedException {
        String username = "ConcurrentPlayer";
        EconomyManager.setBalance(username, 1000.0);

        int threadCount = 10;
        int operationsPerThread = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                for (int j = 0; j < operationsPerThread; j++) {
                    EconomyManager.addMoney(username, 10.0);
                    EconomyManager.removeMoney(username, 5.0);
                }
            });
        }

        executor.shutdown();
        assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS));

        // Expected balance: 1000.0 + 10 * 100 * (10.0 - 5.0) = 6000.0
        assertEquals(6000.0, EconomyManager.getBalance(username), 0.001);
    }

    // =========================================================================
    // CHALLENGE 2: Concurrent Daily Sell Limits (Race conditions under high load)
    // =========================================================================
    @Test
    public void testConcurrentDailySellLimits() throws InterruptedException {
        String username = "SellerPlayer";
        int threadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        AtomicInteger totalSold = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                // Each thread attempts to sell 20 stones (total 200 stones, limit is 80)
                EconomyManager.SellResult result = EconomyManager.sellItem(username, "minecraft:stone", 20);
                totalSold.addAndGet(result.soldCount);
            });
        }

        executor.shutdown();
        assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS));

        // Verify limit is strictly enforced and exactly 80 stones were sold
        assertEquals(80, totalSold.get());
        assertEquals(80, EconomyManager.getDailyStonesSold(username));
    }

    // =========================================================================
    // CHALLENGE 3: Concurrent GUI Withdrawal (Double-spending protection check)
    // =========================================================================
    @Test
    public void testConcurrentGuiWithdrawal() throws InterruptedException {
        String player = "ShopOwner";
        String coords = "10,64,10";
        ShopManager.registerShop(player, coords, "minecraft:diamond", 100.0, 5);
        ShopManager.Shop shop = ShopManager.getShop(coords);
        shop.revenue = 500.0; // Simulate earned revenue

        int threadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                String result = ShopManager.clickShopGUI(player, coords, "withdraw", false);
                if (result.startsWith("Withdrew")) {
                    successCount.incrementAndGet();
                } else if (result.equals("No revenue to withdraw")) {
                    failCount.incrementAndGet();
                }
            });
        }

        executor.shutdown();
        assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS));

        // Only exactly one thread must succeed; others must get "No revenue to withdraw"
        assertEquals(1, successCount.get());
        assertEquals(9, failCount.get());
        // Verify player's balance is exactly 500.0, and shop revenue was reset to 0
        assertEquals(500.0, EconomyManager.getBalance(player), 0.001);
        assertEquals(0.0, shop.revenue, 0.001);
    }

    // =========================================================================
    // CHALLENGE 4: NaN / Infinity Exploits (Adversarial inputs checking)
    // =========================================================================
    @Test
    public void testNaNPriceCreationGracefulFailure() {
        String username = "Exploiter";
        String coords = "10,64,10";
        ShopManager.addCreationSession(username, coords, "minecraft:diamond");

        try {
            // Attempting to create a shop with NaN price
            ShopManager.ChatInterceptionResult res = ShopManager.handleChatInput(username, "NaN");
            
            // If it returns a result, verify it was rejected
            assertFalse(res.success, "NaN price should be rejected!");
            assertNull(ShopManager.getShop(coords), "NaN price shop registered in-memory!");
        } catch (IllegalArgumentException e) {
            // If it throws Gson's IllegalArgumentException, check if the shop got registered in-memory.
            // If it got registered, that's a state corruption vulnerability!
            boolean registeredInMemory = ShopManager.getShop(coords) != null;
            if (registeredInMemory) {
                // Clean up the shop so that other tests don't fail, but assert fail to report the vulnerability
                ShopManager.unregisterShop(coords);
                fail("VULNERABILITY: NaN price shop registered in-memory and crashed save() with IllegalArgumentException!");
            }
        }
    }

    @Test
    public void testInfinityPriceCreationGracefulFailure() {
        String username = "Exploiter";
        String coords = "10,64,10";
        ShopManager.addCreationSession(username, coords, "minecraft:diamond");

        try {
            // Attempting to create a shop with Infinity price
            ShopManager.ChatInterceptionResult res = ShopManager.handleChatInput(username, "Infinity");
            
            // If it returns a result, verify it was rejected
            assertFalse(res.success, "Infinity price should be rejected!");
            assertNull(ShopManager.getShop(coords), "Infinity price shop registered in-memory!");
        } catch (IllegalArgumentException e) {
            boolean registeredInMemory = ShopManager.getShop(coords) != null;
            if (registeredInMemory) {
                ShopManager.unregisterShop(coords);
                fail("VULNERABILITY: Infinity price shop registered in-memory and crashed save() with IllegalArgumentException!");
            }
        }
    }

    // =========================================================================
    // CHALLENGE 5: WebSocket Command Execution without Authentication
    // =========================================================================
    @Test
    public void testCommandExecutionWithoutAuthenticationRejected() {
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        // Explicitly set unauthenticated
        when(mockClient.isAuthenticated()).thenReturn(false);

        // We can check if the unauthenticated packet executes.
        // If MinecraftServer class loading still fails, we can catch it or bypass it.
        try {
            MinecraftServer mockServer = mock(MinecraftServer.class);
            Commands mockCommands = mock(Commands.class);
            when(mockServer.getCommands()).thenReturn(mockCommands);

            // Stub server.execute to run the runnable immediately in the test thread
            doAnswer(invocation -> {
                Runnable runnable = invocation.getArgument(0);
                runnable.run();
                return null;
            }).when(mockServer).execute(any(Runnable.class));

            // Construct command request packet
            String json = "{\n" +
                    "  \"type\": \"command_request\",\n" +
                    "  \"payload\": {\n" +
                    "    \"command_id\": \"cmd-123\",\n" +
                    "    \"command\": \"op Hacker\"\n" +
                    "  }\n" +
                    "}";

            PacketHandler.handle(json, mockServer, mockClient);

            // If it reached this point, check if the client sent any response packet
            ArgumentCaptor<Packet> sentPacketCaptor = ArgumentCaptor.forClass(Packet.class);
            verify(mockClient, atLeastOnce()).send(sentPacketCaptor.capture());

            Packet response = sentPacketCaptor.getValue();
            assertEquals("command_response", response.type);
            Packet.CommandResponsePayload payload = (Packet.CommandResponsePayload) response.payload;
            
            // Assert that the command failed or was not executed due to auth check.
            assertFalse(payload.success, "VULNERABILITY: Unauthenticated command request was executed!");
        } catch (Throwable t) {
            reset(mockClient);
            String json = "{\n" +
                    "  \"type\": \"command_request\",\n" +
                    "  \"payload\": {\n" +
                    "    \"command_id\": \"cmd-123\",\n" +
                    "    \"command\": \"op Hacker\"\n" +
                    "  }\n" +
                    "}";
            
            // Invoke handler with null server
            PacketHandler.handle(json, null, mockClient);
            
            // Verify that with authentication checks implemented, the client receives the rejection response packet.
            ArgumentCaptor<Packet> captor = ArgumentCaptor.forClass(Packet.class);
            verify(mockClient, atLeastOnce()).send(captor.capture());
            Packet response = captor.getValue();
            assertEquals("command_response", response.type);
            Packet.CommandResponsePayload payloadObjResponse = (Packet.CommandResponsePayload) response.payload;
            assertFalse(payloadObjResponse.success);
            assertEquals("Unauthorized", payloadObjResponse.output);
        }
    }

    @Test
    public void testWhitelistActionWithoutAuthenticationRejected() {
        CraftCoreWSClient mockClient = mock(CraftCoreWSClient.class);
        when(mockClient.isAuthenticated()).thenReturn(false);

        try {
            MinecraftServer mockServer = mock(MinecraftServer.class);
            Commands mockCommands = mock(Commands.class);
            when(mockServer.getCommands()).thenReturn(mockCommands);

            doAnswer(invocation -> {
                Runnable runnable = invocation.getArgument(0);
                runnable.run();
                return null;
            }).when(mockServer).execute(any(Runnable.class));

            String json = "{\n" +
                    "  \"type\": \"whitelist_action\",\n" +
                    "  \"payload\": {\n" +
                    "    \"action\": \"add\",\n" +
                    "    \"username\": \"Hacker\"\n" +
                    "  }\n" +
                    "}";

            PacketHandler.handle(json, mockServer, mockClient);

            ArgumentCaptor<Packet> sentPacketCaptor = ArgumentCaptor.forClass(Packet.class);
            verify(mockClient, atLeastOnce()).send(sentPacketCaptor.capture());

            Packet response = sentPacketCaptor.getValue();
            assertEquals("whitelist_response", response.type);
            Packet.WhitelistResponsePayload payload = (Packet.WhitelistResponsePayload) response.payload;

            assertFalse(payload.success, "VULNERABILITY: Unauthenticated whitelist action was executed!");
        } catch (Throwable t) {
            reset(mockClient);
            String json = "{\n" +
                    "  \"type\": \"whitelist_action\",\n" +
                    "  \"payload\": {\n" +
                    "    \"action\": \"add\",\n" +
                    "    \"username\": \"Hacker\"\n" +
                    "  }\n" +
                    "}";
            
            PacketHandler.handle(json, null, mockClient);
            
            // Verify that with authentication checks implemented, the client receives the rejection response packet.
            ArgumentCaptor<Packet> captor = ArgumentCaptor.forClass(Packet.class);
            verify(mockClient, atLeastOnce()).send(captor.capture());
            Packet response = captor.getValue();
            assertEquals("whitelist_response", response.type);
            Packet.WhitelistResponsePayload payloadObjResponse = (Packet.WhitelistResponsePayload) response.payload;
            assertFalse(payloadObjResponse.success);
            assertEquals("Unauthorized", payloadObjResponse.message);
        }
    }
}
