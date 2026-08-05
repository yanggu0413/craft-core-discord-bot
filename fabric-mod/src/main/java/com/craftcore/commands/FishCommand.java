package com.craftcore.commands;

import com.craftcore.fish.FishingContestManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public class FishCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("fish")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        FishingContestManager.openFishGui(player);
                    }
                    return 1;
                })
                .then(Commands.literal("tp")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                FishingContestManager.teleportToFishingDimension(player);
                            }
                            return 1;
                        })
                )
                .then(Commands.literal("sell")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                com.craftcore.fish.FishSellManager.sellHandheldFish(player);
                            }
                            return 1;
                        })
                        .then(Commands.literal("all")
                                .executes(context -> {
                                    ServerPlayer player = context.getSource().getPlayer();
                                    if (player != null) {
                                        com.craftcore.fish.FishSellManager.sellAllInventoryFish(player);
                                    }
                                    return 1;
                                })
                        )
                )
                .then(Commands.literal("codex")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                com.craftcore.fish.FishCodexManager.openCodexGui(player);
                            }
                            return 1;
                        })
                )
                .then(Commands.literal("party")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                FishingContestManager.openPartyGui(player);
                            }
                            return 1;
                        })
                        .then(Commands.literal("create")
                                .executes(context -> {
                                    ServerPlayer player = context.getSource().getPlayer();
                                    if (player != null) {
                                        FishingContestManager.createPartyMatch(player, 10);
                                    }
                                    return 1;
                                })
                                .then(Commands.argument("minutes", IntegerArgumentType.integer(1, 60))
                                        .executes(context -> {
                                            ServerPlayer player = context.getSource().getPlayer();
                                            int min = IntegerArgumentType.getInteger(context, "minutes");
                                            if (player != null) {
                                                FishingContestManager.createPartyMatch(player, min);
                                            }
                                            return 1;
                                        })
                                )
                        )
                        .then(Commands.literal("join")
                                .then(Commands.argument("host", StringArgumentType.word())
                                        .executes(context -> {
                                            ServerPlayer player = context.getSource().getPlayer();
                                            String host = StringArgumentType.getString(context, "host");
                                            if (player != null) {
                                                FishingContestManager.joinPartyMatch(player, host);
                                            }
                                            return 1;
                                        })
                                )
                        )
                        .then(Commands.literal("start")
                                .executes(context -> {
                                    ServerPlayer player = context.getSource().getPlayer();
                                    if (player != null) {
                                        FishingContestManager.startPartyMatch(player);
                                    }
                                    return 1;
                                })
                        )
                )
                .then(Commands.literal("start")
                        .requires(source -> source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                        .executes(context -> {
                            FishingContestManager.startContest(context.getSource().getServer(), 20);
                            return 1;
                        })
                        .then(Commands.argument("minutes", IntegerArgumentType.integer(1, 120))
                                .executes(context -> {
                                    int min = IntegerArgumentType.getInteger(context, "minutes");
                                    FishingContestManager.startContest(context.getSource().getServer(), min);
                                    return 1;
                                })
                        )
                )
                .then(Commands.literal("stop")
                        .requires(source -> source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                        .executes(context -> {
                            FishingContestManager.stopContest(context.getSource().getServer());
                            return 1;
                        })
                )
        );

        dispatcher.register(Commands.literal("fishing")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        FishingContestManager.openFishGui(player);
                    }
                    return 1;
                })
        );
    }
}
