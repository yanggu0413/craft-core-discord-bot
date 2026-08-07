package com.craftcore;

import com.craftcore.api.LangManager;
import com.craftcore.api.RebrandEngine;
import com.craftcore.util.FabricPathUtil;
import net.minecraft.network.chat.Component;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

public class LangManagerTest {

    @TempDir
    Path tempDir;

    @BeforeEach
    public void setUp() {
        FabricPathUtil.setCustomConfigDir(tempDir);
        RebrandEngine.update("Craft-Core", "[&6%server_name%&r] ");
        LangManager.clear();
    }

    @Test
    public void testLoadPopulatesDefaultsAndSaves() {
        Path langPath = tempDir.resolve("craft-core").resolve("lang.json");
        assertFalse(langPath.toFile().exists());

        LangManager.load(langPath);

        assertTrue(langPath.toFile().exists());
        String title = LangManager.get("menu.main.title");
        assertTrue(title.contains("Craft-Core"));
        assertTrue(title.contains("§b"));
    }

    @Test
    public void testGetWithArguments() {
        LangManager.put("test.greeting", "Hello %s, balance is $%d!");
        String formatted = LangManager.get("test.greeting", "Alice", 500);
        assertEquals("Hello Alice, balance is $500!", formatted);
    }

    @Test
    public void testGetWithPositionalArgsFallback() {
        LangManager.put("test.positional", "Item {0} cost {1} coins");
        String formatted = LangManager.get("test.positional", "Diamond", 100);
        assertEquals("Item Diamond cost 100 coins", formatted);
    }

    @Test
    public void testGetText() {
        LangManager.put("test.key", "&aSuccess message");
        Component text = LangManager.getText("test.key");
        assertNotNull(text);
        assertEquals("§aSuccess message", text.getString());
    }

    @Test
    public void testMissingKeyFallback() {
        String result = LangManager.get("non.existent.key");
        assertEquals("non.existent.key", result);
    }
}
