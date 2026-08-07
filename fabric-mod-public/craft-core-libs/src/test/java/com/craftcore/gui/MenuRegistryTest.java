package com.craftcore.gui;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

class MenuRegistryTest {

    @BeforeEach
    void setUp() {
        MenuRegistry.clear();
    }

    @Test
    void testRegisterAndUnregisterAction() {
        assertFalse(MenuRegistry.isRegistered("shop:open"));
        MenuRegistry.registerAction("shop:open", (player, args) -> {});
        assertTrue(MenuRegistry.isRegistered("shop:open"));
        assertTrue(MenuRegistry.isRegistered("SHOP:OPEN"));

        MenuRegistry.unregisterAction("shop:open");
        assertFalse(MenuRegistry.isRegistered("shop:open"));
    }

    @Test
    void testCaseInsensitivityAndClear() {
        MenuRegistry.registerAction("Claims:Open", (player, args) -> {});
        assertTrue(MenuRegistry.isRegistered("claims:open"));
        assertTrue(MenuRegistry.isRegistered("CLAIMS:OPEN"));

        MenuRegistry.clear();
        assertFalse(MenuRegistry.isRegistered("claims:open"));
    }

    @Test
    void testNullPlayerOrMenuIdShortCircuit() {
        AtomicBoolean handlerExecuted = new AtomicBoolean(false);
        MenuRegistry.registerAction("shop:open", (player, args) -> handlerExecuted.set(true));

        // When player is null, openMenu must return immediately without calling handler
        assertDoesNotThrow(() -> MenuRegistry.openMenu("shop:open", null, "test"));
        assertFalse(handlerExecuted.get(), "Handler should not execute when player is null");

        // When menuId is null, openMenu must return immediately
        assertDoesNotThrow(() -> MenuRegistry.openMenu(null, null, "test"));
    }

    @Test
    void testNullInputsInRegisterAndUnregister() {
        assertDoesNotThrow(() -> MenuRegistry.registerAction(null, (p, a) -> {}));
        assertDoesNotThrow(() -> MenuRegistry.registerAction("shop:open", null));
        assertDoesNotThrow(() -> MenuRegistry.unregisterAction(null));
        assertFalse(MenuRegistry.isRegistered(null));
    }
}


