package com.craftcore.commands;

import com.craftcore.CraftCoreMod;
import com.craftcore.config.ConfigManager;
import com.craftcore.websocket.Packet;
import com.craftcore.websocket.CraftCoreWSClient;
import com.mojang.brigadier.arguments.DoubleArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.commands.Commands;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.world.SimpleMenuProvider;

public class DiscordCommand {

    public static void register() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            dispatcher.register(Commands.literal("discord")
                    .executes(context -> {
                        context.getSource().sendSystemMessage(Component.literal("§b[Craft-Core] §fDiscord 邀請連結：§a" + ConfigManager.getConfig().discordInvite));
                        return 1;
                    })
                    .then(Commands.literal("link")
                            .executes(DiscordCommand::initiateBind))
                    .then(Commands.literal("bind")
                            .executes(DiscordCommand::initiateBind))
            );

            dispatcher.register(Commands.literal("playerinfo")
                    .requires(source -> source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                    .then(Commands.argument("username", StringArgumentType.word())
                            .executes(DiscordCommand::playerInfo))
            );

            dispatcher.register(Commands.literal("ccplayerinfo")
                    .requires(source -> source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                    .then(Commands.argument("username", StringArgumentType.word())
                            .executes(DiscordCommand::playerInfo))
            );

            dispatcher.register(Commands.literal("addmoney")
                    .requires(source -> source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                    .then(Commands.argument("username", StringArgumentType.word())
                            .then(Commands.argument("amount", DoubleArgumentType.doubleArg(0.0))
                                    .executes(context -> {
                                        String username = StringArgumentType.getString(context, "username");
                                        double amount = DoubleArgumentType.getDouble(context, "amount");
                                        boolean success = com.craftcore.economy.EconomyManager.addMoney(username, amount);
                                        if (success) {
                                            context.getSource().sendSystemMessage(Component.literal("Added " + amount + " to " + username));
                                            return 1;
                                        } else {
                                            context.getSource().sendSystemMessage(Component.literal("Failed to add money."));
                                            return 0;
                                        }
                                    })))
            );

            dispatcher.register(Commands.literal("removemoney")
                    .requires(source -> source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                    .then(Commands.argument("username", StringArgumentType.word())
                            .then(Commands.argument("amount", DoubleArgumentType.doubleArg(0.0))
                                    .executes(context -> {
                                        String username = StringArgumentType.getString(context, "username");
                                        double amount = DoubleArgumentType.getDouble(context, "amount");
                                        boolean success = com.craftcore.economy.EconomyManager.removeMoney(username, amount);
                                        if (success) {
                                            context.getSource().sendSystemMessage(Component.literal("Removed " + amount + " from " + username));
                                            return 1;
                                        } else {
                                            context.getSource().sendSystemMessage(Component.literal("Failed to remove money."));
                                            return 0;
                                        }
                                    })))
            );

            dispatcher.register(Commands.literal("shop")
                    .executes(context -> {
                        ServerPlayer player = context.getSource().getPlayer();
                        if (player == null) {
                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                            return 0;
                        }
                        com.craftcore.shop.ShopGuiManager.openShopList(player);
                        return 1;
                    })
                    .then(Commands.literal("upgrade")
                            .executes(context -> {
                                ServerPlayer player = context.getSource().getPlayer();
                                if (player == null) {
                                    context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                                    return 0;
                                }
                                String username = player.getName().getString();
                                int currentUpgrades = com.craftcore.economy.EconomyManager.getUpgradedShopSlots(username);
                                int maxAllowed = 15 + currentUpgrades;
                                double cost = com.craftcore.economy.EconomyManager.getUpgradeCost(maxAllowed);
                                double balance = com.craftcore.economy.EconomyManager.getBalance(username);
                                if (balance < cost) {
                                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 金額不足，無法升級上限！"));
                                    return 0;
                                }
                                if (com.craftcore.economy.EconomyManager.upgradeShopLimit(username)) {
                                    player.sendSystemMessage(Component.literal("§b[Craft-Core] §a升級成功！您的商店上限已提升至 " + (maxAllowed + 1) + "。"));
                                    player.playSound(net.minecraft.sounds.SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
                                    return 1;
                                } else {
                                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 升級失敗，發生未知錯誤。"));
                                    return 0;
                                }
                            })
                    )
                    .then(Commands.literal("bulk")
                            .then(Commands.argument("coords", StringArgumentType.string())
                                    .then(Commands.argument("quantity", com.mojang.brigadier.arguments.IntegerArgumentType.integer(1))
                                            .executes(context -> {
                                                ServerPlayer player = context.getSource().getPlayer();
                                                if (player == null) {
                                                    context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                                                    return 0;
                                                }
                                                String coords = StringArgumentType.getString(context, "coords");
                                                int quantity = com.mojang.brigadier.arguments.IntegerArgumentType.getInteger(context, "quantity");
                                                
                                                String normalized = com.craftcore.shop.ShopManager.getNormalizedKey(coords);
                                                com.craftcore.shop.ShopManager.Shop shop = com.craftcore.shop.ShopManager.getShop(normalized);
                                                if (shop == null) {
                                                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到該座標的商店。"));
                                                    return 0;
                                                }
                                                boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
                                                if (!shop.player.equals(player.getName().getString()) && !isOp) {
                                                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 您無權修改此商店。"));
                                                    return 0;
                                                }
                                                
                                                if (com.craftcore.shop.ShopManager.setBulkQuantity(coords, quantity)) {
                                                    player.sendSystemMessage(Component.literal("§b[Craft-Core] §f已將商店 " + coords + " 的大宗交易數量設定為: " + quantity));
                                                    player.playSound(net.minecraft.sounds.SoundEvents.NOTE_BLOCK_PLING.value(), 1.0f, 1.0f);
                                                    return 1;
                                                } else {
                                                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 設定失敗。"));
                                                    return 0;
                                                }
                                            })
                                    )
                            )
                    )
                    .then(Commands.literal("search")
                            .then(Commands.argument("query", StringArgumentType.greedyString())
                                    .executes(context -> {
                                        ServerPlayer player = context.getSource().getPlayer();
                                        if (player == null) {
                                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                                            return 0;
                                        }
                                        String query = StringArgumentType.getString(context, "query");
                                        com.craftcore.shop.ShopGuiManager.openFilteredShopList(player, query);
                                        return 1;
                                    })
                            )
                    )
                    .then(Commands.literal("搜尋")
                            .then(Commands.argument("query", StringArgumentType.greedyString())
                                    .executes(context -> {
                                        ServerPlayer player = context.getSource().getPlayer();
                                        if (player == null) {
                                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                                            return 0;
                                        }
                                        String query = StringArgumentType.getString(context, "query");
                                        com.craftcore.shop.ShopGuiManager.openFilteredShopList(player, query);
                                        return 1;
                                    })
                            )
                    )
                    .then(Commands.literal("logs")
                            .executes(context -> {
                                ServerPlayer player = context.getSource().getPlayer();
                                if (player == null) {
                                    context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                                    return 0;
                                }
                                displayTransactionLogs(player);
                                return 1;
                            })
                    )
                    .then(Commands.literal("rate")
                            .then(Commands.argument("coords", StringArgumentType.string())
                                    .executes(context -> {
                                        ServerPlayer player = context.getSource().getPlayer();
                                        if (player == null) {
                                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                                            return 0;
                                        }
                                        String coords = StringArgumentType.getString(context, "coords");
                                        String normalized = com.craftcore.shop.ShopManager.getNormalizedKey(coords);
                                        com.craftcore.shop.ShopManager.Shop shop = com.craftcore.shop.ShopManager.getShop(normalized);
                                        if (shop == null) {
                                            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到該商店。"));
                                            return 0;
                                        }
                                        com.craftcore.shop.ShopManager.addRatingSession(player.getName().getString(), shop.id);
                                        player.sendSystemMessage(Component.literal("§b[Craft-Core] §f請在聊天欄輸入 1 到 5 的數字進行評分，或輸入「取消」取消："));
                                        return 1;
                                    })
                            )
                    )
                    .then(Commands.literal("rename")
                            .then(Commands.argument("coords", StringArgumentType.string())
                                    .then(Commands.argument("name", StringArgumentType.greedyString())
                                            .executes(context -> {
                                                ServerPlayer player = context.getSource().getPlayer();
                                                if (player == null) {
                                                    context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                                                    return 0;
                                                }
                                                String coords = StringArgumentType.getString(context, "coords");
                                                String name = StringArgumentType.getString(context, "name");
                                                if (name.length() > 15) {
                                                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 商店名稱長度不能超過 15 個字元。"));
                                                    return 0;
                                                }
                                                
                                                String normalized = com.craftcore.shop.ShopManager.getNormalizedKey(coords);
                                                com.craftcore.shop.ShopManager.Shop shop = com.craftcore.shop.ShopManager.getShop(normalized);
                                                if (shop == null) {
                                                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到該商店。"));
                                                    return 0;
                                                }
                                                
                                                boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
                                                if (!shop.player.equals(player.getName().getString()) && !isOp) {
                                                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 您無權修改此商店。"));
                                                    return 0;
                                                }
                                                
                                                double balance = com.craftcore.economy.EconomyManager.getBalance(player.getName().getString());
                                                if (balance < 5000.0) {
                                                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 金額不足，重新命名需要支付 $5000。"));
                                                    return 0;
                                                }
                                                
                                                if (com.craftcore.economy.EconomyManager.removeMoney(player.getName().getString(), 5000.0)) {
                                                    shop.customName = name;
                                                    com.craftcore.shop.ShopManager.save();
                                                    
                                                    // Update sign
                                                    String[] parts = coords.split(",");
                                                    if (parts.length == 3) {
                                                        try {
                                                            int x = Integer.parseInt(parts[0]);
                                                            int y = Integer.parseInt(parts[1]);
                                                            int z = Integer.parseInt(parts[2]);
                                                            com.craftcore.shop.ShopManager.updateShopSign((net.minecraft.server.level.ServerLevel) player.level(), new net.minecraft.core.BlockPos(x, y, z), shop);
                                                        } catch (Throwable t) {}
                                                    }
                                                    
                                                    player.sendSystemMessage(Component.literal("§b[Craft-Core] §f商店已成功更名為: " + name + "，已扣除 $5000。"));
                                                    player.playSound(net.minecraft.sounds.SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
                                                    return 1;
                                                } else {
                                                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 更名失敗。"));
                                                    return 0;
                                                }
                                            })
                                    )
                            )
                    )
            );

            dispatcher.register(Commands.literal("economy")
                    .executes(context -> {
                        ServerPlayer player = context.getSource().getPlayer();
                        if (player == null) {
                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                            return 0;
                        }
                        player.openMenu(new SimpleMenuProvider(
                            (syncId, playerInv, playerEntity) -> new com.craftcore.shop.ShopGuiManager.EconomyScreenHandler(syncId, playerInv, (ServerPlayer) playerEntity),
                            Component.literal("Economy Sell Shop")
                        ));
                        return 1;
                    })
                    .then(Commands.literal("top")
                            .executes(context -> {
                                ServerPlayer player = context.getSource().getPlayer();
                                if (player == null) {
                                    context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                                    return 0;
                                }
                                player.openMenu(new SimpleMenuProvider(
                                    (syncId, playerInv, playerEntity) -> new com.craftcore.shop.ShopGuiManager.EcoTopScreenHandler(syncId, playerInv),
                                    Component.literal("Wealth Leaderboard")
                                ));
                                return 1;
                            })
                    )
            );

            dispatcher.register(Commands.literal("eco")
                    .then(Commands.literal("top")
                            .executes(context -> {
                                ServerPlayer player = context.getSource().getPlayer();
                                if (player == null) {
                                    context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                                    return 0;
                                }
                                player.openMenu(new SimpleMenuProvider(
                                    (syncId, playerInv, playerEntity) -> new com.craftcore.shop.ShopGuiManager.EcoTopScreenHandler(syncId, playerInv),
                                    Component.literal("Wealth Leaderboard")
                                ));
                                return 1;
                            })
                    )
            );
        });
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
            source.sendSystemMessage(Component.literal(String.format("Online: true, Coords: X: %.2f Y: %.2f Z: %.2f, Dimension: %s", x, y, z, dim)));
        } else {
            String lastOnline = ConfigManager.getPlayerLastOnline(username);
            if (lastOnline == null) {
                lastOnline = "Unknown";
            }
            source.sendSystemMessage(Component.literal(String.format("Online: false, LastOnline: %s", lastOnline)));
        }
        return 1;
    }

    private static void displayTransactionLogs(ServerPlayer player) {
        String username = player.getName().getString();
        java.util.List<com.craftcore.shop.ShopManager.TransactionLog> logs = com.craftcore.shop.ShopManager.getMerchantLogs(username);
        if (logs.isEmpty()) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 目前沒有任何交易紀錄。"));
            return;
        }

        player.sendSystemMessage(Component.literal("§6=================== 交易紀錄 (最多20筆) ==================="));
        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        for (com.craftcore.shop.ShopManager.TransactionLog log : logs) {
            String timeStr = sdf.format(new java.util.Date(log.timestamp));
            String formatted;
            String translatedItem = com.craftcore.shop.TranslationManager.getTranslatedName(log.itemId);
            if ("buy".equals(log.type)) {
                formatted = String.format("§7[%s] §a[購買] §e%s §f向你購買了 §b%dx %s§f，總價: §e$%s",
                    timeStr, log.buyer, log.quantity, translatedItem, log.totalPrice);
            } else {
                formatted = String.format("§7[%s] §b[出售] §e%s §f向你出售了 §b%dx %s§f，總價: §e$%s",
                    timeStr, log.buyer, log.quantity, translatedItem, log.totalPrice);
            }
            player.sendSystemMessage(Component.literal(formatted));
        }
        player.sendSystemMessage(Component.literal("§6=================================================="));
    }
}
