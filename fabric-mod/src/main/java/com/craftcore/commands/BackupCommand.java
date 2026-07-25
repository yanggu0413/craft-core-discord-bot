package com.craftcore.commands;

import com.craftcore.CraftCoreMod;
import com.craftcore.config.ConfigManager;
import com.craftcore.websocket.CraftCoreWSClient;
import com.craftcore.websocket.Packet;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.BoolArgumentType;
import com.mojang.brigadier.arguments.DoubleArgumentType;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.SimpleMenuProvider;

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
                        com.craftcore.backup.BackupManager.performBackupAsync(true, player.getName().getString());
                        return 1;
                    }));
    }
}
