package com.craftcore.checkin;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreCheckinMod implements ModInitializer {

    @Override
    public void onInitialize() {
        System.out.println("[CraftCoreCheckin] Initializing Craft-Core CheckIn Module...");
        CheckInManager.load();
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            CheckInCommand.register(dispatcher);
        });
    }
}
