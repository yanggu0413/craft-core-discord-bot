package com.craftcore.fakeplayer;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;

public class CraftCoreFakePlayerMod implements ModInitializer {
    @Override
    public void onInitialize() {
        System.out.println("[CraftCore-FakePlayer] Initializing Carpet FakePlayer Sub-Module v2.5.8...");

        FakePlayerManager.load();

        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            FakePlayerCommand.register(dispatcher);
        });

        ServerLifecycleEvents.SERVER_STARTED.register(server -> {
            FakePlayerManager.scheduleAutoReconnect(server);
        });

        ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
            FakePlayerManager.saveAllCurrentPositions(server);
        });
    }
}
