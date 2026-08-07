package com.craftcore.back;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.entity.event.v1.ServerPlayerEvents;

public class CraftCoreBackMod implements ModInitializer {
    @Override
    public void onInitialize() {
        System.out.println("[CraftCore-Back] Initializing Back Module...");
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            BackCommand.register(dispatcher);
        });

        ServerPlayerEvents.AFTER_RESPAWN.register((oldPlayer, newPlayer, alive) -> {
            BackManager.recordLocation(oldPlayer);
        });
    }
}
