package com.craftcore.task;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.server.level.ServerPlayer;

public class TaskCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("task")
            .executes(context -> {
                ServerPlayer player = context.getSource().getPlayer();
                if (player == null) return 0;
                AiDailyTaskManager.openTaskGui(player);
                return 1;
            })
            .then(Commands.literal("greeting")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    DailyTaskManager.displayGreetingCard(player, false, 0);
                    return 1;
                })
            )
            .then(Commands.literal("gui")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    AiDailyTaskManager.openTaskGui(player);
                    return 1;
                })
            )
        );

        dispatcher.register(Commands.literal("tasks")
            .executes(context -> {
                ServerPlayer player = context.getSource().getPlayer();
                if (player == null) return 0;
                AiDailyTaskManager.openTaskGui(player);
                return 1;
            })
        );
    }
}
