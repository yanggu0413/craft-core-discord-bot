package com.craftcore.claim;

import com.craftcore.gui.MenuRegistry;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreClaimsMod implements ModInitializer {
    @Override
    public void onInitialize() {
        System.out.println("[CraftCore-Claims] Initializing Land Claims Sub-Module v2.5.8...");

        ClaimManager.load();
        ClaimManager.loadHudPrefs();
        ClaimManager.registerEvents();
        ClaimProtectionListener.register();

        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            ClaimCommand.register(dispatcher);
        });

        MenuRegistry.registerAction("claim_menu", (player, arg) -> {
            ClaimGuiManager.openClaimMenu(player);
        });
        MenuRegistry.registerAction("claims:open", (player, arg) -> {
            ClaimGuiManager.openClaimMenu(player);
        });
    }
}
