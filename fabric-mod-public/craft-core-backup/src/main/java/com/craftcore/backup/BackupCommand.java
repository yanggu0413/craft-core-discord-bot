package com.craftcore.backup;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

public class BackupCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("backup")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) {
                        context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                        return 0;
                    }
                    boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
                    if (!isOp) {
                        player.sendSystemMessage(Component.literal("§c[Craft-Core] 只有管理員可以使用此指令！"));
                        return 0;
                    }
                    BackupManager.performBackupAsync(true, player.getName().getString());
                    return 1;
                })
        );
    }
}
