package com.craftcore.checkin;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.server.level.ServerPlayer;

public class CheckInCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("checkin")
            .executes(context -> {
                ServerPlayer player = context.getSource().getPlayer();
                if (player == null) return 0;
                new CheckInGui().open(player);
                return 1;
            })
            .then(Commands.literal("claim")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    CheckInManager.performCheckIn(player);
                    return 1;
                })
            )
            .then(Commands.literal("gui")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    new CheckInGui().open(player);
                    return 1;
                })
            )
        );
    }
}
