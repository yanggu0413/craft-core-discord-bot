package com.craftcore;

import com.craftcore.api.RebrandEngine;
import com.craftcore.config.ConfigManager;
import com.craftcore.config.ModConfig;
import com.craftcore.util.FabricPathUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

public class ConfigManagerTest {

    @TempDir
    Path tempDir;

    @BeforeEach
    public void setUp() {
        FabricPathUtil.setCustomConfigDir(tempDir);
        ConfigManager.reset();
        RebrandEngine.update("Craft-Core", "[&6%server_name%&r] ");
    }

    @Test
    public void testLoadConfigCreatesDefaultAndUpdatesRebrandEngine() {
        Path configPath = tempDir.resolve("craft-core").resolve("config.json");
        assertFalse(Files.exists(configPath));

        ConfigManager.loadConfig();

        assertTrue(Files.exists(configPath));
        ModConfig config = ConfigManager.getConfig();
        assertNotNull(config);
        assertEquals("Craft-Core", config.server_name);
        assertEquals("Craft-Core", RebrandEngine.getServerName());
    }

    @Test
    public void testSaveAndReloadConfig() {
        ConfigManager.loadConfig();
        ModConfig config = ConfigManager.getConfig();
        config.server_name = "SuperServer";
        config.prefix = "[&a%server_name%&r] ";
        ConfigManager.saveConfig();

        // Reload config
        ConfigManager.reload();
        assertEquals("SuperServer", ConfigManager.getConfig().server_name);
        assertEquals("SuperServer", RebrandEngine.getServerName());
        assertEquals("[§aSuperServer§r] ", RebrandEngine.getPrefix());
    }
}
