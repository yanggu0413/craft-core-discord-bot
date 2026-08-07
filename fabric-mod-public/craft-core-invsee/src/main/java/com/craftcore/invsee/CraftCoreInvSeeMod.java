package com.craftcore.invsee;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreInvSeeMod implements ModInitializer {
    @Override
    public void onInitialize() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            InvSeeCommand.register(dispatcher);
        });
        System.out.println("[Craft-Core InvSee] Initialized Inventory & Enderchest Inspector (/invsee).");
    }
}
