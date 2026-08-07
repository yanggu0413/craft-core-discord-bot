package com.craftcore.economy;

import com.craftcore.api.EconomyAPI;
import com.craftcore.api.EconomyChangeEvent;
import com.craftcore.api.EconomyChangeReason;
import com.craftcore.api.EconomyResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

public class EconomyServiceImplTest {

    @TempDir
    Path tempDir;

    private EconomyServiceImpl service;

    @BeforeEach
    public void setUp() {
        EconomyManager.setConfigPath(tempDir.resolve("economy_api_test.json"));
        EconomyManager.clearAll();
        com.craftcore.data.AsyncSaveExecutor.flush();
        service = new EconomyServiceImpl();
        EconomyAPI.registerProvider(service);
    }

    @AfterEach
    public void tearDown() {
        com.craftcore.data.AsyncSaveExecutor.flush();
    }

    @Test
    public void testSPIRegistration() {
        assertSame(service, EconomyAPI.getProvider());
        assertFalse(EconomyAPI.isDefaultProvider());
    }

    @Test
    public void testBalanceAndAddRemove() {
        String player = "Steve";
        assertEquals(0.0, service.getBalance(player));

        assertTrue(service.addMoney(player, 500.0, EconomyChangeReason.CHECKIN_REWARD));
        assertEquals(500.0, service.getBalance(player));
        assertTrue(service.hasMoney(player, 500.0));
        assertFalse(service.hasMoney(player, 500.01));

        assertTrue(service.removeMoney(player, 200.0, EconomyChangeReason.SHOP_BUY));
        assertEquals(300.0, service.getBalance(player));

        service.setBalance(player, 1000.0, EconomyChangeReason.ADMIN_COMMAND);
        assertEquals(1000.0, service.getBalance(player));
    }

    @Test
    public void testTransferMoney() {
        service.setBalance("Alice", 1000.0);
        service.setBalance("Bob", 100.0);

        EconomyResult result = service.transferMoney("Alice", "Bob", 400.0);
        assertTrue(result.isSuccess());
        assertEquals(400.0, result.getAmountTransferred());
        assertEquals(600.0, service.getBalance("Alice"));
        assertEquals(500.0, service.getBalance("Bob"));
    }

    @Test
    public void testChangeListenerEvents() {
        AtomicReference<EconomyChangeEvent> lastEvent = new AtomicReference<>();
        service.registerChangeListener(lastEvent::set);

        service.setBalance("Alex", 100.0, EconomyChangeReason.ADMIN_COMMAND);
        assertNotNull(lastEvent.get());
        assertEquals("Alex", lastEvent.get().getUsername());
        assertEquals(0.0, lastEvent.get().getOldBalance());
        assertEquals(100.0, lastEvent.get().getNewBalance());
        assertEquals(100.0, lastEvent.get().getDelta());
        assertEquals(EconomyChangeReason.ADMIN_COMMAND, lastEvent.get().getReason());

        service.unregisterChangeListener(lastEvent::set);
    }
}
