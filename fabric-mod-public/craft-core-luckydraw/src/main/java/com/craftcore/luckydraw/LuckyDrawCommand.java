package com.craftcore.luckydraw;

import com.craftcore.util.PlayerUtil;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public class LuckyDrawCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        // /luckydraw
        dispatcher.register(Commands.literal("luckydraw")
            .executes(context -> {
                ServerPlayer player = context.getSource().getPlayer();
                if (player == null) return 0;
                new LuckyDrawGui().open(player);
                return 1;
            })
        );

        // /key
        dispatcher.register(Commands.literal("key")
            .executes(context -> {
                ServerPlayer player = context.getSource().getPlayer();
                if (player == null) return 0;
                int keys = LuckyDrawManager.getKeys(player.getName().getString());
                player.sendSystemMessage(Component.literal("§b[Craft-Core] §f您當前擁有的幸運抽獎鑰匙數量為：§e🔑 " + keys + " §f把。"));
                return 1;
            })
            .then(Commands.literal("add")
                .requires(source -> !source.isPlayer() || source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                .then(Commands.argument("player", StringArgumentType.word())
                    .then(Commands.argument("amount", IntegerArgumentType.integer(1))
                        .executes(context -> {
                            String targetName = StringArgumentType.getString(context, "player");
                            int amount = IntegerArgumentType.getInteger(context, "amount");
                            LuckyDrawManager.addKeys(targetName, amount);
                            context.getSource().sendSystemMessage(Component.literal(
                                String.format("§a[Craft-Core] 已成功為玩家 %s 增加 %d 把抽獎鑰匙！", targetName, amount)
                            ));
                            ServerPlayer targetPlayer = PlayerUtil.getPlayerCaseInsensitive(context.getSource().getServer(), targetName);
                            if (targetPlayer != null) {
                                targetPlayer.sendSystemMessage(Component.literal(
                                    String.format("§b[Craft-Core] §a您獲得了管理員給予的 §e%d §a把幸運鑰匙！", amount)
                                ));
                            }
                            return 1;
                        })
                    )
                )
            )
            .then(Commands.literal("remove")
                .requires(source -> !source.isPlayer() || source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                .then(Commands.argument("player", StringArgumentType.word())
                    .then(Commands.argument("amount", IntegerArgumentType.integer(1))
                        .executes(context -> {
                            String targetName = StringArgumentType.getString(context, "player");
                            int amount = IntegerArgumentType.getInteger(context, "amount");
                            LuckyDrawManager.removeKeys(targetName, amount);
                            context.getSource().sendSystemMessage(Component.literal(
                                String.format("§a[Craft-Core] 已成功扣除玩家 %s 的 %d 把抽獎鑰匙！", targetName, amount)
                            ));
                            return 1;
                        })
                    )
                )
            )
            .then(Commands.literal("set")
                .requires(source -> !source.isPlayer() || source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                .then(Commands.argument("player", StringArgumentType.word())
                    .then(Commands.argument("amount", IntegerArgumentType.integer(0))
                        .executes(context -> {
                            String targetName = StringArgumentType.getString(context, "player");
                            int amount = IntegerArgumentType.getInteger(context, "amount");
                            LuckyDrawManager.setKeys(targetName, amount);
                            context.getSource().sendSystemMessage(Component.literal(
                                String.format("§a[Craft-Core] 已成功設定玩家 %s 的抽獎鑰匙數量為 %d 把！", targetName, amount)
                            ));
                            return 1;
                        })
                    )
                )
            )
        );
    }
}
