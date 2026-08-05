package com.craftcore.commands;

import com.craftcore.trail.ParticleTrailManager;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.server.level.ServerPlayer;

public class TrailCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("trail")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        ParticleTrailManager.openTrailGui(player);
                    }
                    return 1;
                })
        );

        dispatcher.register(Commands.literal("trails")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        ParticleTrailManager.openTrailGui(player);
                    }
                    return 1;
                })
        );
    }
}
