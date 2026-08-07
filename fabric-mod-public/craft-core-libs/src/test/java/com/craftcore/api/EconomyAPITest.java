package com.craftcore.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

class EconomyAPITest {

    @BeforeEach
    void setUp() {
        EconomyAPI.registerProvider(new DefaultFallbackEconomyProvider());
    }

    @Test
    void testDefaultFallbackProviderExhaustive() {
        assertTrue(EconomyAPI.isDefaultProvider());
        EconomyAPI api = EconomyAPI.getProvider();
        UUID uuid = UUID.randomUUID();

        // UUID overloads
        assertEquals(0.0, api.getBalance(uuid));
        assertFalse(api.setBalance(uuid, 100.0, EconomyChangeReason.ADMIN_COMMAND));
        assertFalse(api.setBalance(uuid, 100.0));
        assertFalse(api.addMoney(uuid, 50.0, EconomyChangeReason.SYSTEM_GRANT));
        assertFalse(api.addMoney(uuid, 50.0));
        assertFalse(api.removeMoney(uuid, 20.0, EconomyChangeReason.SHOP_BUY));
        assertFalse(api.removeMoney(uuid, 20.0));
        assertTrue(api.hasMoney(uuid, 0.0));
        assertTrue(api.hasMoney(uuid, -5.0));
        assertFalse(api.hasMoney(uuid, 10.0));

        // String overloads
        assertEquals(0.0, api.getBalance("TestPlayer"));
        assertFalse(api.setBalance("TestPlayer", 100.0, EconomyChangeReason.ADMIN_COMMAND));
        assertFalse(api.setBalance("TestPlayer", 100.0));
        assertFalse(api.addMoney("TestPlayer", 50.0, EconomyChangeReason.SYSTEM_GRANT));
        assertFalse(api.addMoney("TestPlayer", 50.0));
        assertFalse(api.removeMoney("TestPlayer", 20.0, EconomyChangeReason.SHOP_BUY));
        assertFalse(api.removeMoney("TestPlayer", 20.0));
        assertTrue(api.hasMoney("TestPlayer", 0.0));
        assertTrue(api.hasMoney("TestPlayer", -10.0));
        assertFalse(api.hasMoney("TestPlayer", 10.0));

        // Transfer overloads
        EconomyResult resultUUID = api.transferMoney(uuid, UUID.randomUUID(), 100.0);
        assertFalse(resultUUID.isSuccess());
        assertTrue(resultUUID.getMessage().contains("craft-core-economy"));

        EconomyResult resultString = api.transferMoney("Sender", "Recipient", 100.0);
        assertFalse(resultString.isSuccess());
        assertTrue(resultString.getMessage().contains("craft-core-economy"));
    }

    @Test
    void testStaticConvenienceMethods() {
        UUID uuid = UUID.randomUUID();

        // Default provider behavior
        assertEquals(0.0, EconomyAPI.balance(uuid));
        assertFalse(EconomyAPI.give(uuid, 100.0));
        assertFalse(EconomyAPI.take(uuid, 50.0));

        // Custom provider behavior via static methods
        AtomicBoolean giveCalled = new AtomicBoolean(false);
        EconomyAPI custom = new DefaultFallbackEconomyProvider() {
            @Override
            public double getBalance(UUID uuid) { return 777.0; }

            @Override
            public boolean addMoney(UUID uuid, double amount, EconomyChangeReason reason) {
                giveCalled.set(true);
                return true;
            }
        };

        EconomyAPI.registerProvider(custom);
        assertFalse(EconomyAPI.isDefaultProvider());
        assertEquals(777.0, EconomyAPI.balance(uuid));
        assertTrue(EconomyAPI.give(uuid, 100.0));
        assertTrue(giveCalled.get());
    }

    @Test
    void testNullProviderRegistrationIgnored() {
        EconomyAPI initialProvider = EconomyAPI.getProvider();
        assertTrue(EconomyAPI.isDefaultProvider());

        // Registering null provider should be ignored and not crash or set provider to null
        EconomyAPI.registerProvider(null);
        assertNotNull(EconomyAPI.getProvider());
        assertSame(initialProvider, EconomyAPI.getProvider());
    }

    @Test
    void testRegisterCustomProvider() {
        AtomicBoolean customCalled = new AtomicBoolean(false);
        EconomyAPI customProvider = new EconomyAPI() {
            @Override public double getBalance(UUID uuid) { customCalled.set(true); return 500.0; }
            @Override public boolean setBalance(UUID uuid, double amount, EconomyChangeReason reason) { return false; }
            @Override public boolean addMoney(UUID uuid, double amount, EconomyChangeReason reason) { return false; }
            @Override public boolean removeMoney(UUID uuid, double amount, EconomyChangeReason reason) { return false; }
            @Override public boolean hasMoney(UUID uuid, double amount) { return false; }
            @Override public double getBalance(String username) { return 0.0; }
            @Override public boolean setBalance(String username, double amount, EconomyChangeReason reason) { return false; }
            @Override public boolean addMoney(String username, double amount, EconomyChangeReason reason) { return false; }
            @Override public boolean removeMoney(String username, double amount, EconomyChangeReason reason) { return false; }
            @Override public boolean hasMoney(String username, double amount) { return false; }
            @Override public EconomyResult transferMoney(UUID sender, UUID recipient, double amount) { return null; }
            @Override public EconomyResult transferMoney(String sender, String recipient, double amount) { return null; }
            @Override public void registerChangeListener(EconomyChangeListener listener) {}
            @Override public void unregisterChangeListener(EconomyChangeListener listener) {}
            @Override public void fireEconomyChangeEvent(EconomyChangeEvent event) {}
        };

        EconomyAPI.registerProvider(customProvider);
        assertFalse(EconomyAPI.isDefaultProvider());
        assertEquals(500.0, EconomyAPI.getProvider().getBalance(UUID.randomUUID()));
        assertTrue(customCalled.get());

        // Restoring default provider
        EconomyAPI.registerProvider(new DefaultFallbackEconomyProvider());
        assertTrue(EconomyAPI.isDefaultProvider());
    }

    @Test
    void testEconomyChangeEventAndListeners() {
        DefaultFallbackEconomyProvider provider = new DefaultFallbackEconomyProvider();
        AtomicBoolean listenerFired = new AtomicBoolean(false);

        EconomyChangeListener listener = event -> {
            listenerFired.set(true);
            assertEquals(100.0, event.getOldBalance());
            assertEquals(200.0, event.getNewBalance());
            assertEquals(100.0, event.getDelta());
            assertEquals(EconomyChangeReason.SHOP_SELL, event.getReason());
        };

        provider.registerChangeListener(listener);
        UUID uuid = UUID.randomUUID();
        EconomyChangeEvent event = new EconomyChangeEvent(uuid, "Player1", 100.0, 200.0, EconomyChangeReason.SHOP_SELL);
        provider.fireEconomyChangeEvent(event);

        assertTrue(listenerFired.get());

        listenerFired.set(false);
        provider.unregisterChangeListener(listener);
        provider.fireEconomyChangeEvent(event);
        assertFalse(listenerFired.get());
    }

    @Test
    void testListenerExceptionIsolationAndNullHandling() {
        DefaultFallbackEconomyProvider provider = new DefaultFallbackEconomyProvider();

        // Null listener registration & firing null event
        assertDoesNotThrow(() -> provider.registerChangeListener(null));
        assertDoesNotThrow(() -> provider.unregisterChangeListener(null));
        assertDoesNotThrow(() -> provider.fireEconomyChangeEvent(null));

        // Exception isolation: throwing listener should not prevent subsequent listeners
        AtomicBoolean secondListenerFired = new AtomicBoolean(false);
        EconomyChangeListener throwingListener = event -> {
            throw new RuntimeException("Crashing listener");
        };
        EconomyChangeListener validListener = event -> secondListenerFired.set(true);

        provider.registerChangeListener(throwingListener);
        provider.registerChangeListener(validListener);

        EconomyChangeEvent event = new EconomyChangeEvent(UUID.randomUUID(), "Test", 0, 10, EconomyChangeReason.SYSTEM_GRANT);
        assertDoesNotThrow(() -> provider.fireEconomyChangeEvent(event));

        assertTrue(secondListenerFired.get(), "Subsequent listener must fire even if prior listener threw exception");
    }
}
