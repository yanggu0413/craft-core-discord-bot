package com.craftcore.api;

import com.craftcore.util.FabricPathUtil;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.minecraft.network.chat.Component;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class LangManager {
    private static final Map<String, String> LANG_MAP = new ConcurrentHashMap<>();
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static void load() {
        load(FabricPathUtil.getCraftCoreConfigDir().resolve("lang.json"));
    }

    public static void load(Path langFilePath) {
        LANG_MAP.clear();
        if (Files.exists(langFilePath)) {
            try (BufferedReader reader = Files.newBufferedReader(langFilePath)) {
                Map<String, String> loaded = GSON.fromJson(reader, new TypeToken<Map<String, String>>(){}.getType());
                if (loaded != null) {
                    LANG_MAP.putAll(loaded);
                }
            } catch (Exception e) {
                System.err.println("[CraftCore-Libs] Failed to load lang.json: " + e.getMessage());
            }
        } else {
            populateDefaults();
            save(langFilePath);
        }
    }

    public static void save() {
        save(FabricPathUtil.getCraftCoreConfigDir().resolve("lang.json"));
    }

    public static void save(Path langFilePath) {
        try {
            if (langFilePath.getParent() != null) {
                Files.createDirectories(langFilePath.getParent());
            }
            try (BufferedWriter writer = Files.newBufferedWriter(langFilePath)) {
                GSON.toJson(LANG_MAP, writer);
            }
        } catch (Exception e) {
            System.err.println("[CraftCore-Libs] Failed to save lang.json: " + e.getMessage());
        }
    }

    public static String get(String key, Object... args) {
        String template = LANG_MAP.getOrDefault(key, key);
        if (args != null && args.length > 0) {
            if (template.contains("{0}") || template.contains("{1}") || template.contains("{2}")) {
                for (int i = 0; i < args.length; i++) {
                    template = template.replace("{" + i + "}", String.valueOf(args[i]));
                }
            } else {
                try {
                    template = String.format(template, args);
                } catch (Exception ignored) {
                    for (int i = 0; i < args.length; i++) {
                        template = template.replace("{" + i + "}", String.valueOf(args[i]));
                    }
                }
            }
        }
        return RebrandEngine.rebrand(template);
    }

    public static Component getText(String key, Object... args) {
        return Component.literal(get(key, args));
    }

    public static void put(String key, String value) {
        LANG_MAP.put(key, value);
    }

    public static Map<String, String> getAll() {
        return LANG_MAP;
    }

    public static void clear() {
        LANG_MAP.clear();
    }

    private static void populateDefaults() {
        LANG_MAP.putIfAbsent("menu.main.title", "§b[ %server_name% 全服選單 ]");
        LANG_MAP.putIfAbsent("shop.market.title", "§e[ %server_name% 玩家市場 - 頁碼 %page%/%total% ]");
        LANG_MAP.putIfAbsent("economy.pay_success", "%prefix% §a成功轉帳 $%amount% 給 %player%");
        LANG_MAP.putIfAbsent("economy.balance_display", "%prefix% 您的當前餘額為: §e$%balance%");
        LANG_MAP.putIfAbsent("claim.created", "%prefix% §a已成功建立領地 §e%claim_name%");
        LANG_MAP.putIfAbsent("general.no_permission", "%prefix% §c您沒有權限執行此指令！");
    }
}
