package com.craftcore.warp;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreWarpMod implements ModInitializer {
    @Override
    public void onInitialize() {
        System.out.println("[CraftCore-Warp] Initializing Warp Module...");
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            WarpCommand.register(dispatcher);
        });
    }
}
