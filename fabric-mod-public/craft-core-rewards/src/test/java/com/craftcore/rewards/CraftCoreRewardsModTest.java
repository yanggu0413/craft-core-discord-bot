package com.craftcore.rewards;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class CraftCoreRewardsModTest {

    @Test
    public void testModInitialization() {
        CraftCoreRewardsMod mod = new CraftCoreRewardsMod();
        assertNotNull(mod);
    }
}
