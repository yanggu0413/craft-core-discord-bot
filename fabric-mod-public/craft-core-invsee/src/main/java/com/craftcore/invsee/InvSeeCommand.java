package com.craftcore.invsee;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.Permissions;

import java.util.HashSet;
import java.util.Set;

public class InvSeeCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("invsee")
                .then(Commands.argument("target", StringArgumentType.word())
                        .suggests((context, builder) -> {
                            Set<String> candidates = new HashSet<>();
                            var server = context.getSource().getServer();
                            if (server != null) {
                                for (ServerPlayer p : server.getPlayerList().getPlayers()) {
                                    candidates.add(p.getName().getString());
                                }
                            }
                            return SharedSuggestionProvider.suggest(candidates, builder);
                        })
                        .executes(context -> {
                            ServerPlayer viewer = context.getSource().getPlayer();
                            if (viewer == null) {
                                context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                                return 0;
                            }

                            String targetName = StringArgumentType.getString(context, "target").trim();
                            boolean isOp = viewer.createCommandSourceStack().permissions().hasPermission(Permissions.COMMANDS_OWNER);

                            if (!isOp) {
                                viewer.sendSystemMessage(Component.literal("§c[Craft-Core] 權限不足：只有管理員/OP 才能查看其他玩家的背包！"));
                                return 0;
                            }

                            InvSeeManager.openInvSeeGui(viewer, targetName);
                            return 1;
                        })
                )
        );

        dispatcher.register(Commands.literal("endersee")
                .then(Commands.argument("target", StringArgumentType.word())
                        .suggests((context, builder) -> {
                            Set<String> candidates = new HashSet<>();
                            var server = context.getSource().getServer();
                            if (server != null) {
                                for (ServerPlayer p : server.getPlayerList().getPlayers()) {
                                    candidates.add(p.getName().getString());
                                }
                            }
                            return SharedSuggestionProvider.suggest(candidates, builder);
                        })
                        .executes(context -> {
                            ServerPlayer viewer = context.getSource().getPlayer();
                            if (viewer == null) return 0;
                            boolean isOp = viewer.createCommandSourceStack().permissions().hasPermission(Permissions.COMMANDS_OWNER);
                            if (!isOp) {
                                viewer.sendSystemMessage(Component.literal("§c[Craft-Core] 權限不足：只有管理員/OP 才能查看其他玩家的末影箱！"));
                                return 0;
                            }
                            String targetName = StringArgumentType.getString(context, "target").trim();
                            InvSeeManager.openInvSeeGui(viewer, targetName);
                            return 1;
                        })
                )
        );
    }
}
