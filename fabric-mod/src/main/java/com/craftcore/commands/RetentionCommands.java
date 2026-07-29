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

                    player.sendSystemMessage(Component.literal("§b=== 全服每週共同目標 ==="));
                    player.sendSystemMessage(Component.literal("§e目標名稱: §f" + goal.title));
                    player.sendSystemMessage(Component.literal(
                            String.format("§e全服總進度: §a%d / %d (%.1f%%)", goal.currentCount, goal.targetCount, pct)
                    ));

                    String topUser = GlobalGoalManager.getTopContributor();
                    player.sendSystemMessage(Component.literal("§7全服最高貢獻玩家: " + (topUser == null ? "無" : "§6" + topUser)));
                    player.sendSystemMessage(Component.literal("§7(達標 100% 後全服玩家頒發 $1000 金幣 + 2 把幸運鑰匙！)"));
                    return 1;
                })
        );
    }
}
