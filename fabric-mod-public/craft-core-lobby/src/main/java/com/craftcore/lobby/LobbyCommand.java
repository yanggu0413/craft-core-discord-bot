package com.craftcore.lobby;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.Permissions;

public class LobbyCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("lobby")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        LobbyDimensionManager.teleportToLobby(player);
                    }
                    return 1;
                })
                .then(Commands.literal("setspawn")
                        .requires(source -> source.permissions().hasPermission(Permissions.COMMANDS_OWNER))
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                LobbyDimensionManager.setSpawn(player);
                            }
                            return 1;
                        })
                )
        );

        dispatcher.register(Commands.literal("hub")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        LobbyDimensionManager.teleportToLobby(player);
                    }
                    return 1;
                })
        );
    }
}
