package com.craftcore.afk;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreAfkMod implements ModInitializer {
    @Override
    public void onInitialize() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            AfkCommand.register(dispatcher);
        });

        AfkManager.registerEvents();

        System.out.println("[Craft-Core AFK] Initialized AFK movement detection (/afk).");
    }
}
