package com.craftcore.commands;

import com.craftcore.task.AiDailyTaskManager;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.server.level.ServerPlayer;

public class TaskCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("task")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        AiDailyTaskManager.openTaskGui(player);
                    }
                    return 1;
                })
        );

        dispatcher.register(Commands.literal("tasks")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        AiDailyTaskManager.openTaskGui(player);
                    }
                    return 1;
                })
        );
    }
}
