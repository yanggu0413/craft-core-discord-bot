package com.craftcore.treasure;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;

public class CraftCoreTreasureMod implements ModInitializer {
    @Override
    public void onInitialize() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            TreasureCommand.register(dispatcher);
        });

        ServerLifecycleEvents.SERVER_STARTED.register(server -> {
            TreasureChestManager.startLoop(server);
        });

        System.out.println("[Craft-Core Treasure] Initialized Wilderness Treasure Radar (/treasure).");
    }
}
