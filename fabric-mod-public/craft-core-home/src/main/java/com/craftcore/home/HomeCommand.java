package com.craftcore.home;

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

import java.util.Collections;
import java.util.Map;

public class HomeCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("home")
                .executes(HomeCommand::handleHomeListCommand)
                .then(Commands.argument("name", StringArgumentType.string())
                        .suggests((context, builder) -> {
                            ServerPlayer p = context.getSource().getPlayer();
                            if (p == null) return SharedSuggestionProvider.suggest(Collections.emptyList(), builder);
                            return SharedSuggestionProvider.suggest(HomeManager.getPlayerHomes(p.getName().getString()).values().stream().map(h -> h.name), builder);
                        })
                        .executes(context -> handleHomeTeleportCommand(context, StringArgumentType.getString(context, "name")))
                )
        );

        dispatcher.register(Commands.literal("homes")
                .executes(HomeCommand::handleHomeListCommand)
        );

        dispatcher.register(Commands.literal("sethome")
                .executes(context -> handleSetHomeCommand(context, "home"))
                .then(Commands.argument("name", StringArgumentType.string())
                        .executes(context -> handleSetHomeCommand(context, StringArgumentType.getString(context, "name")))
                )
        );

        dispatcher.register(Commands.literal("delhome")
                .then(Commands.argument("name", StringArgumentType.string())
                        .suggests((context, builder) -> {
                            ServerPlayer p = context.getSource().getPlayer();
                            if (p == null) return SharedSuggestionProvider.suggest(Collections.emptyList(), builder);
                            return SharedSuggestionProvider.suggest(HomeManager.getPlayerHomes(p.getName().getString()).values().stream().map(h -> h.name), builder);
                        })
                        .executes(context -> handleDelHomeCommand(context, StringArgumentType.getString(context, "name")))
                )
        );
    }

    private static int handleHomeListCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        String username = player.getName().getString();
        Map<String, HomeManager.Home> homes = HomeManager.getPlayerHomes(username);

        if (homes.isEmpty()) {
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §7您目前尚未設定任何家。"));
            return 1;
        }

        player.sendSystemMessage(Component.literal("§6=================== 我的家園列表 (" + homes.size() + "/15) ==================="));
        for (HomeManager.Home h : homes.values()) {
            player.sendSystemMessage(Component.literal("§f- §e" + h.name + " §7(" + h.dimension.replace("minecraft:", "") + ": " + (int)h.x + "," + (int)h.y + "," + (int)h.z + ")"));
        }
        player.sendSystemMessage(Component.literal("§6=================================================="));
        return 1;
    }

    private static int handleHomeTeleportCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String name) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        String username = player.getName().getString();
        HomeManager.Home h = HomeManager.getHome(username, name);

        if (h == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到名為「" + name + "」的家！"));
            return 0;
        }

        ServerLevel destLevel = null;
        if (context.getSource().getServer() != null) {
            for (ServerLevel level : context.getSource().getServer().getAllLevels()) {
                if (level.dimension().identifier().toString().equalsIgnoreCase(h.dimension)) {
                    destLevel = level;
                    break;
                }
            }
        }

        if (destLevel == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 該家所在世界未載入！"));
            return 0;
        }

        BackManager.recordLocation(player);
        TeleportUtil.teleport(player, destLevel, h.x, h.y, h.z, h.yaw, h.pitch);
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功傳送回家：" + h.name));
        return 1;
    }

    private static int handleSetHomeCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String name) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        String username = player.getName().getString();
        String result = HomeManager.setHome(
                username, name,
                player.getX(), player.getY(), player.getZ(),
                player.getYRot(), player.getXRot(),
                player.level().dimension().identifier().toString()
        );

        if (result.equals("SUCCESS")) {
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a家園「" + name + "」設定成功！"));
            return 1;
        } else {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] " + result));
            return 0;
        }
    }

    private static int handleDelHomeCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String name) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        String username = player.getName().getString();
        if (HomeManager.deleteHome(username, name)) {
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a家園「" + name + "」刪除成功！"));
            return 1;
        } else {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到家園：「" + name + "」！"));
            return 0;
        }
    }
}
