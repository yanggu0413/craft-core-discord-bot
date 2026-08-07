package com.craftcore.economy;

import com.craftcore.api.EconomyAPI;
import com.craftcore.check.CheckManager;
import com.craftcore.commands.CheckCommand;
import com.craftcore.commands.EconomyCommands;
import com.craftcore.event.CheckEventHandler;
import com.craftcore.gui.MenuRegistry;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.network.chat.Component;
import net.minecraft.world.SimpleMenuProvider;

public class CraftCoreEconomyMod implements ModInitializer {
    @Override
    public void onInitialize() {
        // 1. Register SPI Provider for EconomyAPI
        EconomyAPI.registerProvider(new EconomyServiceImpl());

        // 2. Register Menu Actions in MenuRegistry
        MenuRegistry.registerAction("economy:check", (player, args) -> CheckManager.openCheckMenu(player));
        MenuRegistry.registerAction("economy:top", (player, args) ->
            player.openMenu(new SimpleMenuProvider((syncId, inv, p) -> new EcoTopScreenHandler(syncId, inv), Component.literal("富豪排行榜")))
        );

        // 3. Register Commands
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            EconomyCommands.register(dispatcher);
            CheckCommand.register(dispatcher);
        });

        // 4. Register Event Handlers
        CheckEventHandler.register();

        System.out.println("[Craft-Core-Economy] Sub-module initialized successfully!");
    }
}
