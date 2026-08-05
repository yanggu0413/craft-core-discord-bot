package com.craftcore.commands;

import com.craftcore.express.ExpressGuiManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public class ExpressCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("express")
            .executes(context -> {
                ServerPlayer player = context.getSource().getPlayer();
                if (player == null) {
                    context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                    return 0;
                }
                ExpressGuiManager.openExpressMainMenu(player);
                return 1;
            })
            .then(Commands.literal("inbox")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        ExpressGuiManager.openInboxGui(player);
                        return 1;
                    }
                    return 0;
                })
            )
            .then(Commands.literal("history")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        ExpressGuiManager.openHistoryGui(player);
                        return 1;
                    }
                    return 0;
                })
            )
            .then(Commands.literal("send")
                .then(Commands.argument("recipient", StringArgumentType.word())
                    .suggests((context, builder) -> net.minecraft.commands.SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                    .executes(context -> {
                        ServerPlayer player = context.getSource().getPlayer();
                        if (player != null) {
                            String recipient = StringArgumentType.getString(context, "recipient");
                            ExpressGuiManager.openSendParcelContainer(player, recipient);
                            return 1;
                        }
                        return 0;
                    })
                )
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        ExpressGuiManager.openSendParcelContainer(player, null);
                        return 1;
                    }
                    return 0;
                })
            )
        );
    }
}
