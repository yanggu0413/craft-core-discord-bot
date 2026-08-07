package com.craftcore.backup;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;

public class CraftCoreBackupMod implements ModInitializer {
    @Override
    public void onInitialize() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            BackupCommand.register(dispatcher);
        });

        ServerLifecycleEvents.SERVER_STARTED.register(server -> {
            BackupManager.startAutoBackupLoop(server);
        });

        ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
            BackupManager.stopAutoBackupLoop();
        });

        System.out.println("[Craft-Core Backup] Initialized Auto-Backup system (/backup).");
    }
}
