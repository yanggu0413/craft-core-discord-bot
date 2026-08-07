package com.craftcore.commands;

import com.craftcore.pvp.PvpManager;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public class PvpCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("pvp")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    PvpManager.togglePvp(player);
                    return 1;
                })
                .then(Commands.literal("on").executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    PvpManager.setPvpEnabled(player.getName().getString(), true);
                    player.sendSystemMessage(Component.literal("§c[PvP 模式] ⚔️ 你已開啟 PvP 戰鬥模式！"));
                    return 1;
                }))
                .then(Commands.literal("off").executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    PvpManager.setPvpEnabled(player.getName().getString(), false);
                    player.sendSystemMessage(Component.literal("§a[PvP 模式] 🛡️ 你已關閉 PvP 戰鬥模式（安全保護）。"));
                    return 1;
                }))
                .then(Commands.literal("status").executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    boolean enabled = PvpManager.isPvpEnabled(player.getName().getString());
                    if (enabled) {
                        player.sendSystemMessage(Component.literal("§e[PvP 狀態] 目前 PvP 狀態: §c[已開啟 ⚔️]"));
                    } else {
                        player.sendSystemMessage(Component.literal("§e[PvP 狀態] 目前 PvP 狀態: §a[已關閉 🛡️ (受保護模式)]"));
                    }
                    return 1;
                }))
        );
    }
}
