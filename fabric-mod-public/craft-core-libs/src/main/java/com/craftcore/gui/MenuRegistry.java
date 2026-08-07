package com.craftcore.gui;

import com.craftcore.util.TextUtil;
import net.minecraft.server.level.ServerPlayer;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;

public class MenuRegistry {
    private static final Map<String, BiConsumer<ServerPlayer, String>> menuActions = new ConcurrentHashMap<>();

    /**
     * Registers a callback action for a menu ID (e.g. "shop:open", "claims:open", "rewards:open").
     */
    public static void registerAction(String menuId, BiConsumer<ServerPlayer, String> handler) {
        if (menuId != null && handler != null) {
            menuActions.put(menuId.toLowerCase(), handler);
        }
    }

    /**
     * Unregisters a callback action for a menu ID.
     */
    public static void unregisterAction(String menuId) {
        if (menuId != null) {
            menuActions.remove(menuId.toLowerCase());
        }
    }

    /**
     * Executes a registered menu action for a player.
     */
    public static void openMenu(String menuId, ServerPlayer player, String args) {
        if (player == null || menuId == null) return;
        BiConsumer<ServerPlayer, String> handler = menuActions.get(menuId.toLowerCase());
        if (handler != null) {
            try {
                handler.accept(player, args != null ? args : "");
            } catch (Throwable t) {
                player.sendSystemMessage(TextUtil.parse("%prefix% §c開啟選單失敗: " + t.getMessage()));
            }
        } else {
            player.sendSystemMessage(TextUtil.parse("%prefix% §c該功能模組尚未安裝或停用中！ (" + menuId + ")"));
        }
    }

    public static void openMenu(String menuId, ServerPlayer player) {
        openMenu(menuId, player, "");
    }

    public static boolean isRegistered(String menuId) {
        return menuId != null && menuActions.containsKey(menuId.toLowerCase());
    }

    public static void clear() {
        menuActions.clear();
    }
}
