package com.craftcore.util;

import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.Permissions;

public class PermissionUtil {

    public static boolean hasPermission(ServerPlayer player, String permissionNode, int defaultOpLevel) {
        if (player == null) return false;

        // 1. Try Fabric Permissions API / LuckPerms via reflection if available
        try {
            Class<?> permsClass = Class.forName("me.lucko.fabric.api.permissions.v0.Permissions");
            Object result = permsClass.getMethod("check", ServerPlayer.class, String.class, int.class)
                    .invoke(null, player, permissionNode, defaultOpLevel);
            if (result instanceof Boolean b) {
                return b;
            }
        } catch (Throwable ignored) {
        }

        // 2. Fallback to vanilla OP permission check
        try {
            if (defaultOpLevel <= 0) return true;
            return player.createCommandSourceStack().permissions().hasPermission(Permissions.COMMANDS_OWNER);
        } catch (Throwable t) {
            return false;
        }
    }

    public static boolean hasPermission(ServerPlayer player, String permissionNode) {
        return hasPermission(player, permissionNode, 2);
    }

    public static boolean isAdmin(ServerPlayer player) {
        return hasPermission(player, "craftcore.admin", 2);
    }
}
