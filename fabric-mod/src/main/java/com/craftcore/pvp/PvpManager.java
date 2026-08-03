package com.craftcore.pvp;

import com.craftcore.util.AsyncSaveExecutor;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class PvpManager {
    private static final Path FILE_PATH = Paths.get("config", "craft-core-shop", "pvp_toggles.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, Boolean> pvpToggles = new ConcurrentHashMap<>();

    public static void loadConfig() {
        if (!Files.exists(FILE_PATH)) {
            saveConfig();
            return;
        }
        try (BufferedReader reader = Files.newBufferedReader(FILE_PATH)) {
            Map<String, Boolean> data = GSON.fromJson(reader, new TypeToken<Map<String, Boolean>>() {}.getType());
            if (data != null) {
                pvpToggles.clear();
                data.forEach((k, v) -> pvpToggles.put(k.toLowerCase(), v));
            }
        } catch (IOException e) {
            System.err.println("[CraftCore] Failed to load pvp_toggles.json: " + e.getMessage());
        }
    }

    public static void saveConfig() {
        AsyncSaveExecutor.submit(() -> {
            try {
                if (!Files.exists(FILE_PATH.getParent())) {
                    Files.createDirectories(FILE_PATH.getParent());
                }
                try (BufferedWriter writer = Files.newBufferedWriter(FILE_PATH)) {
                    GSON.toJson(pvpToggles, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save pvp_toggles.json: " + e.getMessage());
            }
        });
    }

    public static boolean isPvpEnabled(String username) {
        if (username == null) return false;
        return pvpToggles.getOrDefault(username.toLowerCase(), false); // Default: Disabled (Safe mode)
    }

    public static boolean togglePvp(ServerPlayer player) {
        if (player == null) return false;
        String username = player.getName().getString();
        boolean currentState = isPvpEnabled(username);
        boolean newState = !currentState;
        setPvpEnabled(username, newState);

        if (newState) {
            player.sendSystemMessage(Component.literal("§c[PvP 模式] ⚔️ 你已開啟 PvP 戰鬥模式！現在可以攻擊其他玩家，也會受到其他 PvP 玩家傷害。"));
        } else {
            player.sendSystemMessage(Component.literal("§a[PvP 模式] 🛡️ 你已關閉 PvP 戰鬥模式（進入安全保護）。無法攻擊其他玩家，亦免受玩家傷害。"));
        }
        return newState;
    }

    public static void setPvpEnabled(String username, boolean enabled) {
        if (username == null) return;
        pvpToggles.put(username.toLowerCase(), enabled);
        saveConfig();
    }
}
