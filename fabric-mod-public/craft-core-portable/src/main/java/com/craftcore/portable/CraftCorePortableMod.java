package com.craftcore.portable;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCorePortableMod implements ModInitializer {
    @Override
    public void onInitialize() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            PortableCommand.register(dispatcher);
        });
        System.out.println("[Craft-Core Portable] Initialized Portable menus (/workbench, /enderchest, /wastebin).");
    }
}
