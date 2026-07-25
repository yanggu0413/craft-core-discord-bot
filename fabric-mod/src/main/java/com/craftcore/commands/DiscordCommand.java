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

public class DiscordCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
dispatcher.register(Commands.literal("discord")
                    .executes(context -> {
                        String inviteUrl = ConfigManager.getConfig().discordInvite;
                        Component linkComponent = Component.literal("§b[Craft-Core] §fDiscord 邀請連結：§a§n" + inviteUrl)
                                .withStyle(style -> style
                                        .withClickEvent(new net.minecraft.network.chat.ClickEvent.OpenUrl(java.net.URI.create(inviteUrl)))
                                        .withHoverEvent(new net.minecraft.network.chat.HoverEvent.ShowText(Component.literal("點擊在此瀏覽器開啟 Discord 邀請")))
                                );
                        context.getSource().sendSystemMessage(linkComponent);
                        return 1;
                    })
                    .then(Commands.literal("link")
                            .executes(DiscordCommand::initiateBind))
                    .then(Commands.literal("bind")
                            .executes(DiscordCommand::initiateBind))
            );

dispatcher.register(Commands.literal("afk")
                    .executes(context -> {
                        ServerPlayer player = context.getSource().getPlayer();
                        if (player == null) {
                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家使用。"));
                            return 0;
                        }

                        com.craftcore.afk.AfkManager.toggleAfk(player);
                        return 1;
                    })
            );

dispatcher.register(Commands.literal("playerinfo")

                    .requires(source -> !source.isPlayer() || source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))

                    .then(Commands.argument("username", StringArgumentType.string())

                            .executes(DiscordCommand::playerInfo))

            );

dispatcher.register(Commands.literal("ccplayerinfo")

                    .requires(source -> !source.isPlayer() || source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))

                    .then(Commands.argument("username", StringArgumentType.string())

                            .executes(DiscordCommand::playerInfo))

            );

dispatcher.register(Commands.literal("padlock")

                    .executes(context -> {

                        ServerPlayer player = context.getSource().getPlayer();

                        if (player == null) {

                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));

                            return 0;

                        }

                        return com.craftcore.claim.LockboxManager.startLockSession(player);

                    })

                    .then(Commands.literal("grant")

                            .then(Commands.argument("player", StringArgumentType.string())

                                    .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))

                                    .executes(context -> {

                                        ServerPlayer player = context.getSource().getPlayer();

                                        if (player == null) {

                                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));

                                            return 0;

                                        }

                                        String target = StringArgumentType.getString(context, "player");

                                        return com.craftcore.claim.LockboxManager.grantAccess(player, target);

                                    })

                            )

                    )

            );
    }

    private static int initiateBind(CommandContext<CommandSourceStack> context) {

        CommandSourceStack source = context.getSource();

        ServerPlayer player = source.getPlayer();

        if (player == null) {

            source.sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));

            return 0;

        }



        CraftCoreWSClient client = CraftCoreMod.getWSClient();

        if (client == null || !client.isAuthenticated()) {

            source.sendSystemMessage(Component.literal("§c[Craft-Core] §f機器人連線已中斷，請稍後再試！"));

            return 0;

        }



        String username = player.getName().getString();

        String uuid = player.getStringUUID();

        client.send(new Packet("bind_code_request", new Packet.BindCodeRequestPayload(username, uuid)));

        source.sendSystemMessage(Component.literal("§b[Craft-Core] §f正在向 Discord 申請綁定驗證碼..."));

        return 1;

    }

    private static int playerInfo(CommandContext<CommandSourceStack> context) {

        String username = StringArgumentType.getString(context, "username");

        CommandSourceStack source = context.getSource();

        ServerPlayer serverPlayer = source.getServer().getPlayerList().getPlayerByName(username);



        if (serverPlayer != null) {

            double x = serverPlayer.getX();

            double y = serverPlayer.getY();

            double z = serverPlayer.getZ();

            String dim = "Unknown";

            String dimKey = serverPlayer.level().dimension().identifier().getPath().toLowerCase();

            if (dimKey.contains("overworld")) {

                dim = "主世界";

            } else if (dimKey.contains("nether")) {

                dim = "地獄";

            } else if (dimKey.contains("end")) {

                dim = "終界";

            } else {

                dim = dimKey;

            }

            source.sendSystemMessage(Component.literal(String.format("在線狀態: 線上, 座標: X: %.2f Y: %.2f Z: %.2f, 維度: %s", x, y, z, dim)));

        } else {

            String lastOnline = ConfigManager.getPlayerLastOnline(username);

            if (lastOnline == null) {

                lastOnline = "未知";

            }

            source.sendSystemMessage(Component.literal(String.format("在線狀態: 離線, 最後上線時間: %s", lastOnline)));

        }

        return 1;

    }
}
