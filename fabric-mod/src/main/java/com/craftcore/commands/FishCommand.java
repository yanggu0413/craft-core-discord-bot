package com.craftcore.commands;

import com.craftcore.fish.FishingContestManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.Permissions;

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
                .then(Commands.literal("start")
                        .requires(source -> source.permissions().hasPermission(Permissions.COMMANDS_OWNER))
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null && player.level().getServer() != null) {
                                FishingContestManager.startContest(player.level().getServer(), 20);
                            }
                            return 1;
                        })
                        .then(Commands.argument("minutes", IntegerArgumentType.integer(1, 120))
                                .executes(context -> {
                                    int mins = IntegerArgumentType.getInteger(context, "minutes");
                                    ServerPlayer player = context.getSource().getPlayer();
                                    if (player != null && player.level().getServer() != null) {
                                        FishingContestManager.startContest(player.level().getServer(), mins);
                                    }
                                    return 1;
                                })
                        )
                )
                .then(Commands.literal("stop")
                        .requires(source -> source.permissions().hasPermission(Permissions.COMMANDS_OWNER))
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                FishingContestManager.endContest();
                                player.sendSystemMessage(Component.literal("§a[管理員] 已手動強制結束釣魚大賽！"));
                            }
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
