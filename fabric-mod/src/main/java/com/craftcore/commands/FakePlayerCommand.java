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

public class FakePlayerCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
dispatcher.register(Commands.literal("fp")
                    .then(Commands.argument("name", StringArgumentType.word())
                            .suggests((context, builder) -> SharedSuggestionProvider.suggest(com.craftcore.fakeplayer.FakePlayerManager.getAllFakePlayers().keySet(), builder))
                            .executes(context -> handleFpCommand(context, ""))
                            .then(Commands.argument("action", StringArgumentType.greedyString())
                                    .suggests((context, builder) -> SharedSuggestionProvider.suggest(java.util.List.of(
                                            "attack continuous", "attack interval 20", "attack once",
                                            "use continuous", "use interval 20", "use once",
                                            "mount", "dismount", "drop", "dropStack", "drop all",
                                            "jump", "kill", "shadow", "sneak", "unsneak", "sprint", "unsprint", "stop", "swapHands",
                                            "move forward", "move backward", "move left", "move right",
                                            "look up", "look down", "look north", "look south", "look east", "look west", "look at",
                                            "turn left", "turn right", "turn back", "spawn"
                                    ), builder))
                                    .executes(context -> handleFpCommand(context, StringArgumentType.getString(context, "action")))
                            )
                    )
            );
    }

    private static int handleFpCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String action) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) {
            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
            return 0;
        }

        String rawName = StringArgumentType.getString(context, "name");
        if (rawName.length() > 16) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 假人名稱長度不可超過 16 個字元！"));
            return 0;
        }
        if (!rawName.matches("^[a-zA-Z0-9_]+$")) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 假人名稱僅能包含英文、數字與下底線！"));
            return 0;
        }

        String username = player.getName().getString();
        String botName = rawName.toLowerCase();
        if (!botName.startsWith("fp_")) {
            botName = "fp_" + botName;
        }

        if (botName.length() > 16) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 自動補全後名稱為 " + botName + "，長度超過 16 個字元限額！"));
            return 0;
        }

        String owner = com.craftcore.fakeplayer.FakePlayerManager.getOwner(botName);
        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);

        if (owner != null && !owner.equalsIgnoreCase(username) && !isOp) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您不是該假人的創建者，無權控制牠！"));
            return 0;
        }

        net.minecraft.server.MinecraftServer server = com.craftcore.event.ServerLifecycleHandler.serverInstance;
        String cleanAction = action.trim();

        if (cleanAction.isEmpty() || cleanAction.equalsIgnoreCase("spawn")) {
            if (server.getPlayerList().getPlayerByName(botName) != null) {
                player.sendSystemMessage(Component.literal("§c[Craft-Core] 該假人已經在線上！"));
                return 0;
            }

            if (!isOp && com.craftcore.fakeplayer.FakePlayerManager.getActiveBotsCount(username, server) >= 3) {
                player.sendSystemMessage(Component.literal("§c[Craft-Core] 您已達到假人上限（最多同時開啟 3 隻假人）！"));
                return 0;
            }

            com.craftcore.fakeplayer.FakePlayerManager.register(botName, username);

            CommandSourceStack consoleSource = server.createCommandSourceStack();
            CommandSourceStack elevatedSource = consoleSource
                    .withPosition(player.position())
                    .withRotation(player.getRotationVector())
                    .withLevel((ServerLevel) player.level());

            String dim = player.level().dimension().identifier().toString();
            String cmd = String.format(java.util.Locale.ROOT, "player %s spawn at %.2f %.2f %.2f facing %.2f %.2f in %s",
                    botName, player.getX(), player.getY(), player.getZ(), player.getYRot(), player.getXRot(), dim);
            server.getCommands().performPrefixedCommand(elevatedSource, cmd);
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功召喚假人：" + botName));
            return 1;
        } else {
            if (server.getPlayerList().getPlayerByName(botName) == null) {
                player.sendSystemMessage(Component.literal("§c[Craft-Core] 該假人目前不在線上！"));
                return 0;
            }

            CommandSourceStack consoleSource = server.createCommandSourceStack();
            CommandSourceStack elevatedSource = consoleSource
                    .withPosition(player.position())
                    .withRotation(player.getRotationVector())
                    .withLevel((ServerLevel) player.level());

            String cmd = "player " + botName + " " + cleanAction;
            server.getCommands().performPrefixedCommand(elevatedSource, cmd);
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a已向假人 " + botName + " 發送指令：" + cleanAction));
            return 1;
        }
    }
}
