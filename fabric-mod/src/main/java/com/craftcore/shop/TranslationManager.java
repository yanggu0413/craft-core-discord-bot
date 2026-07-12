package com.craftcore.shop;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import net.minecraft.locale.Language;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class TranslationManager {
    private static final Map<String, String> TW_TRANSLATIONS = new HashMap<>();
    private static final Map<String, String> CN_TRANSLATIONS = new HashMap<>();

    static {
        loadTranslations("/assets/craftcore/lang/zh_tw.json", TW_TRANSLATIONS);
        loadTranslations("/assets/craftcore/lang/zh_cn.json", CN_TRANSLATIONS);
    }

    public static String getTranslation(String key, String defaultVal) {
        if (TW_TRANSLATIONS.containsKey(key)) {
            return TW_TRANSLATIONS.get(key);
        }
        if (CN_TRANSLATIONS.containsKey(key)) {
            return CN_TRANSLATIONS.get(key);
        }
        return defaultVal;
    }

    private static void loadTranslations(String resourcePath, Map<String, String> targetMap) {
        try {
            InputStream is = TranslationManager.class.getResourceAsStream(resourcePath);
            if (is == null) {
                String relativePath = resourcePath.startsWith("/") ? resourcePath.substring(1) : resourcePath;
                is = TranslationManager.class.getClassLoader().getResourceAsStream(relativePath);
            }
            if (is != null) {
                try (Reader reader = new InputStreamReader(is, StandardCharsets.UTF_8)) {
                    Gson gson = new Gson();
                    Map<String, String> map = gson.fromJson(reader, new TypeToken<Map<String, String>>(){}.getType());
                    if (map != null) {
                        targetMap.putAll(map);
                    }
                }
            } else {
                System.err.println("[TranslationManager] Resource not found: " + resourcePath);
            }
        } catch (Exception e) {
            System.err.println("[TranslationManager] Failed to load translations from " + resourcePath + ": " + e.getMessage());
        }
    }

    public static boolean matches(Object item, String itemKey, String query) {
        if (query == null || query.trim().isEmpty()) {
            return true;
        }

        String lowerQuery = query.toLowerCase().trim();

        // 1. Check Registry ID
        if (itemKey != null) {
            String lowerKey = itemKey.toLowerCase();
            if (lowerKey.contains(lowerQuery)) {
                return true;
            }
            // Check without namespace if namespace is present
            if (lowerKey.contains(":")) {
                String path = lowerKey.substring(lowerKey.indexOf(':') + 1);
                if (path.contains(lowerQuery)) {
                    return true;
                }
            }
        }

        String descriptionId = null;
        if (item != null) {
            try {
                descriptionId = (String) item.getClass().getMethod("getDescriptionId").invoke(item);
            } catch (Throwable t) {
                // Fallback for mock environments
            }
        }

        // Fallback: construct descriptionId from itemKey if descriptionId is null
        if (descriptionId == null && itemKey != null) {
            String namespace = "minecraft";
            String path = itemKey;
            if (itemKey.contains(":")) {
                int colon = itemKey.indexOf(':');
                namespace = itemKey.substring(0, colon);
                path = itemKey.substring(colon + 1);
            }
            String descId1 = "item." + namespace + "." + path;
            String descId2 = "block." + namespace + "." + path;
            String tw1 = TW_TRANSLATIONS.get(descId1);
            if (tw1 != null && tw1.toLowerCase().contains(lowerQuery)) return true;
            String tw2 = TW_TRANSLATIONS.get(descId2);
            if (tw2 != null && tw2.toLowerCase().contains(lowerQuery)) return true;
            String cn1 = CN_TRANSLATIONS.get(descId1);
            if (cn1 != null && cn1.toLowerCase().contains(lowerQuery)) return true;
            String cn2 = CN_TRANSLATIONS.get(descId2);
            if (cn2 != null && cn2.toLowerCase().contains(lowerQuery)) return true;
        }

        // 2. Check English name (loaded by default in server Language class)
        if (descriptionId != null) {
            try {
                String englishName = Language.getInstance().getOrDefault(descriptionId);
                if (englishName != null && englishName.toLowerCase().contains(lowerQuery)) {
                    return true;
                }
            } catch (Throwable t) {
                // Fallback for mock environments
            }

            // 3. Check Chinese translations
            String twTranslation = TW_TRANSLATIONS.get(descriptionId);
            if (twTranslation != null && twTranslation.toLowerCase().contains(lowerQuery)) {
                return true;
            }
            String cnTranslation = CN_TRANSLATIONS.get(descriptionId);
            if (cnTranslation != null && cnTranslation.toLowerCase().contains(lowerQuery)) {
                return true;
            }
        }

        return false;
    }

    public static String getTranslatedName(String itemId) {
        if (itemId == null) {
            return "";
        }
        
        String namespace = "minecraft";
        String path = itemId;
        if (itemId.contains(":")) {
            int colon = itemId.indexOf(':');
            namespace = itemId.substring(0, colon);
            path = itemId.substring(colon + 1);
        }
        
        String descId1 = "item." + namespace + "." + path;
        String descId2 = "block." + namespace + "." + path;
        
        if (TW_TRANSLATIONS.containsKey(descId1)) {
            return TW_TRANSLATIONS.get(descId1);
        }
        if (TW_TRANSLATIONS.containsKey(descId2)) {
            return TW_TRANSLATIONS.get(descId2);
        }
        if (CN_TRANSLATIONS.containsKey(descId1)) {
            return CN_TRANSLATIONS.get(descId1);
        }
        if (CN_TRANSLATIONS.containsKey(descId2)) {
            return CN_TRANSLATIONS.get(descId2);
        }

        // Fallback to formatted English word
        String[] words = path.split("_");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            String word = words[i];
            if (!word.isEmpty()) {
                sb.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
                if (i < words.length - 1) {
                    sb.append(" ");
                }
            }
        }
        return sb.toString();
    }
}
