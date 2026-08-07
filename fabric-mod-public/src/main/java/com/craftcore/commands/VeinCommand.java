package com.craftcore.commands;

import com.craftcore.vein.VeinMinerManager;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public class VeinCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("vein")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        VeinMinerManager.openVeinGui(player);
                    }
                    return 1;
                })
                .then(Commands.literal("tree")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                VeinMinerManager.PlayerVeinConfig config = VeinMinerManager.getConfig(player.getUUID());
                                config.treeFellerEnabled = !config.treeFellerEnabled;
                                player.sendSystemMessage(Component.literal("§b[連鎖挖掘] 已切換連鎖砍樹為: " + (config.treeFellerEnabled ? "§a[開啟]" : "§c[關閉]")));
                            }
                            return 1;
                        })
                )
                .then(Commands.literal("mine")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                VeinMinerManager.PlayerVeinConfig config = VeinMinerManager.getConfig(player.getUUID());
                                config.veinMinerEnabled = !config.veinMinerEnabled;
                                player.sendSystemMessage(Component.literal("§b[連鎖挖掘] 已切換連鎖採礦為: " + (config.veinMinerEnabled ? "§a[開啟]" : "§c[關閉]")));
                            }
                            return 1;
                        })
                )
                .then(Commands.literal("toggle")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                VeinMinerManager.PlayerVeinConfig config = VeinMinerManager.getConfig(player.getUUID());
                                boolean newState = !config.veinMinerEnabled;
                                config.veinMinerEnabled = newState;
                                config.treeFellerEnabled = newState;
                                player.sendSystemMessage(Component.literal("§b[連鎖挖掘] 已切換連鎖砍樹與採礦為: " + (newState ? "§a[全開啟]" : "§c[全關閉]")));
                            }
                            return 1;
                        })
                )
        );

        dispatcher.register(Commands.literal("treefeller")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        VeinMinerManager.openVeinGui(player);
                    }
                    return 1;
                })
        );
    }
}
