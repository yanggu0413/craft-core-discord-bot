package com.craftcore;

import com.craftcore.commands.DiscordCommand;
import com.craftcore.config.ConfigManager;
import com.craftcore.event.ServerLifecycleHandler;
import com.craftcore.websocket.CraftCoreWSClient;
import net.fabricmc.api.ModInitializer;
import net.minecraft.server.MinecraftServer;

public class CraftCoreMod implements ModInitializer {
    private static CraftCoreWSClient wsClient;

    @Override
    public void onInitialize() {
        System.out.println("[CraftCore] Initializing Mod...");
        ConfigManager.loadConfig();
        ConfigManager.loadPlayers();
        ServerLifecycleHandler.register();
        DiscordCommand.register();
        com.craftcore.task.SidebarManager.register();
        com.craftcore.teleport.TeleportRequestManager.registerEvents();
        com.craftcore.afk.AfkManager.registerEvents();
        com.craftcore.task.DailyTaskManager.registerEvents();
        com.craftcore.claim.ClaimManager.registerEvents();
    }

    public static synchronized void startWSClient(MinecraftServer server) {
        if (wsClient == null) {
            wsClient = new CraftCoreWSClient(server);
            wsClient.start();
        }
    }

    public static synchronized void stopWSClient() {
        if (wsClient != null) {
            wsClient.close();
            wsClient = null;
        }
    }

    public static CraftCoreWSClient getWSClient() {
        return wsClient;
    }
}
