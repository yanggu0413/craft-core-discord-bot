package com.craftcore.treasure;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public class TreasureCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("treasure")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;

                    String hint = TreasureChestManager.getTreasureRadarHint(player);
                    player.sendSystemMessage(Component.literal(hint));
                    return 1;
                })
                .then(Commands.literal("spawn")
                        .requires(source -> !source.isPlayer() || source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                        .executes(context -> {
                            net.minecraft.server.MinecraftServer server = context.getSource().getServer();
                            TreasureChestManager.spawnWildernessTreasure(server);
                            context.getSource().sendSystemMessage(Component.literal("§b[Craft-Core] §a已手動清除舊寶箱並於地表成功生成全新的野外藏寶箱！"));
                            return 1;
                        })
                )
        );
    }
}
