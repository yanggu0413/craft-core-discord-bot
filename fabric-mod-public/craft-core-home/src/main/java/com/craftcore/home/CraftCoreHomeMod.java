package com.craftcore.home;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreHomeMod implements ModInitializer {
    @Override
    public void onInitialize() {
        System.out.println("[CraftCore-Home] Initializing Home Module...");
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            HomeCommand.register(dispatcher);
        });
    }
}
