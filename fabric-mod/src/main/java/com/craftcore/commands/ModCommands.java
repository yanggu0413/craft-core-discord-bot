package com.craftcore.commands;

import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class ModCommands {

    public static void register() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            DiscordCommand.register(dispatcher);
            ShopCommand.register(dispatcher);
            ClaimCommand.register(dispatcher);
            TeleportCommands.register(dispatcher);
            EconomyCommands.register(dispatcher);
            FakePlayerCommand.register(dispatcher);
            BackupCommand.register(dispatcher);
        });
    }
}
