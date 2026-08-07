package com.craftcore.achievement;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

import java.util.Set;

public class AchievementCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("achievements")
            .executes(context -> {
                ServerPlayer player = context.getSource().getPlayer();
                if (player == null) return 0;

                Set<String> unlocked = CustomAchievementManager.getUnlockedAchievements(player.getName().getString());
                player.sendSystemMessage(Component.literal("§6=================== 🏆 個人伺服器成就 ==================="));
                player.sendSystemMessage(Component.literal("§e★ 解鎖數量: §a" + unlocked.size() + " §f個成就"));
                if (unlocked.isEmpty()) {
                    player.sendSystemMessage(Component.literal("§7目前尚未解鎖任何自訂伺服器成就，繼續加油！"));
                } else {
                    player.sendSystemMessage(Component.literal("§e★ 已解鎖成就列表: §f" + String.join(", ", unlocked)));
                }
                player.sendSystemMessage(Component.literal("§6=========================================================="));
                return 1;
            })
        );
    }
}
