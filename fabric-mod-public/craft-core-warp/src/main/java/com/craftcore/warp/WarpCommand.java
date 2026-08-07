package com.craftcore.warp;

import com.craftcore.back.BackManager;
import com.craftcore.teleport.TeleportUtil;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.Permissions;

import java.util.List;

public class WarpCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("warp")
                .executes(WarpCommand::handleWarpListCommand)
                .then(Commands.argument("name", StringArgumentType.greedyString())
                        .suggests((context, builder) -> SharedSuggestionProvider.suggest(WarpManager.getWarps().stream().map(w -> w.name), builder))
                        .executes(context -> handleWarpTeleportCommand(context, StringArgumentType.getString(context, "name")))
                )
        );

        dispatcher.register(Commands.literal("warps")
                .executes(WarpCommand::handleWarpListCommand)
        );

        dispatcher.register(Commands.literal("setwarp")
                .then(Commands.argument("name", StringArgumentType.greedyString())
                        .executes(context -> handleSetWarpCommand(context, StringArgumentType.getString(context, "name")))
                )
        );

        dispatcher.register(Commands.literal("delwarp")
                .then(Commands.argument("name", StringArgumentType.greedyString())
                        .suggests((context, builder) -> SharedSuggestionProvider.suggest(WarpManager.getWarps().stream().map(w -> w.name), builder))
                        .executes(context -> handleDelWarpCommand(context, StringArgumentType.getString(context, "name")))
                )
        );
    }

    private static int handleWarpListCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        List<WarpManager.Warp> list = WarpManager.getWarps();
        if (list.isEmpty()) {
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §7目前沒有設定任何公共地標。"));
            return 1;
        }

        player.sendSystemMessage(Component.literal("§6=================== 公共地標列表 ==================="));
        for (WarpManager.Warp w : list) {
            player.sendSystemMessage(Component.literal("§f- §e" + w.name + " §7(" + w.dimension.replace("minecraft:", "") + ": " + (int)w.x + "," + (int)w.y + "," + (int)w.z + ")"));
        }
        player.sendSystemMessage(Component.literal("§6=================================================="));
        return 1;
    }

    private static int handleWarpTeleportCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String name) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        WarpManager.Warp w = WarpManager.getWarp(name);
        if (w == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到名為「" + name + "」的公共地標！"));
            return 0;
        }

        ServerLevel destLevel = null;
        if (context.getSource().getServer() != null) {
            for (ServerLevel level : context.getSource().getServer().getAllLevels()) {
                if (level.dimension().identifier().toString().equalsIgnoreCase(w.dimension)) {
                    destLevel = level;
                    break;
                }
            }
        }

        if (destLevel == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 地標所在世界未載入！"));
            return 0;
        }

        BackManager.recordLocation(player);
        TeleportUtil.teleport(player, destLevel, w.x, w.y, w.z, w.yaw, w.pitch);
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功傳送至地標：" + w.name));
        return 1;
    }

    private static int handleSetWarpCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String name) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(Permissions.COMMANDS_OWNER);
        if (!isOp) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 只有管理員可以使用此指令！"));
            return 0;
        }

        WarpManager.addWarp(
                name,
                player.getX(), player.getY(), player.getZ(),
                player.getYRot(), player.getXRot(),
                player.level().dimension().identifier().toString()
        );
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功設定公共地標：" + name));
        return 1;
    }

    private static int handleDelWarpCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String name) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(Permissions.COMMANDS_OWNER);
        if (!isOp) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 只有管理員可以使用此指令！"));
            return 0;
        }

        if (WarpManager.removeWarp(name)) {
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功刪除公共地標：" + name));
            return 1;
        } else {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到公共地標：" + name));
            return 0;
        }
    }
}
