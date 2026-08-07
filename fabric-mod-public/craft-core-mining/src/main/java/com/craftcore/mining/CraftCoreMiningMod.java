package com.craftcore.mining;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;

public class CraftCoreMiningMod implements ModInitializer {
    @Override
    public void onInitialize() {
        System.out.println("[CraftCore-Mining] Initializing Mining Module...");
        ServerLifecycleEvents.SERVER_STARTED.register(MiningDimensionManager::startLoop);
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            MiningCommand.register(dispatcher);
        });
    }
}
