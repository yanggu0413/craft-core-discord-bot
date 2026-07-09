package com.craftcore.commands;

import com.craftcore.CraftCoreMod;
import com.craftcore.config.ConfigManager;
import com.craftcore.websocket.Packet;
import com.craftcore.websocket.CraftCoreWSClient;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

public class DiscordCommand {

    public static void register() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            dispatcher.register(CommandManager.literal("discord")
                    .executes(context -> {
                        context.getSource().sendMessage(Text.literal("Discord Invite: " + ConfigManager.getConfig().discordInvite));
                        return 1;
                    })
                    .then(CommandManager.literal("link")
                            .executes(DiscordCommand::initiateBind))
                    .then(CommandManager.literal("bind")
                            .executes(DiscordCommand::initiateBind))
            );

            dispatcher.register(CommandManager.literal("playerinfo")
                    .requires(source -> source.getPermissions().hasPermission(net.minecraft.command.DefaultPermissions.OWNERS))
                    .then(CommandManager.argument("username", StringArgumentType.word())
                            .executes(DiscordCommand::playerInfo))
            );

            dispatcher.register(CommandManager.literal("ccplayerinfo")
                    .requires(source -> source.getPermissions().hasPermission(net.minecraft.command.DefaultPermissions.OWNERS))
                    .then(CommandManager.argument("username", StringArgumentType.word())
                            .executes(DiscordCommand::playerInfo))
            );
        });
    }

    private static int initiateBind(CommandContext<ServerCommandSource> context) {
        ServerCommandSource source = context.getSource();
        ServerPlayerEntity player = source.getPlayer();
        if (player == null) {
            source.sendMessage(Text.literal("This command can only be executed by players."));
            return 0;
        }

        CraftCoreWSClient client = CraftCoreMod.getWSClient();
        if (client == null || !client.isAuthenticated()) {
            source.sendMessage(Text.literal("[CraftCore] WebSocket connection is offline. Please try again later."));
            return 0;
        }

        String username = player.getName().getString();
        String uuid = player.getUuidAsString();
        client.send(new Packet("bind_code_request", new Packet.BindCodeRequestPayload(username, uuid)));
        source.sendMessage(Text.literal("[CraftCore] Requesting bind code..."));
        return 1;
    }

    private static int playerInfo(CommandContext<ServerCommandSource> context) {
        String username = StringArgumentType.getString(context, "username");
        ServerCommandSource source = context.getSource();
        ServerPlayerEntity serverPlayer = source.getServer().getPlayerManager().getPlayer(username);

        if (serverPlayer != null) {
            double x = serverPlayer.getX();
            double y = serverPlayer.getY();
            double z = serverPlayer.getZ();
            String dim = "Unknown";
            String dimKey = serverPlayer.getEntityWorld().getRegistryKey().getValue().getPath().toLowerCase();
            if (dimKey.contains("overworld")) {
                dim = "主世界";
            } else if (dimKey.contains("nether")) {
                dim = "地獄";
            } else if (dimKey.contains("end")) {
                dim = "終界";
            } else {
                dim = dimKey;
            }
            source.sendMessage(Text.literal(String.format("Online: true, Coords: X: %.2f Y: %.2f Z: %.2f, Dimension: %s", x, y, z, dim)));
        } else {
            String lastOnline = ConfigManager.getPlayerLastOnline(username);
            if (lastOnline == null) {
                lastOnline = "Unknown";
            }
            source.sendMessage(Text.literal(String.format("Online: false, LastOnline: %s", lastOnline)));
        }
        return 1;
    }
}
