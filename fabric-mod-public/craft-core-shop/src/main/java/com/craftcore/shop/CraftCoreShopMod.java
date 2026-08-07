package com.craftcore.shop;

import com.craftcore.gui.MenuRegistry;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.minecraft.server.MinecraftServer;

public class CraftCoreShopMod implements ModInitializer {
    public static MinecraftServer serverInstance;

    @Override
    public void onInitialize() {
        ServerLifecycleEvents.SERVER_STARTING.register(server -> serverInstance = server);
        ServerLifecycleEvents.SERVER_STOPPING.register(server -> serverInstance = null);

        ChestShopEventHandler.register();
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> ShopCommand.register(dispatcher));

        MenuRegistry.registerAction("shop:open", (player, args) -> ShopGuiManager.openShopList(player));
        MenuRegistry.registerAction("shop:owner", (player, args) -> ShopGuiManager.openOwnerShopList(player));
        MenuRegistry.registerAction("shop:search", (player, args) -> ShopGuiManager.openFilteredShopList(player, args));
    }
}
