package com.craftcore.menu;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreMenuMod implements ModInitializer {
    @Override
    public void onInitialize() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            MenuCommand.register(dispatcher);
        });
        System.out.println("[Craft-Core Menu] Initialized Central Hub GUI framework (/menu).");
    }
}
