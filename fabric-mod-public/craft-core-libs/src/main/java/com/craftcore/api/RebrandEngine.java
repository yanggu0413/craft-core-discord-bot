package com.craftcore.api;

import net.minecraft.network.chat.Component;

public class RebrandEngine {
    private static volatile String serverName = "Craft-Core";
    private static volatile String rawPrefix = "[&6%server_name%&r] ";

    public static void update(String newServerName, String newPrefix) {
        if (newServerName != null && !newServerName.trim().isEmpty()) {
            serverName = newServerName;
        }
        if (newPrefix != null) {
            rawPrefix = newPrefix;
        }
    }

    public static String getServerName() {
        return serverName;
    }

    public static String getPrefix() {
        return rebrand(rawPrefix);
    }

    /**
     * Replaces %server_name%, %prefix%, and translates color codes (& to §).
     */
    public static String rebrand(String template) {
        if (template == null) {
            return "";
        }
        String currentServerName = serverName != null ? serverName : "Craft-Core";
        String result = template.replace("%server_name%", currentServerName);
        if (result.contains("%prefix%")) {
            String currentPrefix = rawPrefix != null ? rawPrefix : "[&6%server_name%&r] ";
            String formattedPrefix = currentPrefix.replace("%server_name%", currentServerName);
            result = result.replace("%prefix%", formattedPrefix);
        }
        return translateColorCodes(result);
    }

    /**
     * Converts formatted string into Minecraft Component.
     */
    public static Component rebrandText(String template) {
        return Component.literal(rebrand(template));
    }

    /**
     * Converts standard & color codes (0-9, a-f, k-o, r) to § formatting.
     */
    public static String translateColorCodes(String text) {
        if (text == null) {
            return "";
        }
        char[] b = text.toCharArray();
        for (int i = 0; i < b.length - 1; i++) {
            if (b[i] == '&' && "0123456789abcdefklmnorABCDEFKLMNOR".indexOf(b[i + 1]) > -1) {
                b[i] = '§';
                b[i + 1] = Character.toLowerCase(b[i + 1]);
            }
        }
        return new String(b);
    }
}
