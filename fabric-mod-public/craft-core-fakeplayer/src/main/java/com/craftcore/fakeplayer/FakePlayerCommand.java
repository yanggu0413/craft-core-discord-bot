package com.craftcore.fakeplayer;

import com.craftcore.api.RebrandEngine;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.mojang.brigadier.context.CommandContext;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.Permissions;

import java.util.List;
import java.util.Locale;

public class FakePlayerCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        LiteralArgumentBuilder<CommandSourceStack> fpNode = buildFpCommand("fp");
        LiteralArgumentBuilder<CommandSourceStack> fakeplayerNode = buildFpCommand("fakeplayer");

        dispatcher.register(fpNode);
        dispatcher.register(fakeplayerNode);
    }

    private static LiteralArgumentBuilder<CommandSourceStack> buildFpCommand(String literalName) {
        return Commands.literal(literalName)
                .then(Commands.argument("name", StringArgumentType.word())
                        .suggests((context, builder) -> SharedSuggestionProvider.suggest(FakePlayerManager.getAllFakePlayers().keySet(), builder))
                        .executes(context -> handleFpCommand(context, ""))
                        .then(Commands.argument("action", StringArgumentType.greedyString())
                                .suggests((context, builder) -> SharedSuggestionProvider.suggest(List.of(
                                        "attack continuous", "attack interval 20", "attack once",
                                        "use continuous", "use interval 20", "use once",
                                        "mount", "dismount", "drop", "dropStack", "drop all",
                                        "jump", "kill", "shadow", "sneak", "unsneak", "sprint", "unsprint", "stop", "swapHands",
                                        "move forward", "move backward", "move left", "move right",
                                        "look up", "look down", "look north", "look south", "look east", "look west", "look at",
                                        "turn left", "turn right", "turn back", "spawn", "remove"
                                ), builder))
                                .executes(context -> handleFpCommand(context, StringArgumentType.getString(context, "action")))
                        )
                );
    }

    private static int handleFpCommand(CommandContext<CommandSourceStack> context, String action) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) {
            context.getSource().sendSystemMessage(RebrandEngine.rebrandText("&c此指令只能由遊戲內玩家執行。"));
            return 0;
        }

        String rawName = StringArgumentType.getString(context, "name");
        if (rawName.length() > 16) {
            player.sendSystemMessage(RebrandEngine.rebrandText("&c[%server_name%] 假人名稱長度不可超過 16 個字元！"));
            return 0;
        }
        if (!rawName.matches("^[a-zA-Z0-9_]+$")) {
            player.sendSystemMessage(RebrandEngine.rebrandText("&c[%server_name%] 假人名稱僅能包含英文、數字與下底線！"));
            return 0;
        }

        String username = player.getName().getString();
        String botName = rawName.toLowerCase();
        if (!botName.startsWith("fp_")) {
            botName = "fp_" + botName;
        }

        if (botName.length() > 16) {
            player.sendSystemMessage(RebrandEngine.rebrandText("&c[%server_name%] 自動補全後名稱為 " + botName + "，長度超過 16 個字元限額！"));
            return 0;
        }

        String owner = FakePlayerManager.getOwner(botName);
        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(Permissions.COMMANDS_OWNER);

        if (owner != null && !owner.equalsIgnoreCase(username) && !isOp) {
            player.sendSystemMessage(RebrandEngine.rebrandText("&c[%server_name%] 您不是該假人的創建者，無權控制牠！"));
            return 0;
        }

        MinecraftServer server = context.getSource().getServer();
        String cleanAction = action.trim();

        if (cleanAction.isEmpty() || cleanAction.equalsIgnoreCase("spawn")) {
            if (server.getPlayerList().getPlayerByName(botName) != null) {
                player.sendSystemMessage(RebrandEngine.rebrandText("&c[%server_name%] 該假人已經在線上！"));
                return 0;
            }

            if (!isOp && FakePlayerManager.getActiveBotsCount(username, server) >= 3) {
                player.sendSystemMessage(RebrandEngine.rebrandText("&c[%server_name%] 您已達到假人上限（最多同時開啟 3 隻假人）！"));
                return 0;
            }

            FakePlayerManager.register(botName, username);

            CommandSourceStack consoleSource = server.createCommandSourceStack();
            CommandSourceStack elevatedSource = consoleSource
                    .withPosition(player.position())
                    .withRotation(player.getRotationVector())
                    .withLevel((ServerLevel) player.level());

            String dim = player.level().dimension().identifier().toString();
            String cmd = String.format(Locale.ROOT, "player %s spawn at %.2f %.2f %.2f facing %.2f %.2f in %s",
                    botName, player.getX(), player.getY(), player.getZ(), player.getYRot(), player.getXRot(), dim);
            server.getCommands().performPrefixedCommand(elevatedSource, cmd);
            player.sendSystemMessage(RebrandEngine.rebrandText("&b[%server_name%] &a成功召喚假人：" + botName));
            return 1;
        } else {
            CommandSourceStack consoleSource = server.createCommandSourceStack();
            CommandSourceStack elevatedSource = consoleSource
                    .withPosition(player.position())
                    .withRotation(player.getRotationVector())
                    .withLevel((ServerLevel) player.level());

            String execAction = cleanAction.equalsIgnoreCase("remove") ? "kill" : cleanAction;
            String cmd = "player " + botName + " " + execAction;
            server.getCommands().performPrefixedCommand(elevatedSource, cmd);

            if (cleanAction.equalsIgnoreCase("kill") || cleanAction.equalsIgnoreCase("remove")) {
                FakePlayerManager.unregister(botName);
                player.sendSystemMessage(RebrandEngine.rebrandText("&b[%server_name%] &a假人 " + botName + " 已清除並從自動重連紀錄中移除！"));
            } else {
                player.sendSystemMessage(RebrandEngine.rebrandText("&b[%server_name%] &a已向假人 " + botName + " 發送指令：" + cleanAction));
            }
            return 1;
        }
    }
}
