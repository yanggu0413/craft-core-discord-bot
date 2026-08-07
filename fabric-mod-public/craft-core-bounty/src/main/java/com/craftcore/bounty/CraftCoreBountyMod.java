package com.craftcore.bounty;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreBountyMod implements ModInitializer {

    @Override
    public void onInitialize() {
        System.out.println("[CraftCoreBounty] Initializing Craft-Core Bounty Module...");
        GlobalGoalManager.load();
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            BountyCommand.register(dispatcher);
        });
    }
}
