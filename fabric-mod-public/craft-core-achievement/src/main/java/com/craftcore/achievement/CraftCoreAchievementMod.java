package com.craftcore.achievement;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreAchievementMod implements ModInitializer {

    @Override
    public void onInitialize() {
        System.out.println("[CraftCoreAchievement] Initializing Craft-Core Achievement Module...");
        CustomAchievementManager.register();
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            AchievementCommand.register(dispatcher);
        });
    }
}
