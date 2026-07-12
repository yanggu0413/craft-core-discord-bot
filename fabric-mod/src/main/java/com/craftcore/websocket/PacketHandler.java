package com.craftcore.websocket;

import com.craftcore.websocket.Packet.*;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.server.MinecraftServer;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.network.chat.Component;

public class PacketHandler {
    private static final Gson GSON = new Gson();

    public static void handle(String json, MinecraftServer server, CraftCoreWSClient client) {
        try {
            JsonObject jsonObject = JsonParser.parseString(json).getAsJsonObject();
            String type = jsonObject.get("type").getAsString();
            JsonObject payloadObj = jsonObject.getAsJsonObject("payload");

            switch (type) {
                case "auth_response": {
                    AuthResponsePayload payload = GSON.fromJson(payloadObj, AuthResponsePayload.class);
                    if (payload.success) {
                        System.out.println("[CraftCore] Authenticated successfully: " + payload.message);
                        client.setAuthenticated(true);
                        com.craftcore.event.ServerLifecycleHandler.startTelemetryLoop(server, client);
                    } else {
                        System.err.println("[CraftCore] Authentication failed: " + payload.message);
                        client.setAuthenticated(false);
                    }
                    break;
                }
                case "bind_code_response": {
                    BindCodeResponsePayload payload = GSON.fromJson(payloadObj, BindCodeResponsePayload.class);
                    server.execute(() -> {
                        net.minecraft.server.level.ServerPlayer player = server.getPlayerList().getPlayerByName(payload.username);
                        if (player != null) {
                            player.sendSystemMessage(Component.literal(payload.message));
                        }
                    });
                    break;
                }
                case "chat": {
                    ChatPayload payload = GSON.fromJson(payloadObj, ChatPayload.class);
                    // Discord -> Game chat relay. Format: [Discord] sender: message
                    String formatted = "[Discord] " + payload.sender + ": " + payload.message;
                    server.execute(() -> {
                        server.getPlayerList().broadcastSystemMessage(Component.literal(formatted), false);
                    });
                    break;
                }
                case "command_request": {
                    CommandRequestPayload payload = GSON.fromJson(payloadObj, CommandRequestPayload.class);
                    if (!client.isAuthenticated()) {
                        CommandResponsePayload responsePayload = new CommandResponsePayload(payload.command_id, false, "Unauthorized");
                        client.send(new Packet("command_response", responsePayload));
                        break;
                    }
                    server.execute(() -> {
                        WSCommandOutput commandOutput = new WSCommandOutput();
                        CommandSourceStack source = server.createCommandSourceStack()
                                .withSource(commandOutput);
                        boolean success = true;
                        try {
                            server.getCommands().performPrefixedCommand(source, payload.command);
                        } catch (Exception e) {
                            success = false;
                            commandOutput.sendSystemMessage(Component.literal("Error: " + e.getMessage()));
                        }
                        String output = commandOutput.getCapturedOutput();
                        if (output != null && (output.startsWith("Unknown or incomplete command") || output.trim().startsWith("Unknown or incomplete command"))) {
                            success = false;
                        }
                        CommandResponsePayload responsePayload = new CommandResponsePayload(payload.command_id, success, output);
                        client.send(new Packet("command_response", responsePayload));
                    });
                    break;
                }
                case "whitelist_action": {
                    WhitelistActionPayload payload = GSON.fromJson(payloadObj, WhitelistActionPayload.class);
                    if (!client.isAuthenticated()) {
                        WhitelistResponsePayload responsePayload = new WhitelistResponsePayload(
                                payload.username,
                                payload.action,
                                false,
                                "Unauthorized"
                        );
                        client.send(new Packet("whitelist_response", responsePayload));
                        break;
                    }
                    server.execute(() -> {
                        WSCommandOutput commandOutput = new WSCommandOutput();
                        CommandSourceStack source = server.createCommandSourceStack()
                                .withSource(commandOutput);
                        String cmd = "whitelist " + payload.action + " " + payload.username;
                        try {
                            server.getCommands().performPrefixedCommand(source, cmd);
                        } catch (Exception e) {
                            commandOutput.sendSystemMessage(Component.literal("Error: " + e.getMessage()));
                        }
                        String output = commandOutput.getCapturedOutput();
                        String cleanedOutput = output;
                        if (payload.username != null) {
                            cleanedOutput = output.replace(payload.username, "");
                        }
                        String lowerCleaned = cleanedOutput.toLowerCase();
                        boolean success = !lowerCleaned.contains("error") 
                                && !lowerCleaned.contains("invalid") 
                                && !lowerCleaned.contains("could not");
                        WhitelistResponsePayload responsePayload = new WhitelistResponsePayload(
                                payload.username,
                                payload.action,
                                success,
                                output
                        );
                        client.send(new Packet("whitelist_response", responsePayload));
                    });
                    break;
                }
                case "balance_query": {
                    BalanceQueryPayload payload = GSON.fromJson(payloadObj, BalanceQueryPayload.class);
                    boolean isAuth = client.isAuthenticated();
                    double balance = 0;
                    boolean success = false;
                    if (isAuth) {
                        try {
                            balance = com.craftcore.economy.EconomyManager.getBalance(payload.username);
                            success = true;
                        } catch (Exception e) {
                            success = false;
                        }
                    }
                    BalanceResponsePayload response = new BalanceResponsePayload(payload.query_id, payload.username, balance, success, success ? "Success" : "Error");
                    client.send(new Packet("balance_response", response));
                    break;
                }
                case "shop_stats_query": {
                    ShopStatsQueryPayload payload = GSON.fromJson(payloadObj, ShopStatsQueryPayload.class);
                    boolean isAuth = client.isAuthenticated();
                    java.util.List<ShopEntry> stats = new java.util.ArrayList<>();
                    boolean success = false;
                    if (isAuth) {
                        try {
                            java.util.List<com.craftcore.shop.ShopManager.Shop> shops = com.craftcore.shop.ShopManager.getShops();
                            for (com.craftcore.shop.ShopManager.Shop s : shops) {
                                if (payload.username.equals("*") || s.player.equalsIgnoreCase(payload.username)) {
                                    stats.add(new ShopEntry(s.coords, s.player, s.item, s.stock, s.sellPrice, s.buyPrice, s.customName, s.revenue));
                                }
                            }
                            success = true;
                        } catch (Exception e) {
                            success = false;
                        }
                    }
                    ShopStatsResponsePayload response = new ShopStatsResponsePayload(payload.query_id, payload.username, stats, success, success ? "Success" : "Error");
                    client.send(new Packet("shop_stats_response", response));
                    break;
                }
                case "rich_list_query": {
                    RichListQueryPayload payload = GSON.fromJson(payloadObj, RichListQueryPayload.class);
                    boolean isAuth = client.isAuthenticated();
                    java.util.List<RichListEntry> players = new java.util.ArrayList<>();
                    boolean success = false;
                    if (isAuth) {
                        try {
                            java.util.List<java.util.Map.Entry<String, com.craftcore.economy.EconomyManager.PlayerData>> top = 
                                com.craftcore.economy.EconomyManager.getTopWealthPlayers(10);
                            for (var entry : top) {
                                players.add(new RichListEntry(entry.getKey(), entry.getValue().balance));
                            }
                            success = true;
                        } catch (Exception e) {
                            success = false;
                        }
                    }
                    RichListResponsePayload response = new RichListResponsePayload(payload.query_id, players, success, success ? "Success" : "Error");
                    client.send(new Packet("rich_list_response", response));
                    break;
                }
                case "rename_shop_request": {
                    RenameShopRequestPayload payload = GSON.fromJson(payloadObj, RenameShopRequestPayload.class);
                    boolean isAuth = client.isAuthenticated();
                    if (!isAuth) {
                        client.send(new Packet("rename_shop_response", new GenericActionResponsePayload(payload.query_id, false, "Unauthorized", 0.0)));
                        break;
                    }
                    server.execute(() -> {
                        String normalized = com.craftcore.shop.ShopManager.getNormalizedKey(payload.coords);
                        com.craftcore.shop.ShopManager.Shop shop = com.craftcore.shop.ShopManager.getShop(normalized);
                        if (shop == null) {
                            client.send(new Packet("rename_shop_response", new GenericActionResponsePayload(payload.query_id, false, "Shop not found", 0.0)));
                            return;
                        }
                        if (!shop.player.equalsIgnoreCase(payload.username)) {
                            client.send(new Packet("rename_shop_response", new GenericActionResponsePayload(payload.query_id, false, "You do not own this shop", 0.0)));
                            return;
                        }
                        if (payload.custom_name == null || payload.custom_name.length() > 15) {
                            client.send(new Packet("rename_shop_response", new GenericActionResponsePayload(payload.query_id, false, "Name length must be between 1 and 15 characters", 0.0)));
                            return;
                        }
                        double balance = com.craftcore.economy.EconomyManager.getBalance(payload.username);
                        if (balance < 5000.0) {
                            client.send(new Packet("rename_shop_response", new GenericActionResponsePayload(payload.query_id, false, "Insufficient funds ($5000 required)", 0.0)));
                            return;
                        }
                        if (com.craftcore.economy.EconomyManager.removeMoney(payload.username, 5000.0)) {
                            shop.customName = payload.custom_name;
                            com.craftcore.shop.ShopManager.save();
                            String[] parts = payload.coords.split(",");
                            if (parts.length == 3) {
                                try {
                                    int x = Integer.parseInt(parts[0]);
                                    int y = Integer.parseInt(parts[1]);
                                    int z = Integer.parseInt(parts[2]);
                                    net.minecraft.core.BlockPos pos = new net.minecraft.core.BlockPos(x, y, z);
                                    net.minecraft.server.level.ServerLevel world = com.craftcore.shop.ShopManager.getServerWorld(shop.dimension);
                                    com.craftcore.shop.ShopManager.updateShopSign(world, pos, shop);
                                } catch (Throwable t) {}
                            }
                            client.send(new Packet("rename_shop_response", new GenericActionResponsePayload(payload.query_id, true, "Shop renamed successfully!", 0.0)));
                        } else {
                            client.send(new Packet("rename_shop_response", new GenericActionResponsePayload(payload.query_id, false, "Failed to deduct money", 0.0)));
                        }
                    });
                    break;
                }
                case "withdraw_revenue_request": {
                    WithdrawRevenueRequestPayload payload = GSON.fromJson(payloadObj, WithdrawRevenueRequestPayload.class);
                    boolean isAuth = client.isAuthenticated();
                    if (!isAuth) {
                        client.send(new Packet("withdraw_revenue_response", new GenericActionResponsePayload(payload.query_id, false, "Unauthorized", 0.0)));
                        break;
                    }
                    server.execute(() -> {
                        String normalized = com.craftcore.shop.ShopManager.getNormalizedKey(payload.coords);
                        com.craftcore.shop.ShopManager.Shop shop = com.craftcore.shop.ShopManager.getShop(normalized);
                        if (shop == null) {
                            client.send(new Packet("withdraw_revenue_response", new GenericActionResponsePayload(payload.query_id, false, "Shop not found", 0.0)));
                            return;
                        }
                        if (!shop.player.equalsIgnoreCase(payload.username)) {
                            client.send(new Packet("withdraw_revenue_response", new GenericActionResponsePayload(payload.query_id, false, "You do not own this shop", 0.0)));
                            return;
                        }
                        double revenue = shop.revenue;
                        if (revenue <= 0.0) {
                            client.send(new Packet("withdraw_revenue_response", new GenericActionResponsePayload(payload.query_id, false, "No pending revenue to withdraw", 0.0)));
                            return;
                        }
                        shop.revenue = 0.0;
                        com.craftcore.shop.ShopManager.save();
                        com.craftcore.economy.EconomyManager.addMoney(payload.username, revenue);
                        client.send(new Packet("withdraw_revenue_response", new GenericActionResponsePayload(payload.query_id, true, "Revenue withdrawn successfully", revenue)));
                    });
                    break;
                }
                case "upgrade_limit_request": {
                    UpgradeLimitRequestPayload payload = GSON.fromJson(payloadObj, UpgradeLimitRequestPayload.class);
                    boolean isAuth = client.isAuthenticated();
                    if (!isAuth) {
                        client.send(new Packet("upgrade_limit_response", new GenericActionResponsePayload(payload.query_id, false, "Unauthorized", 0.0)));
                        break;
                    }
                    server.execute(() -> {
                        int currentUpgrades = com.craftcore.economy.EconomyManager.getUpgradedShopSlots(payload.username);
                        int maxAllowed = 15 + currentUpgrades;
                        double cost = com.craftcore.economy.EconomyManager.getUpgradeCost(maxAllowed);
                        double balance = com.craftcore.economy.EconomyManager.getBalance(payload.username);
                        if (balance < cost) {
                            client.send(new Packet("upgrade_limit_response", new GenericActionResponsePayload(payload.query_id, false, "Insufficient funds", 0.0)));
                            return;
                        }
                        if (com.craftcore.economy.EconomyManager.upgradeShopLimit(payload.username)) {
                            client.send(new Packet("upgrade_limit_response", new GenericActionResponsePayload(payload.query_id, true, "Limit upgraded successfully", 0.0)));
                        } else {
                            client.send(new Packet("upgrade_limit_response", new GenericActionResponsePayload(payload.query_id, false, "Upgrade failed", 0.0)));
                        }
                    });
                    break;
                }
            }
        } catch (Exception e) {
            System.err.println("[CraftCore] Error parsing or handling packet: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
