package com.craftcore;

import com.craftcore.trail.ParticleTrailManager;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

public class ParticleTrailManagerTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @Test
    public void testParticleForTitle() {
        ParticleOptions p1 = ParticleTrailManager.getParticleForTitle("§6[老玩家]");
        assertEquals(ParticleTypes.WAX_ON, p1);

        ParticleOptions p2 = ParticleTrailManager.getParticleForTitle("§6[百萬富翁]");
        assertEquals(ParticleTypes.HAPPY_VILLAGER, p2);

        ParticleOptions p3 = ParticleTrailManager.getParticleForTitle("§c[重鎚大師]");
        assertEquals(ParticleTypes.WITCH, p3);

        ParticleOptions p4 = ParticleTrailManager.getParticleForTitle("§e[黑貓宅急便]");
        assertEquals(ParticleTypes.NOTE, p4);

        ParticleOptions pFallback = ParticleTrailManager.getParticleForTitle(null);
        assertNull(pFallback);
    }

    @Test
    public void testPlayerTrailConfig() {
        UUID testUuid = UUID.randomUUID();
        ParticleTrailManager.PlayerTrailConfig cfg = ParticleTrailManager.getConfig(testUuid);
        assertNotNull(cfg);
        assertTrue(cfg.footstepEnabled);
        assertTrue(cfg.auraEnabled);
        assertTrue(cfg.attackEnabled);
        assertTrue(cfg.placeEnabled);

        cfg.footstepEnabled = false;
        assertFalse(ParticleTrailManager.getConfig(testUuid).footstepEnabled);
    }
}
