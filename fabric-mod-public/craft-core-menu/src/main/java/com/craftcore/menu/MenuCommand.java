package com.craftcore.menu;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public class MenuCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        // /menu
        dispatcher.register(Commands.literal("menu")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) {
                        context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                        return 0;
                    }
                    MenuGuiManager.openMainMenu(player);
                    return 1;
                })
        );

        // /m (alias for /menu)
        dispatcher.register(Commands.literal("m")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    MenuGuiManager.openMainMenu(player);
                    return 1;
                })
        );

        // /cd (alias for 菜單)
        dispatcher.register(Commands.literal("cd")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    MenuGuiManager.openMainMenu(player);
                    return 1;
                })
        );
    }
}
