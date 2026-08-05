package com.craftcore;

import com.craftcore.teleport.DimensionLocationManager;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class DimensionLocationManagerTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @Test
    public void testDimPosCreation() {
        DimensionLocationManager.DimPos pos = new DimensionLocationManager.DimPos(100.5, 64.0, -200.5, 90.0f, 0.0f);
        assertEquals(100.5, pos.x);
        assertEquals(64.0, pos.y);
        assertEquals(-200.5, pos.z);
        assertEquals(90.0f, pos.yaw);
        assertEquals(0.0f, pos.pitch);
    }
}
