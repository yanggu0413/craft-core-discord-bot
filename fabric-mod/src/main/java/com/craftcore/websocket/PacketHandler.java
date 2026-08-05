package com.craftcore.websocket;

import com.craftcore.websocket.Packet.*;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.server.MinecraftServer;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;

public class PacketHandler {
    private static final Gson GSON = new Gson();

    public static net.minecraft.server.level.ServerPlayer getPlayerCaseInsensitive(MinecraftServer server, String username) {
        if (username == null || username.trim().isEmpty()) return null;
        String cleanTarget = username.trim().replaceFirst("^\\.", "");
        for (net.minecraft.server.level.ServerPlayer p : server.getPlayerList().getPlayers()) {
            String pName = p.getName().getString();
            if (pName.equalsIgnoreCase(username)) {
                return p;
            }
            if (pName.replaceFirst("^\\.", "").equalsIgnoreCase(cleanTarget)) {
                return p;
            }
            if (p.getGameProfile() != null && p.getGameProfile().name() != null) {
                String profName = p.getGameProfile().name();
                if (profName.equalsIgnoreCase(username) || profName.replaceFirst("^\\.", "").equalsIgnoreCase(cleanTarget)) {
                    return p;
                }
            }
        }
        return null;
    }

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
                        net.minecraft.server.level.ServerPlayer player = getPlayerCaseInsensitive(server, payload.username);
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
                    if (payload != null && payload.command != null) {
                        payload.command = payload.command.replaceAll("[\r\n]", " ").trim();
                    }
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
                            // Intercept fake player commands to update enabled status
                            if (payload.command != null) {
                                String lowerCmd = payload.command.trim().toLowerCase();
                                if (lowerCmd.startsWith("/fp ") || lowerCmd.startsWith("fp ") || lowerCmd.startsWith("/player ") || lowerCmd.startsWith("player ")) {
                                    String[] parts = lowerCmd.split("\\s+");
                                    if (parts.length >= 2) {
                                        String botName = parts[1];
                                        String action = (parts.length >= 3) ? parts[2] : "spawn";
                                        if (action.equalsIgnoreCase("kill") || action.equalsIgnoreCase("stop") || action.equalsIgnoreCase("despawn") || action.equalsIgnoreCase("leave")) {
                                            com.craftcore.fakeplayer.FakePlayerManager.setBotEnabled(botName, null, false);
                                        } else {
                                            com.craftcore.fakeplayer.FakePlayerManager.setBotEnabled(botName, null, true);
                                        }
                                    }
                                }
                            }
                        } catch (Exception e) {
                            success = false;
                            commandOutput.sendSystemMessage(Component.literal("Error: " + e.getMessage()));
                        }
                        String output = commandOutput.getCapturedOutput();
                        if (output != null) {
                            String lower = output.toLowerCase();
                            if (lower.contains("unknown or incomplete command") || 
                                    lower.contains("do not have permission") || 
                                    lower.contains("incorrect argument") || 
                                    lower.contains("失敗")) {
                                success = false;
                            }
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
                case "shops_query":
                case "shop_stats_query": {
                    ShopStatsQueryPayload payload = GSON.fromJson(payloadObj, ShopStatsQueryPayload.class);
                    boolean isAuth = client.isAuthenticated();
                    java.util.List<ShopEntry> stats = new java.util.ArrayList<>();
                    boolean success = false;
                    if (isAuth && payload != null) {
                        try {
                            String queryUser = payload.username != null ? payload.username : "*";
                            java.util.List<com.craftcore.shop.ShopManager.Shop> shops = com.craftcore.shop.ShopManager.getShops();
                            for (com.craftcore.shop.ShopManager.Shop s : shops) {
                                if (queryUser.equals("*") || s.player.equalsIgnoreCase(queryUser)) {
                                    stats.add(new ShopEntry(s.coords, s.player, s.item, s.stock, s.sellPrice, s.buyPrice, s.customName, s.revenue));
                                }
                            }
                            success = true;
                        } catch (Exception e) {
                            success = false;
                        }
                    }
                    ShopStatsResponsePayload response = new ShopStatsResponsePayload(payload != null ? payload.query_id : null, payload != null ? payload.username : "*", stats, success, success ? "Success" : "Error");
                    if ("shops_query".equalsIgnoreCase(type)) {
                        client.send(new Packet("shops_response", response));
                    } else {
                        client.send(new Packet("shop_stats_response", response));
                    }
                    break;
                }
                case "stats_query": {
                    String queryId = payloadObj != null && payloadObj.has("query_id") ? payloadObj.get("query_id").getAsString() : null;
                    server.execute(() -> {
                        double mspt = server.getAverageTickTimeNanos() / 1_000_000.0;
                        double tps = Math.min(20.0, 1000.0 / mspt);
                        int onlinePlayers = server.getPlayerList().getPlayerCount();
                        int maxPlayers = server.getPlayerList().getMaxPlayers();
                        double totalMoney = com.craftcore.economy.EconomyManager.getTotalMoney();
                        int totalShops = com.craftcore.shop.ShopManager.getShops().size();

                        JsonObject res = new JsonObject();
                        if (queryId != null) res.addProperty("query_id", queryId);
                        res.addProperty("online_players", onlinePlayers);
                        res.addProperty("max_players", maxPlayers);
                        res.addProperty("tps", tps);
                        res.addProperty("total_money", totalMoney);
                        res.addProperty("total_shops", totalShops);
                        res.addProperty("success", true);
                        
                        client.send(new Packet("stats_response", res));
                    });
                    break;
                }
                case "reload_config": {
                    String target = payloadObj != null && payloadObj.has("target") ? payloadObj.get("target").getAsString() : "";
                    String queryId = payloadObj != null && payloadObj.has("query_id") ? payloadObj.get("query_id").getAsString() : null;
                    server.execute(() -> {
                        if ("economy".equalsIgnoreCase(target)) {
                            com.craftcore.economy.EconomyManager.load();
                        } else if ("shops".equalsIgnoreCase(target)) {
                            com.craftcore.shop.ShopManager.load();
                        } else if ("claims".equalsIgnoreCase(target)) {
                            com.craftcore.claim.ClaimManager.load();
                        } else if ("warps".equalsIgnoreCase(target)) {
                            com.craftcore.teleport.WarpManager.load();
                        } else if ("lockboxes".equalsIgnoreCase(target)) {
                            com.craftcore.claim.LockboxManager.load();
                        } else {
                            com.craftcore.economy.EconomyManager.load();
                            com.craftcore.shop.ShopManager.load();
                            com.craftcore.claim.ClaimManager.load();
                            com.craftcore.teleport.WarpManager.load();
                            com.craftcore.claim.LockboxManager.load();
                        }
                        System.out.println("[CraftCore] WS reloaded config for target: " + target);
                        if (queryId != null) {
                            client.send(new Packet("reload_config_response", new GenericActionResponsePayload(queryId, true, "Config reloaded", 0.0)));
                        }
                    });
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
                case "shop_action": {
                    String queryId = payloadObj.has("query_id") ? payloadObj.get("query_id").getAsString() : null;
                    String action = payloadObj.has("action") ? payloadObj.get("action").getAsString() : "";
                    String username = payloadObj.has("username") ? payloadObj.get("username").getAsString() : "";
                    String coords = payloadObj.has("coords") ? payloadObj.get("coords").getAsString() : "";

                    server.execute(() -> {
                        com.craftcore.shop.ShopManager.Shop shop = com.craftcore.shop.ShopManager.getShop(coords);
                        if (shop == null) {
                            client.send(new Packet("shop_action_response", new GenericActionResponsePayload(queryId, false, "Shop not found", 0.0)));
                            return;
                        }

                        if ("withdraw".equalsIgnoreCase(action)) {
                            if (!shop.player.equalsIgnoreCase(username) && !shop.player.replaceAll("^\\.", "").equalsIgnoreCase(username.replaceAll("^\\.", ""))) {
                                client.send(new Packet("shop_action_response", new GenericActionResponsePayload(queryId, false, "您無權提領他人商店的營業額！", 0.0)));
                                return;
                            }
                            double revenue = shop.revenue;
                            if (revenue <= 0.0) {
                                client.send(new Packet("shop_action_response", new GenericActionResponsePayload(queryId, false, "No pending revenue to withdraw", 0.0)));
                                return;
                            }
                            shop.revenue = 0.0;
                            com.craftcore.shop.ShopManager.save();
                            com.craftcore.economy.EconomyManager.addMoney(shop.player, revenue);
                            client.send(new Packet("shop_action_response", new GenericActionResponsePayload(queryId, true, "Revenue withdrawn successfully", revenue)));
                        } else if ("rename".equalsIgnoreCase(action)) {
                            if (!shop.player.equalsIgnoreCase(username) && !shop.player.replaceAll("^\\.", "").equalsIgnoreCase(username.replaceAll("^\\.", ""))) {
                                client.send(new Packet("shop_action_response", new GenericActionResponsePayload(queryId, false, "您無權修改他人商店名稱！", 0.0)));
                                return;
                            }
                            String customName = payloadObj.has("custom_name") ? payloadObj.get("custom_name").getAsString() : null;
                            if (customName == null || customName.trim().isEmpty() || customName.length() > 15) {
                                client.send(new Packet("shop_action_response", new GenericActionResponsePayload(queryId, false, "商店名稱長度必須介於 1 到 15 個字元", 0.0)));
                                return;
                            }
                            double balance = com.craftcore.economy.EconomyManager.getBalance(username);
                            if (balance < 5000.0) {
                                client.send(new Packet("shop_action_response", new GenericActionResponsePayload(queryId, false, "Insufficient funds ($5000 required)", 0.0)));
                                return;
                            }
                            com.craftcore.economy.EconomyManager.removeMoney(username, 5000.0);
                            shop.customName = customName.trim();
                            com.craftcore.shop.ShopManager.save();
                            client.send(new Packet("shop_action_response", new GenericActionResponsePayload(queryId, true, "商店名稱已更新為: " + customName, 0.0)));
                        } else if ("rate".equalsIgnoreCase(action)) {
                            int rating = payloadObj.has("rating") ? payloadObj.get("rating").getAsInt() : 5;
                            if (rating < 1) rating = 1;
                            if (rating > 5) rating = 5;
                            if (shop.ratings == null) {
                                shop.ratings = new java.util.ArrayList<>();
                            }
                            shop.ratings.add(rating);
                            com.craftcore.shop.ShopManager.save();
                            client.send(new Packet("shop_action_response", new GenericActionResponsePayload(queryId, true, "感謝您的評分！已成功給予 " + rating + " 星評價。", 0.0)));
                        } else {
                            client.send(new Packet("shop_action_response", new GenericActionResponsePayload(queryId, false, "未知的商店動作", 0.0)));
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
                        String shopOwnerClean = shop.player.replaceAll("^\\.", "").toLowerCase();
                        String requesterClean = (payload.username != null ? payload.username : "").replaceAll("^\\.", "").toLowerCase();
                        if (!shopOwnerClean.equals(requesterClean)) {
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
                        com.craftcore.economy.EconomyManager.addMoney(shop.player, revenue);
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
                case "checkin_response": {
                    CheckinResponsePayload payload = GSON.fromJson(payloadObj, CheckinResponsePayload.class);
                    server.execute(() -> {
                        com.craftcore.economy.EconomyManager.setLotteryKeys(payload.username, payload.keysCount);
                        net.minecraft.server.level.ServerPlayer player = getPlayerCaseInsensitive(server, payload.username);
                        if (player != null) {
                            if (payload.success) {
                                com.craftcore.economy.EconomyManager.addMoney(payload.username, 150.0);
                                net.minecraft.world.item.Item itemObj = net.minecraft.core.registries.BuiltInRegistries.ITEM.get(
                                    net.minecraft.resources.Identifier.parse(payload.item)
                                ).map(net.minecraft.core.Holder::value).orElse(net.minecraft.world.item.Items.AIR);
                                if (itemObj != null && itemObj != net.minecraft.world.item.Items.AIR) {
                                    net.minecraft.world.item.ItemStack stack = new net.minecraft.world.item.ItemStack(itemObj, payload.amount);
                                    player.getInventory().add(stack);
                                    if (!stack.isEmpty()) {
                                        player.drop(stack, false);
                                    }
                                }
                                player.level().playSound(null, player.getX(), player.getY(), player.getZ(),
                                    net.minecraft.sounds.SoundEvents.PLAYER_LEVELUP, net.minecraft.sounds.SoundSource.PLAYERS, 1.0F, 1.0F);
                                String trans = com.craftcore.shop.TranslationManager.getTranslatedName(payload.item);
                                player.sendSystemMessage(Component.literal("§b[Craft-Core] §a簽到成功！獲得 $150 元與 " + trans + " x" + payload.amount + "！"));
                            } else {
                                player.sendSystemMessage(Component.literal(payload.message));
                            }
                        }
                    });
                    break;
                }
                case "luckydraw_response": {
                    LuckydrawResponsePayload payload = GSON.fromJson(payloadObj, LuckydrawResponsePayload.class);
                    String queryId = payloadObj != null && payloadObj.has("query_id") ? payloadObj.get("query_id").getAsString() : null;
                    server.execute(() -> {
                        net.minecraft.server.level.ServerPlayer player = getPlayerCaseInsensitive(server, payload.username);
                        if (player != null) {
                            com.craftcore.economy.EconomyManager.setLotteryKeys(payload.username, payload.keysCount);
                            boolean handledInGui = com.craftcore.menu.MenuGuiManager.handleLuckyDrawResponse(payload);
                            if (!handledInGui && payload.success) {
                                net.minecraft.world.item.Item itemObj = net.minecraft.core.registries.BuiltInRegistries.ITEM.get(
                                    net.minecraft.resources.Identifier.parse(payload.item)
                                ).map(net.minecraft.core.Holder::value).orElse(net.minecraft.world.item.Items.AIR);
                                if (itemObj != null && itemObj != net.minecraft.world.item.Items.AIR) {
                                    net.minecraft.world.item.ItemStack stack = new net.minecraft.world.item.ItemStack(itemObj, payload.amount);
                                    if (!player.getInventory().add(stack)) {
                                        player.drop(stack, false);
                                    }
                                }
                                player.level().playSound(null, player.getX(), player.getY(), player.getZ(),
                                    net.minecraft.sounds.SoundEvents.PLAYER_LEVELUP, net.minecraft.sounds.SoundSource.PLAYERS, 1.0F, 1.0F);
                                String trans = com.craftcore.shop.TranslationManager.getTranslatedName(payload.item);
                                player.sendSystemMessage(Component.literal("§b[Craft-Core] §a幸運大抽獎成功！恭喜獲得 " + trans + " x" + payload.amount + "！"));
                            } else if (!handledInGui && !payload.success) {
                                player.sendSystemMessage(Component.literal(payload.message));
                            }
                        }
                        if (queryId != null) {
                            client.send(new Packet("generic_response", new GenericActionResponsePayload(queryId, true, "Luckydraw processed", 0.0)));
                        }
                    });
                    break;
                }
                case "player_keys_update": {
                    PlayerKeysUpdatePayload payload = GSON.fromJson(payloadObj, PlayerKeysUpdatePayload.class);
                    String queryId = payloadObj != null && payloadObj.has("query_id") ? payloadObj.get("query_id").getAsString() : null;
                    server.execute(() -> {
                        com.craftcore.economy.EconomyManager.setLotteryKeys(payload.username, payload.keys);
                        if (queryId != null) {
                            client.send(new Packet("player_keys_update_response", new GenericActionResponsePayload(queryId, true, "Keys updated", 0.0)));
                        }
                    });
                    break;
                }
                case "claims_query": {
                    if (!client.isAuthenticated()) break;
                    ClaimsQueryPayload payload = GSON.fromJson(payloadObj, ClaimsQueryPayload.class);
                    java.util.List<ClaimEntry> entries = new java.util.ArrayList<>();
                    for (com.craftcore.claim.ClaimManager.Claim c : com.craftcore.claim.ClaimManager.getClaims()) {
                        ClaimsPermissions perms = new ClaimsPermissions(
                            c.permissions.build,
                            c.permissions.breakBlocks,
                            c.permissions.containers,
                            c.permissions.interact
                        );
                        entries.add(new ClaimEntry(c.id, c.name, c.owner, c.chunks, c.corners, c.dimension, perms));
                    }
                    ClaimsResponsePayload response = new ClaimsResponsePayload(payload.query_id, entries, true, "Success");
                    client.send(new Packet("claims_response", response));
                    break;
                }
                case "fake_players_query": {
                    FakePlayersQueryPayload payload = GSON.fromJson(payloadObj, FakePlayersQueryPayload.class);
                    java.util.List<FakePlayerEntry> entries = new java.util.ArrayList<>();
                    java.util.Map<String, String> allBots = com.craftcore.fakeplayer.FakePlayerManager.getAllFakePlayers();
                    for (java.util.Map.Entry<String, String> entry : allBots.entrySet()) {
                        String botName = entry.getKey();
                        String owner = entry.getValue();
                        boolean isOnline = (server.getPlayerList().getPlayerByName(botName) != null);
                        entries.add(new FakePlayerEntry(botName, owner, isOnline));
                    }
                    FakePlayersResponsePayload response = new FakePlayersResponsePayload(payload.query_id, entries, true);
                    client.send(new Packet("fake_players_response", response));
                    break;
                }
                case "playtime_query": {
                    PlaytimeQueryPayload payload = GSON.fromJson(payloadObj, PlaytimeQueryPayload.class);
                    server.execute(() -> {
                        net.minecraft.server.level.ServerPlayer player = getPlayerCaseInsensitive(server, payload.username);
                        long playTimeTicks = 0;
                        if (player != null) {
                            playTimeTicks = player.getStats().getValue(net.minecraft.stats.Stats.CUSTOM.get(net.minecraft.stats.Stats.PLAY_TIME));
                        } else {
                            try {
                                String userUuid = com.craftcore.economy.EconomyManager.getUUID(payload.username);
                                if (userUuid != null && !userUuid.isEmpty()) {
                                    java.io.File statsFile = new java.io.File(server.getWorldPath(net.minecraft.world.level.storage.LevelResource.PLAYER_STATS_DIR).toFile(), userUuid + ".json");
                                    if (statsFile.exists()) {
                                        String rawJson = java.nio.file.Files.readString(statsFile.toPath());
                                        com.google.gson.JsonObject obj = GSON.fromJson(rawJson, com.google.gson.JsonObject.class);
                                        if (obj != null && obj.has("stats")) {
                                            com.google.gson.JsonObject statsObj = obj.getAsJsonObject("stats");
                                            if (statsObj.has("minecraft:custom")) {
                                                com.google.gson.JsonObject customObj = statsObj.getAsJsonObject("minecraft:custom");
                                                if (customObj.has("minecraft:play_time")) {
                                                    playTimeTicks = customObj.get("minecraft:play_time").getAsLong();
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (Exception e) {}
                        }
                        client.send(new Packet("playtime_response", new PlaytimeResponsePayload(payload.query_id, playTimeTicks, true, "Success")));
                    });
                    break;
                }
                case "playtime_exchange": {
                    PlaytimeExchangePayload payload = GSON.fromJson(payloadObj, PlaytimeExchangePayload.class);
                    server.execute(() -> {
                        net.minecraft.server.level.ServerPlayer player = getPlayerCaseInsensitive(server, payload.username);
                        long currentTicks = 0;
                        if (player != null) {
                            currentTicks = player.getStats().getValue(net.minecraft.stats.Stats.CUSTOM.get(net.minecraft.stats.Stats.PLAY_TIME));
                        }
                        
                        long TICK_RATE = 360000L; // 5 hours
                        int keysToAdd = 0;
                        long ticksToDeduct = 0;
                        if ("single".equalsIgnoreCase(payload.mode)) {
                            if (currentTicks >= TICK_RATE) {
                                keysToAdd = 1;
                                ticksToDeduct = TICK_RATE;
                            }
                        } else {
                            keysToAdd = (int)(currentTicks / TICK_RATE);
                            ticksToDeduct = keysToAdd * TICK_RATE;
                        }

                        if (keysToAdd < 1) {
                            client.send(new Packet("playtime_exchange_response", new PlaytimeExchangeResponsePayload(payload.query_id, false, 0, 0, "可用時數不足！兌換 1 把鑰匙需要滿 5 小時時數。")));
                            return;
                        }

                        long newTicks = currentTicks - ticksToDeduct;
                        if (player != null) {
                            player.getStats().setValue(player, net.minecraft.stats.Stats.CUSTOM.get(net.minecraft.stats.Stats.PLAY_TIME), (int)newTicks);
                            player.playSound(net.minecraft.sounds.SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
                            player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成功兌換 " + keysToAdd + " 把大理石抽獎鑰匙！扣除 " + (ticksToDeduct / 72000) + " 小時時數。"));
                        }

                        int currentKeys = com.craftcore.economy.EconomyManager.getLotteryKeys(payload.username);
                        int newTotalKeys = currentKeys + keysToAdd;
                        com.craftcore.economy.EconomyManager.setLotteryKeys(payload.username, newTotalKeys);
                        client.send(new Packet("player_keys_update", new Packet.PlayerKeysUpdatePayload(payload.username, newTotalKeys)));

                        client.send(new Packet("playtime_exchange_response", new PlaytimeExchangeResponsePayload(payload.query_id, true, keysToAdd, ticksToDeduct, "成功兌換 " + keysToAdd + " 把鑰匙！")));
                    });
                    break;
                }
                case "update_player_titles": {
                    PlayerTitleUpdatePayload payload = GSON.fromJson(payloadObj, PlayerTitleUpdatePayload.class);
                    server.execute(() -> {
                        if (payload.title_text == null || payload.title_text.trim().isEmpty()) {
                            com.craftcore.title.TitleManager.removeTitle(payload.username);
                        } else {
                            com.craftcore.title.TitleManager.setTitle(payload.username, payload.title_text, payload.color_code, payload.is_bold);
                        }
                    });
                    break;
                }
                case "claims_permission_update": {
                    ClaimsPermissionUpdatePayload payload = GSON.fromJson(payloadObj, ClaimsPermissionUpdatePayload.class);
                    boolean isAuth = client.isAuthenticated();
                    if (!isAuth) {
                        client.send(new Packet("claims_permission_response", new GenericActionResponsePayload(payload.query_id, false, "Unauthorized", 0.0)));
                        break;
                    }
                    server.execute(() -> {
                        com.craftcore.claim.ClaimManager.Claim claim = com.craftcore.claim.ClaimManager.getClaim(payload.claimId);
                        if (claim == null) {
                            client.send(new Packet("claims_permission_response", new GenericActionResponsePayload(payload.query_id, false, "Claim not found", 0.0)));
                            return;
                        }
                        
                        java.util.List<String> allowedList = null;
                        if ("build".equalsIgnoreCase(payload.permissionType)) {
                            allowedList = claim.permissions.build;
                        } else if ("break".equalsIgnoreCase(payload.permissionType)) {
                            allowedList = claim.permissions.breakBlocks;
                        } else if ("containers".equalsIgnoreCase(payload.permissionType)) {
                            allowedList = claim.permissions.containers;
                        } else if ("interact".equalsIgnoreCase(payload.permissionType)) {
                            allowedList = claim.permissions.interact;
                        }
                        
                        if (allowedList != null) {
                            if ("grant".equalsIgnoreCase(payload.action)) {
                                if (!allowedList.contains(payload.player)) {
                                    allowedList.add(payload.player);
                                }
                            } else if ("revoke".equalsIgnoreCase(payload.action)) {
                                allowedList.remove(payload.player);
                            }
                            com.craftcore.claim.ClaimManager.save();
                            client.send(new Packet("claims_permission_response", new GenericActionResponsePayload(payload.query_id, true, "Permission updated successfully", 0.0)));
                        } else {
                            client.send(new Packet("claims_permission_response", new GenericActionResponsePayload(payload.query_id, false, "Invalid permission type", 0.0)));
                        }
                    });
                    break;
                }
                case "update_claim_flags": {
                    UpdateClaimFlagsPayload payload = GSON.fromJson(payloadObj, UpdateClaimFlagsPayload.class);
                    boolean isAuth = client.isAuthenticated();
                    if (!isAuth) {
                        client.send(new Packet("generic_response", new GenericActionResponsePayload(payload.query_id, false, "Unauthorized", 0.0)));
                        break;
                    }
                    server.execute(() -> {
                        com.craftcore.claim.ClaimManager.Claim claim = com.craftcore.claim.ClaimManager.getClaim(payload.claim_id);
                        if (claim == null) {
                            client.send(new Packet("generic_response", new GenericActionResponsePayload(payload.query_id, false, "Claim not found", 0.0)));
                            return;
                        }

                        net.minecraft.server.level.ServerPlayer player = getPlayerCaseInsensitive(server, payload.username);
                        boolean isOp = player != null && player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
                        boolean isOwnerOrAdmin = claim.owner.equalsIgnoreCase(payload.username) || isOp || payload.is_admin;

                        if (!isOwnerOrAdmin) {
                            client.send(new Packet("generic_response", new GenericActionResponsePayload(payload.query_id, false, "您無權修改此領地標籤！", 0.0)));
                            return;
                        }

                        if (payload.public_containers != null) claim.public_containers = payload.public_containers;
                        if (payload.public_interact != null) claim.public_interact = payload.public_interact;
                        if (payload.public_entry != null) claim.public_entry = payload.public_entry;
                        if (payload.banned_players != null) claim.banned_players = payload.banned_players;

                        com.craftcore.claim.ClaimManager.save();
                        client.send(new Packet("generic_response", new GenericActionResponsePayload(payload.query_id, true, "領地標籤與權限設定成功！", 0.0)));
                    });
                    break;
                }
                case "backup_query": {
                    BackupQueryPayload payload = GSON.fromJson(payloadObj, BackupQueryPayload.class);
                    boolean isAuth = client.isAuthenticated();
                    if (!isAuth) {
                        client.send(new Packet("backup_response", new BackupStatusResponsePayload(payload.query_id, false, "Unauthorized", null)));
                        break;
                    }
                    server.execute(() -> {
                        if ("trigger".equalsIgnoreCase(payload.action)) {
                            if (com.craftcore.backup.BackupManager.isBackingUp()) {
                                client.send(new Packet("backup_response", new BackupStatusResponsePayload(payload.query_id, false, "已有備份作業正在執行中", com.craftcore.backup.BackupManager.getBackupStats())));
                                return;
                            }
                            String source = (payload.admin_username != null && !payload.admin_username.isEmpty()) ? "Web-Admin (" + payload.admin_username + ")" : "Web-Dashboard";
                            com.craftcore.backup.BackupManager.performBackupAsync(true, source);
                            client.send(new Packet("backup_response", new BackupStatusResponsePayload(payload.query_id, true, "備份程序已啟動！", com.craftcore.backup.BackupManager.getBackupStats())));
                        } else {
                            client.send(new Packet("backup_response", new BackupStatusResponsePayload(payload.query_id, true, "OK", com.craftcore.backup.BackupManager.getBackupStats())));
                        }
                    });
                    break;
                }
                case "join_response": {
                    JoinResponsePayload payload = GSON.fromJson(payloadObj, JoinResponsePayload.class);
                    server.execute(() -> {
                        int localKeys = com.craftcore.economy.EconomyManager.getLotteryKeys(payload.username);
                        int finalKeys = Math.max(localKeys, payload.keysCount);
                        com.craftcore.economy.EconomyManager.setLotteryKeys(payload.username, finalKeys);
                        if (localKeys > payload.keysCount) {
                            client.send(new Packet("player_keys_update", new Packet.PlayerKeysUpdatePayload(payload.username, finalKeys)));
                        }
                        net.minecraft.server.level.ServerPlayer player = getPlayerCaseInsensitive(server, payload.username);
                        if (player != null) {
                            com.craftcore.task.DailyTaskManager.displayGreetingCard(player, payload.hasCheckedIn, payload.pendingMailCount);
                        }
                    });
                    break;
                }
                case "welfare_leaderboard_response": {
                    WelfareLeaderboardResponsePayload payload = GSON.fromJson(payloadObj, WelfareLeaderboardResponsePayload.class);
                    server.execute(() -> {
                        com.craftcore.menu.MenuGuiManager.handleWelfareLeaderboardResponse(payload);
                    });
                    break;
                }
                case "daily_tasks_query": {
                    DailyTasksQueryPayload payload = GSON.fromJson(payloadObj, DailyTasksQueryPayload.class);
                    boolean isAuth = client.isAuthenticated();
                    java.util.List<java.util.Map<String, Object>> taskList = new java.util.ArrayList<>();
                    String dateStr = com.craftcore.task.DailyTaskManager.getTaipeiDate();
                    boolean success = false;
                    if (isAuth) {
                        try {
                            String username = payload.username;
                            com.craftcore.task.DailyTaskManager.DailyTaskDef[] dailyTasks = com.craftcore.task.DailyTaskManager.getDailyTasks(dateStr);
                            
                            int slayProgress = com.craftcore.economy.EconomyManager.getDailyTaskSlayProgress(username);
                            int mineProgress = com.craftcore.economy.EconomyManager.getDailyTaskGatherProgress(username);

                            java.util.Map<String, Object> t1 = new java.util.HashMap<>();
                            t1.put("type", dailyTasks[0].type);
                            t1.put("target", dailyTasks[0].target);
                            t1.put("count", dailyTasks[0].count);
                            t1.put("reward", dailyTasks[0].reward);
                            t1.put("progress", slayProgress);
                            t1.put("claimed", com.craftcore.economy.EconomyManager.getDailyTaskSlayClaimed(username));
                            taskList.add(t1);

                            java.util.Map<String, Object> t2 = new java.util.HashMap<>();
                            t2.put("type", dailyTasks[1].type);
                            t2.put("target", dailyTasks[1].target);
                            t2.put("count", dailyTasks[1].count);
                            t2.put("reward", dailyTasks[1].reward);
                            t2.put("progress", mineProgress);
                            t2.put("claimed", com.craftcore.economy.EconomyManager.getDailyTaskGatherClaimed(username));
                            taskList.add(t2);

                            success = true;
                        } catch (Exception e) {
                            success = false;
                        }
                    }
                    DailyTasksResponsePayload response = new DailyTasksResponsePayload(payload.query_id, payload.username, taskList, dateStr, success);
                    client.send(new Packet("daily_tasks_response", response));
                    break;
                }
                case "give_money": {
                    com.google.gson.JsonObject obj = payloadObj.getAsJsonObject();
                    String targetName = obj.get("username").getAsString();
                    double amount = obj.get("amount").getAsDouble();
                    String queryId = obj.has("query_id") ? obj.get("query_id").getAsString() : null;
                    server.execute(() -> {
                        com.craftcore.economy.EconomyManager.addMoney(targetName, amount);
                        ServerPlayer target = getPlayerCaseInsensitive(server, targetName);
                        if (target != null) {
                            target.sendSystemMessage(Component.literal(String.format("§b[Craft-Core] §a獲得管理員發放的獎勵金幣: §e+$%.2f§a 元！", amount)));
                            target.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
                        }
                        if (queryId != null) {
                            client.send(new Packet("give_money_response", new GenericActionResponsePayload(queryId, true, "Success", amount)));
                        }
                    });
                    break;
                }
                case "player_balance_update": {
                    com.google.gson.JsonObject obj = payloadObj.getAsJsonObject();
                    String username = obj.has("username") ? obj.get("username").getAsString() : null;
                    String queryId = obj.has("query_id") ? obj.get("query_id").getAsString() : null;
                    server.execute(() -> {
                        if (username != null) {
                            if (obj.has("balance")) {
                                double balance = obj.get("balance").getAsDouble();
                                com.craftcore.economy.EconomyManager.setBalance(username, balance);
                            } else if (obj.has("amount")) {
                                double amount = obj.get("amount").getAsDouble();
                                com.craftcore.economy.EconomyManager.addMoney(username, amount);
                            }
                        }
                        if (queryId != null) {
                            client.send(new Packet("player_balance_update_response", new GenericActionResponsePayload(queryId, true, "Balance updated", 0.0)));
                        }
                    });
                    break;
                }
                case "give_keys": {
                    com.google.gson.JsonObject obj = payloadObj.getAsJsonObject();
                    String targetName = obj.get("username").getAsString();
                    int amount = obj.get("amount").getAsInt();
                    String queryId = obj.has("query_id") ? obj.get("query_id").getAsString() : null;
                    server.execute(() -> {
                        int current = com.craftcore.economy.EconomyManager.getLotteryKeys(targetName);
                        int newTotal = current + amount;
                        com.craftcore.economy.EconomyManager.setLotteryKeys(targetName, newTotal);
                        ServerPlayer target = getPlayerCaseInsensitive(server, targetName);
                        if (target != null) {
                            target.sendSystemMessage(Component.literal(String.format("§b[Craft-Core] §a獲得管理員發放的抽獎鑰匙: §e+%d 把§a！", amount)));
                            target.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
                        }
                        client.send(new Packet("give_keys_response", new GenericActionResponsePayload(queryId, true, "已成功發送 " + amount + " 把鑰匙給玩家 " + targetName, 0.0)));
                    });
                    break;
                }
                case "lockboxes_query": {
                    LockboxesQueryPayload payload = GSON.fromJson(payloadObj, LockboxesQueryPayload.class);
                    java.util.List<LockboxEntry> entries = new java.util.ArrayList<>();
                    for (com.craftcore.claim.LockboxManager.Lockbox l : com.craftcore.claim.LockboxManager.getLockboxes()) {
                        entries.add(new LockboxEntry(l.id, l.location, l.owner, l.authorized));
                    }
                    LockboxesResponsePayload response = new LockboxesResponsePayload(payload.query_id, entries, true, "Success");
                    client.send(new Packet("lockboxes_response", response));
                    break;
                }
                case "claim_daily_reward":
                case "daily_task_claim_request": {
                    DailyTaskClaimRequestPayload payload = GSON.fromJson(payloadObj, DailyTaskClaimRequestPayload.class);
                    server.execute(() -> {
                        String username = payload.username;
                        net.minecraft.server.level.ServerPlayer player = getPlayerCaseInsensitive(server, username);
                        if (player == null) {
                            client.send(new Packet("daily_task_claim_response", new GenericActionResponsePayload(payload.query_id, false, "Player is offline", 0.0)));
                            return;
                        }
                        String dateStr = com.craftcore.task.DailyTaskManager.getTaipeiDate();
                        com.craftcore.task.DailyTaskManager.DailyTaskDef[] dailyTasks = com.craftcore.task.DailyTaskManager.getDailyTasks(dateStr);
                        
                        int slayProgress = com.craftcore.economy.EconomyManager.getDailyTaskSlayProgress(username);
                        boolean slayClaimed = com.craftcore.economy.EconomyManager.getDailyTaskSlayClaimed(username);
                        int mineProgress = com.craftcore.economy.EconomyManager.getDailyTaskGatherProgress(username);
                        boolean mineClaimed = com.craftcore.economy.EconomyManager.getDailyTaskGatherClaimed(username);
                        
                        boolean slayCompletable = (slayProgress >= dailyTasks[0].count) && !slayClaimed;
                        boolean mineCompletable = (mineProgress >= dailyTasks[1].count) && !mineClaimed;
                        
                        if (!slayCompletable && !mineCompletable) {
                            client.send(new Packet("daily_task_claim_response", new GenericActionResponsePayload(payload.query_id, false, "No completable tasks or already claimed", 0.0)));
                            return;
                        }
                        
                        if (slayCompletable) {
                            com.craftcore.task.DailyTaskManager.completeTask(player, dailyTasks[0]);
                        }
                        if (mineCompletable) {
                            com.craftcore.task.DailyTaskManager.completeTask(player, dailyTasks[1]);
                        }
                        client.send(new Packet("daily_task_claim_response", new GenericActionResponsePayload(payload.query_id, true, "Tasks claimed successfully", 0.0)));
                    });
                    break;
                }
                case "player_status_query": {
                    if (!client.isAuthenticated()) break;
                    PlayerStatusQueryPayload payload = GSON.fromJson(payloadObj, PlayerStatusQueryPayload.class);
                    server.execute(() -> {
                        String username = payload.username;
                        net.minecraft.server.level.ServerPlayer player = getPlayerCaseInsensitive(server, username);
                        double mspt = server.getAverageTickTimeNanos() / 1_000_000.0;
                        double tps = Math.min(20.0, 1000.0 / mspt);
                        
                        if (player == null) {
                            client.send(new Packet("player_status_response", new PlayerStatusResponsePayload(payload.query_id, false, "離線", tps, true)));
                        } else {
                            String coordsStr = player.getBlockX() + ", " + player.getBlockY() + ", " + player.getBlockZ();
                            client.send(new Packet("player_status_response", new PlayerStatusResponsePayload(payload.query_id, true, coordsStr, tps, true)));
                        }
                    });
                    break;
                }
                case "player_inventory_query": {
                    if (!client.isAuthenticated()) break;
                    PlayerInventoryQueryPayload payload = GSON.fromJson(payloadObj, PlayerInventoryQueryPayload.class);
                    server.execute(() -> {
                        String username = payload.username;
                        net.minecraft.server.level.ServerPlayer player = getPlayerCaseInsensitive(server, username);
                        if (player == null) {
                            client.send(new Packet("player_inventory_response", new PlayerInventoryResponsePayload(payload.query_id, false, new java.util.ArrayList<>())));
                            return;
                        }
                        
                        java.util.List<InventoryItem> itemsList = new java.util.ArrayList<>();
                        net.minecraft.world.entity.player.Inventory inv = player.getInventory();
                        for (int slot = 0; slot < 41; slot++) {
                            net.minecraft.world.item.ItemStack stack = inv.getItem(slot);
                            if (!stack.isEmpty()) {
                                String itemId = net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString();
                                String displayName = stack.getHoverName().getString();
                                String nbt = "";
                                try {
                                    nbt = stack.getComponents().toString();
                                } catch (Exception ignored) {}
                                itemsList.add(new InventoryItem(slot, itemId, stack.getCount(), displayName, nbt));
                            }
                        }
                        client.send(new Packet("player_inventory_response", new PlayerInventoryResponsePayload(payload.query_id, true, itemsList)));
                    });
                    break;
                }
                case "warps_query": {
                    Packet.WarpsQueryPayload payload = GSON.fromJson(payloadObj, Packet.WarpsQueryPayload.class);
                    server.execute(() -> {
                        try {
                            java.util.List<Packet.WarpEntry> list = new java.util.ArrayList<>();
                            java.util.List<com.craftcore.teleport.WarpManager.Warp> warps = com.craftcore.teleport.WarpManager.getWarps();
                            for (com.craftcore.teleport.WarpManager.Warp w : warps) {
                                if (w == null) continue;
                                String name = w.name != null ? w.name.replace("\0", "") : "Unnamed";
                                String dim = w.dimension != null ? w.dimension.replace("\0", "") : "minecraft:overworld";
                                String coordsStr = (int)w.x + ", " + (int)w.y + ", " + (int)w.z;
                                String typeStr = w.type != null ? w.type : "normal";
                                String descStr = w.desc != null ? w.desc : "";
                                list.add(new Packet.WarpEntry(name, coordsStr, dim, typeStr, descStr));
                            }
                            client.send(new Packet("warps_response", new Packet.WarpsResponsePayload(payload.query_id, list, true)));
                        } catch (Throwable t) {
                            System.err.println("[CraftCore] Error handling warps_query: " + t.getMessage());
                        }
                    });
                    break;
                }
                case "warp_upsert": {
                    WarpUpsertPayload payload = GSON.fromJson(payloadObj, WarpUpsertPayload.class);
                    server.execute(() -> {
                        boolean success = payload.name != null && !payload.name.trim().isEmpty();
                        String message = success ? "Warp updated" : "Warp name is required";
                        if (success) {
                            com.craftcore.teleport.WarpManager.addWarp(
                                    payload.name.trim(), payload.x, payload.y, payload.z,
                                    payload.yaw, payload.pitch,
                                    payload.dimension == null || payload.dimension.isBlank()
                                            ? "minecraft:overworld" : payload.dimension,
                                    payload.type, payload.desc
                            );
                            client.send(new Packet("warps_changed", null));
                        }
                        client.send(new Packet("warp_upsert_response",
                                new GenericActionResponsePayload(payload.query_id, success, message, 0.0)));
                    });
                    break;
                }
                case "homes_query": {
                    Packet.HomesQueryPayload payload = GSON.fromJson(payloadObj, Packet.HomesQueryPayload.class);
                    server.execute(() -> {
                        java.util.List<Packet.HomeEntry> list = new java.util.ArrayList<>();
                        java.util.Map<String, com.craftcore.teleport.HomeManager.Home> homes = com.craftcore.teleport.HomeManager.getPlayerHomes(payload.username);
                        for (com.craftcore.teleport.HomeManager.Home h : homes.values()) {
                            String coordsStr = (int)h.x + ", " + (int)h.y + ", " + (int)h.z;
                            list.add(new Packet.HomeEntry(h.name, coordsStr, h.dimension));
                        }
                        client.send(new Packet("homes_response", new Packet.HomesResponsePayload(payload.query_id, list, true)));
                    });
                    break;
                }
                case "teleport_update": {
                    Packet.TeleportUpdatePayload payload = GSON.fromJson(payloadObj, Packet.TeleportUpdatePayload.class);
                    server.execute(() -> {
                        boolean ok = false;
                        String msg = "";
                        if ("home".equalsIgnoreCase(payload.type)) {
                            ok = com.craftcore.teleport.HomeManager.deleteHome(payload.username, payload.name);
                            msg = ok ? "Home deleted" : "Failed to delete home";
                        } else if ("warp".equalsIgnoreCase(payload.type)) {
                            ok = com.craftcore.teleport.WarpManager.removeWarp(payload.name);
                            msg = ok ? "Warp deleted" : "Failed to delete warp";
                            if (ok) {
                                client.send(new Packet("warps_changed", null));
                            }
                        } else {
                            msg = "Invalid type";
                        }
                        client.send(new Packet("teleport_update_response", new GenericActionResponsePayload(payload.query_id, ok, msg, 0.0)));
                    });
                    break;
                }
                case "take_item_request": {
                    TakeItemRequestPayload payload = GSON.fromJson(payloadObj, TakeItemRequestPayload.class);
                    server.execute(() -> {
                        String username = payload.username;
                        net.minecraft.server.level.ServerPlayer player = getPlayerCaseInsensitive(server, username);
                        if (player == null) {
                            client.send(new Packet("take_item_response", new GenericActionResponsePayload(payload.query_id, false, "Player is offline", 0.0)));
                            return;
                        }
                        net.minecraft.world.entity.player.Inventory inv = player.getInventory();
                        int slot = payload.slot;
                        if (slot < 0 || slot >= 36) {
                            client.send(new Packet("take_item_response", new GenericActionResponsePayload(payload.query_id, false, "Invalid slot index", 0.0)));
                            return;
                        }
                        net.minecraft.world.item.ItemStack stack = inv.getItem(slot);
                        if (stack.isEmpty()) {
                            client.send(new Packet("take_item_response", new GenericActionResponsePayload(payload.query_id, false, "Slot is empty", 0.0)));
                            return;
                        }
                        String itemId = net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString();
                        if (!itemId.equalsIgnoreCase(payload.itemId)) {
                            client.send(new Packet("take_item_response", new GenericActionResponsePayload(payload.query_id, false, "Item mismatch in slot", 0.0)));
                            return;
                        }
                        if (stack.getCount() < payload.quantity) {
                            client.send(new Packet("take_item_response", new GenericActionResponsePayload(payload.query_id, false, "Insufficient item count in slot", 0.0)));
                            return;
                        }
                        stack.shrink(payload.quantity);
                        player.containerMenu.broadcastChanges();
                        client.send(new Packet("take_item_response", new GenericActionResponsePayload(payload.query_id, true, "Success", 0.0)));
                    });
                    break;
                }
                case "lockbox_action":
                case "lockboxes_action":
                case "lockbox_update": {
                    LockboxUpdatePayload payload = GSON.fromJson(payloadObj, LockboxUpdatePayload.class);
                    server.execute(() -> {
                        boolean ok = false;
                        String msg = "";
                        
                        try {
                            if ("grant".equalsIgnoreCase(payload.action)) {
                                ok = com.craftcore.claim.LockboxManager.grantPermission(payload.lockboxId, payload.targetPlayer);
                                msg = ok ? "Access granted" : "Failed to grant access";
                            } else if ("revoke".equalsIgnoreCase(payload.action)) {
                                ok = com.craftcore.claim.LockboxManager.revokePermission(payload.lockboxId, payload.targetPlayer);
                                msg = ok ? "Access revoked" : "Failed to revoke access";
                            } else if ("change_password".equalsIgnoreCase(payload.action)) {
                                ok = com.craftcore.claim.LockboxManager.changePassword(payload.lockboxId, payload.newPassword);
                                msg = ok ? "Password updated" : "Failed to update password";
                            } else if ("delete".equalsIgnoreCase(payload.action)) {
                                ok = com.craftcore.claim.LockboxManager.removeLockbox(payload.lockboxId);
                                msg = ok ? "Lockbox deleted" : "Failed to delete lockbox";
                            } else {
                                msg = "Invalid action";
                            }
                        } catch (Exception e) {
                            msg = e.getMessage();
                        }
                        client.send(new Packet("lockbox_update_response", new GenericActionResponsePayload(payload.query_id, ok, msg, 0.0)));
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
