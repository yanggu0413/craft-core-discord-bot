package com.craftcore.fakeplayer;

import com.craftcore.data.AsyncSaveExecutor;
import com.craftcore.util.FabricPathUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class FakePlayerManagerTest {

    @TempDir
    Path tempFolder;

    @BeforeEach
    public void setUp() {
        FabricPathUtil.setCustomConfigDir(tempFolder);
        FakePlayerManager.load();
    }

    @Test
    public void testRegisterAndGetOwner() {
        FakePlayerManager.register("fp_bot1", "PlayerOne");
        AsyncSaveExecutor.flush();

        assertEquals("PlayerOne", FakePlayerManager.getOwner("fp_bot1"));
        assertEquals("PlayerOne", FakePlayerManager.getOwner("FP_BOT1"));

        Map<String, String> allBots = FakePlayerManager.getAllFakePlayers();
        assertTrue(allBots.containsKey("fp_bot1"));
        assertEquals("PlayerOne", allBots.get("fp_bot1"));
    }

    @Test
    public void testUnregister() {
        FakePlayerManager.register("fp_bot2", "PlayerTwo");
        AsyncSaveExecutor.flush();

        assertNotNull(FakePlayerManager.getOwner("fp_bot2"));

        FakePlayerManager.unregister("fp_bot2");
        AsyncSaveExecutor.flush();

        assertNull(FakePlayerManager.getOwner("fp_bot2"));
    }

    @Test
    public void testPersistenceAcrossReload() {
        FakePlayerManager.register("fp_bot3", "PlayerThree", true);
        AsyncSaveExecutor.flush();

        FakePlayerManager.load();

        assertEquals("PlayerThree", FakePlayerManager.getOwner("fp_bot3"));
        Map<String, FakePlayerManager.FakePlayerEntry> entries = FakePlayerManager.getFakePlayerEntries();
        assertTrue(entries.containsKey("fp_bot3"));
        assertTrue(entries.get("fp_bot3").enabled);
    }

    @Test
    public void testSetBotEnabled() {
        FakePlayerManager.setBotEnabled("fp_bot4", "PlayerFour", false);
        AsyncSaveExecutor.flush();

        Map<String, FakePlayerManager.FakePlayerEntry> entries = FakePlayerManager.getFakePlayerEntries();
        assertTrue(entries.containsKey("fp_bot4"));
        assertFalse(entries.get("fp_bot4").enabled);
        assertEquals("PlayerFour", entries.get("fp_bot4").owner);
    }
}
