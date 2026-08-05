package com.craftcore.commands;

import com.craftcore.fakeplayer.FakePlayerManager;
import com.craftcore.invsee.InvSeeManager;
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
                .executes(context -> {
                    ServerPlayer viewer = context.getSource().getPlayer();
                    if (viewer != null) {
                        com.craftcore.menu.MenuGuiManager.openPlayerSelectorMenu(viewer);
                    }
                    return 1;
                })
                .then(Commands.argument("target", StringArgumentType.word())
                        .suggests((context, builder) -> {
                            Set<String> candidates = new HashSet<>();
                            var server = context.getSource().getServer();
                            if (server != null) {
                                for (ServerPlayer p : server.getPlayerList().getPlayers()) {
                                    candidates.add(p.getName().getString());
                                }
                            }
                            candidates.addAll(FakePlayerManager.getAllFakePlayers().keySet());
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

                            String owner = FakePlayerManager.getOwner(targetName);
                            boolean isFakePlayer = targetName.toLowerCase().startsWith("fp_") || owner != null;

                            if (isFakePlayer) {
                                boolean isOwner = owner != null && owner.equalsIgnoreCase(viewer.getName().getString());
                                if (!isOp && !isOwner) {
                                    viewer.sendSystemMessage(Component.literal("§c[Craft-Core] 權限不足：您只能查看與管理自己召喚的假人背包！"));
                                    return 0;
                                }
                            } else {
                                if (!isOp) {
                                    viewer.sendSystemMessage(Component.literal("§c[Craft-Core] 權限不足：只有管理員/OP 才能查看其他玩家的背包！"));
                                    return 0;
                                }
                            }

                            InvSeeManager.openInvSeeGui(viewer, targetName);
                            return 1;
                        })
                )
        );
    }
}
