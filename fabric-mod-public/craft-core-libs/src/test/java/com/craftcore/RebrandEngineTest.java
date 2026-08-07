package com.craftcore;

import com.craftcore.api.RebrandEngine;
import net.minecraft.network.chat.Component;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class RebrandEngineTest {

    @BeforeEach
    public void setUp() {
        RebrandEngine.update("Craft-Core", "[&6%server_name%&r] ");
    }

    @Test
    public void testDefaultServerNameAndPrefix() {
        assertEquals("Craft-Core", RebrandEngine.getServerName());
        assertEquals("[§6Craft-Core§r]", RebrandEngine.getPrefix().trim());
    }

    @Test
    public void testRebrandServerName() {
        String input = "Welcome to %server_name%!";
        String rebranded = RebrandEngine.rebrand(input);
        assertEquals("Welcome to Craft-Core!", rebranded);
    }

    @Test
    public void testRebrandPrefix() {
        String input = "%prefix% &aHello World";
        String rebranded = RebrandEngine.rebrand(input);
        assertEquals("[§6Craft-Core§r]  §aHello World", rebranded);
    }

    @Test
    public void testUpdateServerNameAndPrefix() {
        RebrandEngine.update("MyCustomServer", "[&b%server_name%&r] ");
        assertEquals("MyCustomServer", RebrandEngine.getServerName());

        String input = "%prefix% &eServer name: %server_name%";
        String rebranded = RebrandEngine.rebrand(input);
        assertEquals("[§bMyCustomServer§r]  §eServer name: MyCustomServer", rebranded);
    }

    @Test
    public void testColorCodeTranslation() {
        String input = "&0&1&2&3&4&5&6&7&8&9&a&b&c&d&e&f&k&l&m&n&o&r";
        String expected = "§0§1§2§3§4§5§6§7§8§9§a§b§c§d§e§f§k§l§m§n§o§r";
        assertEquals(expected, RebrandEngine.translateColorCodes(input));
    }

    @Test
    public void testNullTemplate() {
        assertEquals("", RebrandEngine.rebrand(null));
        assertEquals("", RebrandEngine.translateColorCodes(null));
    }

    @Test
    public void testRebrandText() {
        Component text = RebrandEngine.rebrandText("&aHello %server_name%");
        assertNotNull(text);
        assertEquals("§aHello Craft-Core", text.getString());
    }
}
