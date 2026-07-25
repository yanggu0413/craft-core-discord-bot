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

public class ClaimCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
dispatcher.register(Commands.literal("claim")
                    .executes(context -> {
                        ServerPlayer player = context.getSource().getPlayer();
                        if (player == null) {
                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                            return 0;
                        }
                        return com.craftcore.claim.ClaimManager.purchaseClaim(player);
                    })
                    .then(Commands.literal("flag")
                            .then(Commands.argument("type", StringArgumentType.string())
                                    .suggests((context, builder) -> SharedSuggestionProvider.suggest(new String[]{"container", "interact", "entry"}, builder))
                                    .then(Commands.argument("value", BoolArgumentType.bool())
                                            .executes(context -> {
                                                ServerPlayer player = context.getSource().getPlayer();
                                                if (player == null) return 0;
                                                String type = StringArgumentType.getString(context, "type");
                                                boolean val = BoolArgumentType.getBool(context, "value");
                                                
                                                com.craftcore.claim.ClaimManager.Claim claim = com.craftcore.claim.ClaimManager.getClaimAt(player.blockPosition(), player.level());
                                                if (claim == null) {
                                                    player.sendSystemMessage(Component.literal("§c[領地] 你目前不在任何領地範圍內。"));
                                                    return 0;
                                                }
                                                boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
                                                if (!claim.owner.equalsIgnoreCase(player.getName().getString()) && !isOp) {
                                                    player.sendSystemMessage(Component.literal("§c[領地] 你無權修改此領地的設定標籤。"));
                                                    return 0;
                                                }
                                                if ("container".equalsIgnoreCase(type) || "containers".equalsIgnoreCase(type)) {
                                                    claim.public_containers = val;
                                                    player.sendSystemMessage(Component.literal("§a[領地] 已將領地公開容器標籤設置為: " + (val ? "§e[開啟 - 所有人可使用]" : "§c[關閉 - 僅限成員]")));
                                                } else if ("interact".equalsIgnoreCase(type)) {
                                                    claim.public_interact = val;
                                                    player.sendSystemMessage(Component.literal("§a[領地] 已將領地公開設施(鐵砧/附魔台/按鈕)標籤設置為: " + (val ? "§e[開啟 - 所有人可使用]" : "§c[關閉 - 僅限成員]")));
                                                } else if ("entry".equalsIgnoreCase(type)) {
                                                    claim.public_entry = val;
                                                    player.sendSystemMessage(Component.literal("§a[領地] 已將領地公開進入權限設置為: " + (val ? "§e[開啟 - 所有人可進入]" : "§c[關閉 - 僅限成員/未被Ban玩家]")));
                                                }
                                                com.craftcore.claim.ClaimManager.save();
                                                return 1;
                                            })
                                    )
                            )
                    )
                    .then(Commands.literal("ban")
                            .then(Commands.argument("target", StringArgumentType.string())
                                    .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                                    .executes(context -> {
                                        ServerPlayer player = context.getSource().getPlayer();
                                        if (player == null) return 0;
                                        String target = StringArgumentType.getString(context, "target");
                                        
                                        com.craftcore.claim.ClaimManager.Claim claim = com.craftcore.claim.ClaimManager.getClaimAt(player.blockPosition(), player.level());
                                        if (claim == null) {
                                            player.sendSystemMessage(Component.literal("§c[領地] 你目前不在任何領地範圍內。"));
                                            return 0;
                                        }
                                        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
                                        if (!claim.owner.equalsIgnoreCase(player.getName().getString()) && !isOp) {
                                            player.sendSystemMessage(Component.literal("§c[領地] 你無權修改此領地的黑名單。"));
                                            return 0;
                                        }
                                        if (claim.banned_players == null) claim.banned_players = new java.util.ArrayList<>();
                                        if (!claim.banned_players.contains(target)) {
                                            claim.banned_players.add(target);
                                        }
                                        com.craftcore.claim.ClaimManager.save();
                                        player.sendSystemMessage(Component.literal("§a[領地] 已成功將玩家 §e" + target + " §a加入此領地的黑名單 (禁止進入)！"));
                                        return 1;
                                    })
                            )
                    )
                    .then(Commands.literal("unban")
                            .then(Commands.argument("target", StringArgumentType.string())
                                    .executes(context -> {
                                        ServerPlayer player = context.getSource().getPlayer();
                                        if (player == null) return 0;
                                        String target = StringArgumentType.getString(context, "target");
                                        
                                        com.craftcore.claim.ClaimManager.Claim claim = com.craftcore.claim.ClaimManager.getClaimAt(player.blockPosition(), player.level());
                                        if (claim == null) {
                                            player.sendSystemMessage(Component.literal("§c[領地] 你目前不在任何領地範圍內。"));
                                            return 0;
                                        }
                                        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
                                        if (!claim.owner.equalsIgnoreCase(player.getName().getString()) && !isOp) {
                                            player.sendSystemMessage(Component.literal("§c[領地] 你無權修改此領地的黑名單。"));
                                            return 0;
                                        }
                                        if (claim.banned_players != null) {
                                            claim.banned_players.remove(target);
                                        }
                                        com.craftcore.claim.ClaimManager.save();
                                        player.sendSystemMessage(Component.literal("§a[領地] 已成功將玩家 §e" + target + " §a自黑名單解封！"));
                                        return 1;
                                    })
                            )
                    )
            );
    }
}
