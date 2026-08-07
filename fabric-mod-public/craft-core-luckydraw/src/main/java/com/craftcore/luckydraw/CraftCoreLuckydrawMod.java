package com.craftcore.luckydraw;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreLuckydrawMod implements ModInitializer {

    @Override
    public void onInitialize() {
        System.out.println("[CraftCoreLuckydraw] Initializing Craft-Core LuckyDraw Module...");
        LuckyDrawManager.load();
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            LuckyDrawCommand.register(dispatcher);
        });
    }
}
