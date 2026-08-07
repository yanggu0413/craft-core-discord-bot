package com.craftcore.util;

import net.minecraft.network.chat.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class TextUtil {
    private static final Pattern HEX_PATTERN = Pattern.compile("&#([A-Fa-f0-9]{6})");

    public static String colorize(String text) {
        if (text == null) return "";

        Matcher matcher = HEX_PATTERN.matcher(text);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String hex = matcher.group(1);
            String replacement = "§x§" + hex.charAt(0) + "§" + hex.charAt(1)
                    + "§" + hex.charAt(2) + "§" + hex.charAt(3) + "§" + hex.charAt(4) + "§" + hex.charAt(5);
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);

        char[] b = sb.toString().toCharArray();
        for (int i = 0; i < b.length - 1; i++) {
            if (b[i] == '&' && "0123456789abcdefklmnorABCDEFKLMNOR".indexOf(b[i + 1]) > -1) {
                b[i] = '§';
                b[i + 1] = Character.toLowerCase(b[i + 1]);
            }
        }
        return new String(b);
    }

    public static String rebrand(String text) {
        if (text == null) return "";
        try {
            Class<?> clazz = Class.forName("com.craftcore.api.RebrandEngine");
            Object result = clazz.getMethod("rebrand", String.class).invoke(null, text);
            if (result instanceof String s) {
                return s;
            }
        } catch (Throwable ignored) {
        }
        return text.replace("%server_name%", "Craft-Core").replace("%prefix%", "[§6Craft-Core§r] ");
    }

    public static Component parse(String text) {
        if (text == null) return Component.empty();
        String rebranded = rebrand(text);
        String colorized = colorize(rebranded);
        return Component.literal(colorized);
    }

    public static Component parse(String template, Object... args) {
        if (template == null) return Component.empty();
        String formatted = template;
        if (args != null && args.length > 0) {
            try {
                formatted = String.format(template, args);
            } catch (Throwable ignored) {
            }
        }
        return parse(formatted);
    }

    public static String stripColor(String text) {
        if (text == null) return "";
        return text.replaceAll("(?i)§x(§[0-9A-F]){6}", "").replaceAll("(?i)[§&][0-9A-FK-OR]", "");
    }
}
