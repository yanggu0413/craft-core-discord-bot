package com.craftcore.tpa;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public class TpaCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("tpa")
                .then(Commands.literal("cancel")
                        .executes(context -> handleTpaCancelCommand(context, null))
                        .then(Commands.argument("target", StringArgumentType.string())
                                .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                                .executes(context -> handleTpaCancelCommand(context, StringArgumentType.getString(context, "target")))
                        )
                )
                .then(Commands.argument("target", StringArgumentType.string())
                        .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                        .executes(context -> handleTpaCommand(context, false))
                )
        );

        dispatcher.register(Commands.literal("tpahere")
                .then(Commands.argument("target", StringArgumentType.string())
                        .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                        .executes(context -> handleTpaCommand(context, true))
                )
        );

        dispatcher.register(Commands.literal("tpaccept")
                .executes(context -> handleTpAcceptCommand(context, null))
                .then(Commands.argument("target", StringArgumentType.string())
                        .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                        .executes(context -> handleTpAcceptCommand(context, StringArgumentType.getString(context, "target")))
                )
        );

        dispatcher.register(Commands.literal("tpdeny")
                .executes(context -> handleTpDenyCommand(context, null))
                .then(Commands.argument("target", StringArgumentType.string())
                        .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                        .executes(context -> handleTpDenyCommand(context, StringArgumentType.getString(context, "target")))
                )
        );
    }

    private static int handleTpaCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, boolean tpahere) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        String targetName = StringArgumentType.getString(context, "target");
        if (player.level().getServer() == null) return 0;
        ServerPlayer target = player.level().getServer().getPlayerList().getPlayerByName(targetName);

        if (target == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到玩家：" + targetName));
            return 0;
        }

        if (player.getName().getString().equalsIgnoreCase(target.getName().getString())) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您不能對自己發送傳送請求！"));
            return 0;
        }

        TeleportRequestManager.sendRequest(player, target, tpahere ? "tpahere" : "tpa");
        return 1;
    }

    private static int handleTpaCancelCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String target) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;
        TeleportRequestManager.cancelRequest(player, target);
        return 1;
    }

    private static int handleTpAcceptCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String target) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;
        TeleportRequestManager.acceptRequest(player, target);
        return 1;
    }

    private static int handleTpDenyCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String target) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;
        TeleportRequestManager.denyRequest(player, target);
        return 1;
    }
}
