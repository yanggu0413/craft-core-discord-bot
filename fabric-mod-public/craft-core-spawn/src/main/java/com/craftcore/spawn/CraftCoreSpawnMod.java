package com.craftcore.spawn;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreSpawnMod implements ModInitializer {
    @Override
    public void onInitialize() {
        System.out.println("[CraftCore-Spawn] Initializing Spawn Module...");
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            SpawnCommand.register(dispatcher);
        });
    }
}
