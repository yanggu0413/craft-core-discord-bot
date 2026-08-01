package com.craftcore.commands;

import com.craftcore.bounty.GlobalGoalManager;
import com.craftcore.treasure.TreasureChestManager;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public class RetentionCommands {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        // /treasure
        dispatcher.register(Commands.literal("treasure")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;

                    TreasureChestManager.TreasureLocation active = TreasureChestManager.getActiveTreasure();
                    if (active == null || active.opened) {
                        player.sendSystemMessage(Component.literal("§e目前野外沒有活躍的藏寶箱。下一波藏寶箱即將刷新！"));
                    } else {
                        int minX = (active.x / 300) * 300;
                        int maxX = minX + 300;
                        int minZ = (active.z / 300) * 300;
                        int maxZ = minZ + 300;
                        player.sendSystemMessage(Component.literal(
                                String.format("§6[🗺️ 最新藏寶圖線索] 野外藏寶箱目前地位於大致區域: §eX: %d ~ %d, Z: %d ~ %d§6！快前去尋寶！", minX, maxX, minZ, maxZ)
                        ));
                    }
                    return 1;
                })
        );

        // /bounty
        dispatcher.register(Commands.literal("bounty")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;

                    GlobalGoalManager.GoalData goal = GlobalGoalManager.getCurrentGoal();
                    double pct = Math.min(100.0, (double) goal.currentCount / goal.targetCount * 100.0);
                    int myContribution = goal.contributions.getOrDefault(player.getName().getString().toLowerCase(), 0);
                    boolean isEligible = myContribution >= GlobalGoalManager.MIN_CONTRIBUTION_THRESHOLD;

                    player.sendSystemMessage(Component.literal("§6=================== 全服每週共同目標 ==================="));
                    player.sendSystemMessage(Component.literal("§e★ 目標名稱: §f" + goal.title));
                    player.sendSystemMessage(Component.literal(
                            String.format("§e★ 全服進度: §a%d / %d (%.1f%%)", goal.currentCount, goal.targetCount, pct)
                    ));
                    player.sendSystemMessage(Component.literal("§e★ 個人累積貢獻: §f" + myContribution + " 個進度 " + (isEligible ? "§a[已達到發獎門檻 >=50]" : "§c[未達發獎門檻 50]")));

                    String topUser = GlobalGoalManager.getTopContributor();
                    player.sendSystemMessage(Component.literal("§e★ 榜首玩家: " + (topUser == null ? "無" : "§6" + topUser)));
                    player.sendSystemMessage(Component.literal("§7★ 達標發獎: Top1 獲 $5000+5鑰匙+全服英雄稱號 | Top2~3 獲 $2500+3鑰匙 | >=50進度獲 $1000+2鑰匙"));
                    if (goal.goalType == GlobalGoalManager.GoalType.SUBMIT_ITEMS) {
                        player.sendSystemMessage(Component.literal("§b★ 物資繳交提示: 請手持目標物資，輸入 /bounty submit [數量] 進行繳交！"));
                    }
                    player.sendSystemMessage(Component.literal("§6========================================================"));
                    return 1;
                })
                .then(Commands.literal("submit")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player == null) return 0;
                            GlobalGoalManager.submitHandItem(player, 64);
                            return 1;
                        })
                        .then(Commands.argument("amount", com.mojang.brigadier.arguments.IntegerArgumentType.integer(1, 6400))
                                .executes(context -> {
                                    ServerPlayer player = context.getSource().getPlayer();
                                    if (player == null) return 0;
                                    int amount = com.mojang.brigadier.arguments.IntegerArgumentType.getInteger(context, "amount");
                                    GlobalGoalManager.submitHandItem(player, amount);
                                    return 1;
                                }))
                )
        );
    }
}
