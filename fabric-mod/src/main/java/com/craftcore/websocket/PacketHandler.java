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

    private static net.minecraft.server.level.ServerPlayer getPlayerCaseInsensitive(MinecraftServer server, String username) {
        if (username == null) return null;
        for (net.minecraft.server.level.ServerPlayer p : server.getPlayerList().getPlayers()) {
            if (p.getName().getString().equalsIgnoreCase(username)) {
                return p;
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
                                player.sendSystemMessage(Component.literal("§b[Craft-Core] §a幸運大抽獎成功！獲得 $150 元與 " + trans + " x" + payload.amount + "！"));
                            } else {
                                player.sendSystemMessage(Component.literal(payload.message));
                            }
                        }
                    });
                    break;
                }
                case "player_keys_update": {
                    PlayerKeysUpdatePayload payload = GSON.fromJson(payloadObj, PlayerKeysUpdatePayload.class);
                    server.execute(() -> {
                        com.craftcore.economy.EconomyManager.setLotteryKeys(payload.username, payload.keys);
                    });
                    break;
                }
                case "claims_query": {
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
                case "join_response": {
                    JoinResponsePayload payload = GSON.fromJson(payloadObj, JoinResponsePayload.class);
                    server.execute(() -> {
                        com.craftcore.economy.EconomyManager.setLotteryKeys(payload.username, payload.keysCount);
                        net.minecraft.server.level.ServerPlayer player = getPlayerCaseInsensitive(server, payload.username);
                        if (player != null) {
                            com.craftcore.task.DailyTaskManager.displayGreetingCard(player, payload.hasCheckedIn, payload.pendingMailCount);
                        }
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
                            com.craftcore.economy.EconomyManager.setDailyTaskSlayClaimed(username, true);
                            com.craftcore.task.DailyTaskManager.completeTask(player, dailyTasks[0]);
                        }
                        if (mineCompletable) {
                            com.craftcore.economy.EconomyManager.setDailyTaskGatherClaimed(username, true);
                            com.craftcore.task.DailyTaskManager.completeTask(player, dailyTasks[1]);
                        }
                        client.send(new Packet("daily_task_claim_response", new GenericActionResponsePayload(payload.query_id, true, "Tasks claimed successfully", 0.0)));
                    });
                    break;
                }
                case "player_status_query": {
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
