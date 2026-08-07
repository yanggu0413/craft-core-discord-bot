package com.craftcore.lobby;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;

public class CraftCoreLobbyMod implements ModInitializer {
    @Override
    public void onInitialize() {
        System.out.println("[CraftCore-Lobby] Initializing Lobby Module...");
        ServerLifecycleEvents.SERVER_STARTED.register(LobbyDimensionManager::startLoop);
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            LobbyCommand.register(dispatcher);
        });
    }
}
