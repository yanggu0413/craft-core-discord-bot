package com.craftcore.tpa;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreTpaMod implements ModInitializer {
    @Override
    public void onInitialize() {
        System.out.println("[CraftCore-TPA] Initializing TPA Module...");
        TeleportRequestManager.registerEvents();
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            TpaCommand.register(dispatcher);
        });
    }
}
