package com.craftcore.spawn;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.Permissions;

public class SpawnCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("spawn")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        SpawnManager.teleportToSpawn(player);
                    }
                    return 1;
                })
        );

        dispatcher.register(Commands.literal("setspawn")
                .requires(source -> source.permissions().hasPermission(Permissions.COMMANDS_OWNER))
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        SpawnManager.setSpawn(player);
                    }
                    return 1;
                })
        );
    }
}
