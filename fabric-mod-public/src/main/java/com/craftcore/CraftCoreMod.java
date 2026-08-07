package com.craftcore;

import com.craftcore.commands.ModCommands;
import com.craftcore.config.ConfigManager;
import com.craftcore.event.ServerLifecycleHandler;
import net.fabricmc.api.ModInitializer;

public class CraftCoreMod implements ModInitializer {

    @Override
    public void onInitialize() {
        System.out.println("[CraftCore] Initializing Mod...");
        ConfigManager.loadConfig();
        ConfigManager.loadPlayers();
        ServerLifecycleHandler.register();
        ModCommands.register();
        com.craftcore.task.SidebarManager.register();
        com.craftcore.teleport.TeleportRequestManager.registerEvents();
        com.craftcore.afk.AfkManager.registerEvents();
        com.craftcore.task.DailyTaskManager.registerEvents();
        com.craftcore.claim.ClaimManager.registerEvents();
        com.craftcore.pvp.PvpManager.loadConfig();
        com.craftcore.event.CheckEventHandler.register();
        com.craftcore.achievement.CustomAchievementManager.register();
    }
}
