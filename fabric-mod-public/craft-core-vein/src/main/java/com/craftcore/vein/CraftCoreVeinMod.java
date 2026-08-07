package com.craftcore.vein;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.minecraft.server.level.ServerPlayer;

public class CraftCoreVeinMod implements ModInitializer {
    @Override
    public void onInitialize() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            VeinCommand.register(dispatcher);
        });

        PlayerBlockBreakEvents.AFTER.register((world, player, pos, state, blockEntity) -> {
            if (!world.isClientSide() && player instanceof ServerPlayer sp) {
                VeinMinerManager.onBlockBreak(sp, pos, state);
            }
        });

        System.out.println("[Craft-Core Vein] Initialized Ore Vein Mining & Tree Feller (/vein).");
    }
}
