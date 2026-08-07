package com.craftcore.protection.pvp;

import com.craftcore.api.JsonDataStore;
import com.craftcore.api.RebrandEngine;
import com.google.gson.reflect.TypeToken;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class PvpManager {
    private static final Map<String, Boolean> pvpToggles = new ConcurrentHashMap<>();

    static {
        loadConfig();
    }

    public static synchronized void loadConfig() {
        Map<String, Boolean> data = JsonDataStore.loadData("pvp_toggles.json", new TypeToken<Map<String, Boolean>>() {}.getType(), new ConcurrentHashMap<>());
        if (data != null) {
            pvpToggles.clear();
            data.forEach((k, v) -> pvpToggles.put(k.toLowerCase(), v));
        }
    }

    public static synchronized void saveConfig() {
        JsonDataStore.saveDataAsync("pvp_toggles.json", pvpToggles);
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
            player.sendSystemMessage(RebrandEngine.rebrandText("§c[PvP 模式] ⚔️ 你已開啟 PvP 戰鬥模式！現在可以攻擊其他玩家，也會受到其他 PvP 玩家傷害。"));
        } else {
            player.sendSystemMessage(RebrandEngine.rebrandText("§a[PvP 模式] 🛡️ 你已關閉 PvP 戰鬥模式（進入安全保護）。無法攻擊其他玩家，亦免受玩家傷害。"));
        }
        return newState;
    }

    public static void setPvpEnabled(String username, boolean enabled) {
        if (username == null) return;
        pvpToggles.put(username.toLowerCase(), enabled);
        saveConfig();
    }
}
