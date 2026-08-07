package com.craftcore.util;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class UtilTest {

    @Test
    void testFabricPathUtil() {
        Path configDir = FabricPathUtil.getConfigDir();
        assertNotNull(configDir);

        Path craftCoreConfigDir = FabricPathUtil.getCraftCoreConfigDir();
        assertTrue(craftCoreConfigDir.endsWith("craft-core"));

        Path dataDir = FabricPathUtil.getCraftCoreDataDir();
        assertTrue(dataDir.endsWith("data"));
    }

    @Test
    void testTextUtilColorize() {
        String input = "&aHello &bWorld";
        String colorized = TextUtil.colorize(input);
        assertEquals("§aHello §bWorld", colorized);

        String hexInput = "&#FF0000Red Text";
        String hexColorized = TextUtil.colorize(hexInput);
        assertEquals("§x§F§F§0§0§0§0Red Text", hexColorized);

        String stripped = TextUtil.stripColor(hexColorized);
        assertEquals("Red Text", stripped);
        assertFalse(stripped.contains("§x"), "No orphaned §x should remain");
        assertFalse(stripped.contains("§"), "No section sign (§) should remain");
    }

    @Test
    void testTextUtilStripColorHexVariations() {
        // Test uppercase hex section format
        String upperHex = "§x§F§F§0§0§0§0Red Text";
        String strippedUpper = TextUtil.stripColor(upperHex);
        assertEquals("Red Text", strippedUpper);
        assertFalse(strippedUpper.contains("§x"));

        // Test lowercase hex section format
        String lowerHex = "§x§f§f§0§0§0§0Green Text";
        String strippedLower = TextUtil.stripColor(lowerHex);
        assertEquals("Green Text", strippedLower);
        assertFalse(strippedLower.contains("§x"));

        // Test mixed case hex section format
        String mixedHex = "§x§a§B§c§D§e§FBlue Text";
        String strippedMixed = TextUtil.stripColor(mixedHex);
        assertEquals("Blue Text", strippedMixed);
        assertFalse(strippedMixed.contains("§x"));

        // Test multiple color codes & hex in single string
        String complex = "&aTitle &bHeader §x§F§F§9§9§0§0Orange Subtitle §cAlert";
        String strippedComplex = TextUtil.stripColor(complex);
        assertEquals("Title Header Orange Subtitle Alert", strippedComplex);
        assertFalse(strippedComplex.contains("§x"));
        assertFalse(strippedComplex.contains("§"));
    }
}
