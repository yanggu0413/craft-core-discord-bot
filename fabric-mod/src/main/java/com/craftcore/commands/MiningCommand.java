package com.craftcore.commands;

import com.craftcore.mining.MiningDimensionManager;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public class MiningCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("mining")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        MiningDimensionManager.randomTeleportToMiningDimension(player);
                    }
                    return 1;
                })
                .then(Commands.literal("reset")
                        .requires(source -> source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                        .executes(context -> {
                            MiningDimensionManager.evacuatePlayers(context.getSource().getServer());
                            context.getSource().getServer().getPlayerList().broadcastSystemMessage(Component.literal("§6[資源世界重置] 管理員已完成資源世界全服安全撤離與重置刷新！"), false);
                            return 1;
                        })
                )
        );

        dispatcher.register(Commands.literal("resource")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        MiningDimensionManager.randomTeleportToMiningDimension(player);
                    }
                    return 1;
                })
        );
    }
}
