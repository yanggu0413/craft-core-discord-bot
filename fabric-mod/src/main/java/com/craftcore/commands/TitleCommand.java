package com.craftcore.commands;

import com.craftcore.title.TitleManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

import java.util.Set;

public class TitleCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("title")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    String username = player.getName().getString();
                    Set<String> unlocked = TitleManager.getUnlockedTitles(username);
                    String active = TitleManager.getActiveTitle(username);

                    player.sendSystemMessage(Component.literal("§b=== 您的個人解鎖稱號選單 ==="));
                    player.sendSystemMessage(Component.literal("§7當前佩戴稱號: " + (active.isEmpty() ? "§8(無)" : active)));

                    if (unlocked.isEmpty()) {
                        player.sendSystemMessage(Component.literal("§7您目前尚未解鎖任何頭頂稱號。參與整點活動、尋寶或機器認證即可解鎖！"));
                    } else {
                        player.sendSystemMessage(Component.literal("§e已解鎖稱號清單:"));
                        for (String t : unlocked) {
                            player.sendSystemMessage(Component.literal("  - " + t + " §7(輸入 /title set \"" + t + "\" 佩戴)"));
                        }
                    }
                    return 1;
                })
                .then(Commands.literal("set")
                        .then(Commands.argument("name", StringArgumentType.greedyString())
                                .executes(context -> {
                                    ServerPlayer player = context.getSource().getPlayer();
                                    if (player == null) return 0;
                                    String name = StringArgumentType.getString(context, "name").trim();
                                    boolean success = TitleManager.setActiveTitle(player.getName().getString(), name);
                                    if (success) {
                                        player.sendSystemMessage(Component.literal("§a成功切換頭頂稱號為: " + name));
                                    } else {
                                        player.sendSystemMessage(Component.literal("§c切換失敗：您尚未解鎖該稱號！"));
                                    }
                                    return 1;
                                })
                        )
                )
                .then(Commands.literal("clear")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player == null) return 0;
                            TitleManager.setActiveTitle(player.getName().getString(), "");
                            player.sendSystemMessage(Component.literal("§e已卸下頭頂稱號。"));
                            return 1;
                        })
                )
        );
    }
}
