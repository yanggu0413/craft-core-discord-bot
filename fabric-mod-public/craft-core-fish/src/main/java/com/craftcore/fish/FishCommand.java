package com.craftcore.fish;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
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
                .then(Commands.literal("rod")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                FishingContestManager.checkAndGiveStarterRod(player);
                            }
                            return 1;
                        })
                )
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
                                FishSellManager.openFishSellBin(player);
                            }
                            return 1;
                        })
                        .then(Commands.literal("hand")
                                .executes(context -> {
                                    ServerPlayer player = context.getSource().getPlayer();
                                    if (player != null) {
                                        FishSellManager.sellHandheldFish(player);
                                    }
                                    return 1;
                                })
                        )
                        .then(Commands.literal("all")
                                .executes(context -> {
                                    ServerPlayer player = context.getSource().getPlayer();
                                    if (player != null) {
                                        FishSellManager.sellAllInventoryFish(player);
                                    }
                                    return 1;
                                })
                        )
                )
                .then(Commands.literal("codex")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                FishCodexManager.openCodexGui(player);
                            }
                            return 1;
                        })
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
