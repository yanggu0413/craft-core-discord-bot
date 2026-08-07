package com.craftcore.rtp;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreRtpMod implements ModInitializer {
    @Override
    public void onInitialize() {
        System.out.println("[CraftCore-RTP] Initializing RTP Module...");
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            RtpCommand.register(dispatcher);
        });
    }
}
