package com.craftcore.util;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

public class PlayerUtil {

    public static ServerPlayer getPlayerCaseInsensitive(MinecraftServer server, String username) {
        if (username == null || username.trim().isEmpty()) return null;
        String cleanTarget = username.trim().replaceFirst("^\\.", "");
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            String pName = p.getName().getString();
            if (pName.equalsIgnoreCase(username)) {
                return p;
            }
            if (pName.replaceFirst("^\\.", "").equalsIgnoreCase(cleanTarget)) {
                return p;
            }
            if (p.getGameProfile() != null && p.getGameProfile().name() != null) {
                String profName = p.getGameProfile().name();
                if (profName.equalsIgnoreCase(username) || profName.replaceFirst("^\\.", "").equalsIgnoreCase(cleanTarget)) {
                    return p;
                }
            }
        }
        return null;
    }
}
