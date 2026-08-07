package com.craftcore.world;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreWorldMod implements ModInitializer {
    @Override
    public void onInitialize() {
        System.out.println("[CraftCore-World] Initializing World Module...");
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            WorldCommand.register(dispatcher);
        });
    }
}
