package com.craftcore.commands;

import com.craftcore.check.CheckManager;
import com.craftcore.economy.EconomyManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.DoubleArgumentType;
import com.mojang.brigadier.context.CommandContext;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.item.ItemStack;

public class CheckCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("check")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    CheckManager.openCheckMenu(player);
                    return 1;
                })
                .then(Commands.literal("write")
                        .then(Commands.argument("amount", DoubleArgumentType.doubleArg(10.0, 1000000000.0))
                                .executes(CheckCommand::executeWrite)
                        )
                )
                .then(Commands.argument("amount", DoubleArgumentType.doubleArg(10.0, 1000000000.0))
                        .executes(CheckCommand::executeWrite)
                )
        );

        dispatcher.register(Commands.literal("cheque")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    CheckManager.openCheckMenu(player);
                    return 1;
                })
                .then(Commands.argument("amount", DoubleArgumentType.doubleArg(10.0, 1000000000.0))
                        .executes(CheckCommand::executeWrite)
                )
        );
    }

    private static int executeWrite(CommandContext<CommandSourceStack> context) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) {
            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
            return 0;
        }

        double amount = DoubleArgumentType.getDouble(context, "amount");
        amount = EconomyManager.round2(amount);

        if (amount < 10.0) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 支票最小開立金額為 $10 元！"));
            player.playSound(SoundEvents.VILLAGER_NO, 1.0f, 1.0f);
            return 0;
        }

        String username = player.getName().getString();
        double balance = EconomyManager.getBalance(username);

        if (balance < amount) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您的帳戶餘額不足！無法開立 $" + String.format("%.2f", amount) + " 元的支票。"));
            player.playSound(SoundEvents.VILLAGER_NO, 1.0f, 1.0f);
            return 0;
        }

        if (EconomyManager.removeMoney(username, amount)) {
            ItemStack checkItem = CheckManager.createCheckItem(username, amount);
            player.getInventory().placeItemBackInInventory(checkItem);
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功開立 $" + String.format("%.2f", amount) + " 元整之銀行支票！已放入您的背包。"));
            player.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
            return 1;
        } else {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 開立支票失敗，發生未知錯誤。"));
            return 0;
        }
    }
}
