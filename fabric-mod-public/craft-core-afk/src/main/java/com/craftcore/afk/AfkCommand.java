package com.craftcore.afk;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public class AfkCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("afk")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) {
                        context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                        return 0;
                    }
                    AfkManager.toggleAfk(player);
                    return 1;
                })
        );
    }
}
