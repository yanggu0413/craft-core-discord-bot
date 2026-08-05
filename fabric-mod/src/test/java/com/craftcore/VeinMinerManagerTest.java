package com.craftcore;

import com.craftcore.vein.VeinMinerManager;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

public class VeinMinerManagerTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @Test
    public void testPlayerVeinConfigToggles() {
        UUID testUuid = UUID.randomUUID();
        VeinMinerManager.PlayerVeinConfig cfg = VeinMinerManager.getConfig(testUuid);
        assertNotNull(cfg);
        assertTrue(cfg.treeFellerEnabled);
        assertTrue(cfg.veinMinerEnabled);

        cfg.treeFellerEnabled = false;
        assertFalse(VeinMinerManager.getConfig(testUuid).treeFellerEnabled);
    }
}
