package com.craftcore.protection;

import com.craftcore.protection.command.LockboxCommand;
import com.craftcore.protection.command.PvpCommand;
import com.craftcore.protection.listener.LockboxProtectionListener;
import com.craftcore.protection.lockbox.LockboxManager;
import com.craftcore.protection.pvp.PvpManager;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreProtectionMod implements ModInitializer {

    @Override
    public void onInitialize() {
        System.out.println("[Craft-Core-Protection] Initializing Lockbox & Protection Sub-Module...");

        LockboxManager.load();
        PvpManager.loadConfig();

        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            LockboxCommand.register(dispatcher);
            PvpCommand.register(dispatcher);
        });

        LockboxProtectionListener.register();

        System.out.println("[Craft-Core-Protection] Sub-Module initialized successfully.");
    }
}
