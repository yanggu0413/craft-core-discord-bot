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

import net.minecraft.server.level.ServerLevel;



public class DiscordCommand {



    private static final java.util.Map<String, Long> payCooldowns = new java.util.concurrent.ConcurrentHashMap<>();



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

                    .requires(source -> !source.isPlayer() || source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))

                    .then(Commands.argument("username", StringArgumentType.string())

                            .executes(DiscordCommand::playerInfo))

            );



            dispatcher.register(Commands.literal("ccplayerinfo")

                    .requires(source -> !source.isPlayer() || source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))

                    .then(Commands.argument("username", StringArgumentType.string())

                            .executes(DiscordCommand::playerInfo))

            );



            dispatcher.register(Commands.literal("addmoney")

                    .requires(source -> !source.isPlayer() || source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))

                    .then(Commands.argument("username", StringArgumentType.string())

                            .then(Commands.argument("amount", DoubleArgumentType.doubleArg(0.0))

                                    .executes(context -> {

                                        String username = StringArgumentType.getString(context, "username");

                                        double amount = DoubleArgumentType.getDouble(context, "amount");

                                        boolean success = com.craftcore.economy.EconomyManager.addMoney(username, amount);

                                        if (success) {

                                            context.getSource().sendSystemMessage(Component.literal("§b[Craft-Core] §a成功將 $" + amount + " 加至玩家 " + username + " 的帳戶！"));

                                            return 1;

                                        } else {

                                            context.getSource().sendSystemMessage(Component.literal("§c[Craft-Core] 加金幣失敗！"));

                                            return 0;

                                        }

                                    })))

            );



            dispatcher.register(Commands.literal("removemoney")

                    .requires(source -> !source.isPlayer() || source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))

                    .then(Commands.argument("username", StringArgumentType.string())

                            .then(Commands.argument("amount", DoubleArgumentType.doubleArg(0.0))

                                    .executes(context -> {

                                        String username = StringArgumentType.getString(context, "username");

                                        double amount = DoubleArgumentType.getDouble(context, "amount");

                                        boolean success = com.craftcore.economy.EconomyManager.removeMoney(username, amount);

                                        if (success) {

                                            context.getSource().sendSystemMessage(Component.literal("§b[Craft-Core] §a成功將 $" + amount + " 自玩家 " + username + " 的帳戶中扣除！"));

                                            return 1;

                                        } else {

                                            context.getSource().sendSystemMessage(Component.literal("§c[Craft-Core] 扣除金幣失敗！"));

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

                    .then(Commands.literal("control")

                            .then(Commands.argument("coords", StringArgumentType.string())

                                    .then(Commands.argument("action", StringArgumentType.word())

                                            .executes(DiscordCommand::handleShopControl)

                                    )

                            )

                    )

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

                        if (player != null) {

                            player.sendSystemMessage(Component.literal("§c❌ 本伺服器已全面啟用玩家自由市場經濟，系統收購功能已關閉！請使用 /shop 與其他玩家進行交易。"));

                        } else {

                            context.getSource().sendSystemMessage(Component.literal("系統收購功能已關閉。"));

                        }

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

                                    Component.literal("富豪排行榜")

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

                                    Component.literal("富豪排行榜")

                                ));

                                return 1;

                            })

                    )

            );



            dispatcher.register(Commands.literal("claim")

                    .executes(context -> {

                        ServerPlayer player = context.getSource().getPlayer();

                        if (player == null) {

                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));

                            return 0;

                        }

                        return com.craftcore.claim.ClaimManager.purchaseClaim(player);

                    })

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



            dispatcher.register(Commands.literal("checkin")

                    .executes(context -> {

                        ServerPlayer player = context.getSource().getPlayer();

                        if (player == null) {

                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));

                            return 0;

                        }

                        CraftCoreWSClient client = CraftCoreMod.getWSClient();

                        if (client == null || !client.isAuthenticated()) {

                            context.getSource().sendSystemMessage(Component.literal("§c[Craft-Core] §f機器人連線已中斷，請稍後再試！"));

                            return 0;

                        }

                        String username = player.getName().getString();

                        String uuid = player.getStringUUID();

                        client.send(new Packet("checkin_request", new Packet.CheckinRequestPayload(username, uuid)));

                        context.getSource().sendSystemMessage(Component.literal("§b[Craft-Core] §f正在送出簽到請求..."));

                        return 1;

                    })

            );



            dispatcher.register(Commands.literal("luckydraw")

                    .executes(context -> {

                        ServerPlayer player = context.getSource().getPlayer();

                        if (player == null) {

                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));

                            return 0;

                        }

                        CraftCoreWSClient client = CraftCoreMod.getWSClient();

                        if (client == null || !client.isAuthenticated()) {

                            context.getSource().sendSystemMessage(Component.literal("§c[Craft-Core] §f機器人連線已中斷，請稍後再試！"));

                            return 0;

                        }

                        String username = player.getName().getString();

                        String uuid = player.getStringUUID();

                        client.send(new Packet("luckydraw_request", new Packet.LuckydrawRequestPayload(username, uuid)));

                        context.getSource().sendSystemMessage(Component.literal("§b[Craft-Core] §f正在送出抽獎請求..."));

                        return 1;

                    })

            );



            dispatcher.register(Commands.literal("tasks")

                    .executes(context -> {

                        ServerPlayer player = context.getSource().getPlayer();

                        if (player == null) {

                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));

                            return 0;

                        }

                        String username = player.getName().getString();

                        String dateStr = com.craftcore.task.DailyTaskManager.getTaipeiDate();

                        com.craftcore.task.DailyTaskManager.DailyTaskDef[] dailyTasks = com.craftcore.task.DailyTaskManager.getDailyTasks(dateStr);

                        

                        int slayProgress = com.craftcore.economy.EconomyManager.getDailyTaskSlayProgress(username);

                        int mineProgress = com.craftcore.economy.EconomyManager.getDailyTaskGatherProgress(username);

                        boolean slayClaimed = com.craftcore.economy.EconomyManager.getDailyTaskSlayClaimed(username);

                        boolean mineClaimed = com.craftcore.economy.EconomyManager.getDailyTaskGatherClaimed(username);



                        player.sendSystemMessage(Component.literal("§6=================== 今日每日任務 ==================="));

                        player.sendSystemMessage(Component.literal("§e★ 任務日期: " + dateStr));



                        String slayStatus = (slayProgress >= dailyTasks[0].count) ? (slayClaimed ? "§a[已領取]" : "§e[待領取] (請輸入 /tasks claim 領取)") : "§7[未完成]";

                        player.sendSystemMessage(Component.literal("§f- 擊殺 " + dailyTasks[0].target + ": §e" + slayProgress + "§f/§e" + dailyTasks[0].count + " §f(獎金 §e$" + (int)dailyTasks[0].reward + "§f) " + slayStatus));



                        String mineStatus = (mineProgress >= dailyTasks[1].count) ? (mineClaimed ? "§a[已領取]" : "§e[待領取] (請輸入 /tasks claim 領取)") : "§7[未完成]";

                        player.sendSystemMessage(Component.literal("§f- 挖掘 " + dailyTasks[1].target + ": §e" + mineProgress + "§f/§e" + dailyTasks[1].count + " §f(獎金 §e$" + (int)dailyTasks[1].reward + "§f) " + mineStatus));

                        player.sendSystemMessage(Component.literal("§6=================================================="));

                        return 1;

                    })

                    .then(Commands.literal("claim")

                            .executes(context -> {

                                ServerPlayer player = context.getSource().getPlayer();

                                if (player == null) {

                                    context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));

                                    return 0;

                                }

                                String username = player.getName().getString();

                                String dateStr = com.craftcore.task.DailyTaskManager.getTaipeiDate();

                                com.craftcore.task.DailyTaskManager.DailyTaskDef[] dailyTasks = com.craftcore.task.DailyTaskManager.getDailyTasks(dateStr);

                                

                                int slayProgress = com.craftcore.economy.EconomyManager.getDailyTaskSlayProgress(username);

                                boolean slayClaimed = com.craftcore.economy.EconomyManager.getDailyTaskSlayClaimed(username);

                                int mineProgress = com.craftcore.economy.EconomyManager.getDailyTaskGatherProgress(username);

                                boolean mineClaimed = com.craftcore.economy.EconomyManager.getDailyTaskGatherClaimed(username);

                                

                                boolean slayCompletable = (slayProgress >= dailyTasks[0].count) && !slayClaimed;

                                boolean mineCompletable = (mineProgress >= dailyTasks[1].count) && !mineClaimed;

                                

                                if (!slayCompletable && !mineCompletable) {

                                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 您目前沒有待領取的每日任務獎勵！"));

                                    return 1;

                                }

                                

                                if (slayCompletable) {

                                    com.craftcore.economy.EconomyManager.setDailyTaskSlayClaimed(username, true);

                                    com.craftcore.task.DailyTaskManager.completeTask(player, dailyTasks[0]);

                                }

                                if (mineCompletable) {

                                    com.craftcore.economy.EconomyManager.setDailyTaskGatherClaimed(username, true);

                                    com.craftcore.task.DailyTaskManager.completeTask(player, dailyTasks[1]);

                                }

                                return 1;

                            })

                    )

            );

            

             dispatcher.register(Commands.literal("pay")

                     .then(Commands.argument("username", StringArgumentType.string())

                             .then(Commands.argument("amount", DoubleArgumentType.doubleArg(0.01))

                                     .executes(context -> {

                                         ServerPlayer player = context.getSource().getPlayer();

                                         if (player == null) {

                                             context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));

                                             return 0;

                                         }



                                         // 狀態漏洞安全性檢查

                                         if (!player.isAlive()) {

                                             player.sendSystemMessage(Component.literal("§c[Craft-Core] 轉帳失敗：您已死亡。"));

                                             return 0;

                                         }

                                         if (player.isSpectator()) {

                                             player.sendSystemMessage(Component.literal("§c[Craft-Core] 轉帳失敗：旁觀模式下無法執行此操作。"));

                                             return 0;

                                         }

                                         

                                         String sender = player.getName().getString();

                                         String recipient = StringArgumentType.getString(context, "username");

                                         double amount = DoubleArgumentType.getDouble(context, "amount");



                                         // 1. 冷卻時間安全檢查 (1.0 秒)

                                         long now = System.currentTimeMillis();

                                         long lastUsed = payCooldowns.getOrDefault(sender, 0L);

                                         if (now - lastUsed < 1000) {

                                             player.sendSystemMessage(Component.literal("§c[Craft-Core] 轉帳速度過快，請等待 1 秒。"));

                                             return 0;

                                         }



                                         // 2. 名稱欺騙與驗證 (發送者自我轉帳防範與在線 UUID 查核)

                                         if (sender.equalsIgnoreCase(recipient)) {

                                             player.sendSystemMessage(Component.literal("§c[Craft-Core] 轉帳失敗：不能轉帳給自己。"));

                                             return 0;

                                         }



                                         // 檢查接收者是否在線

                                         ServerPlayer recipientPlayer = context.getSource().getServer().getPlayerList().getPlayerByName(recipient);

                                         boolean recipientOnline = (recipientPlayer != null);



                                         // 3. 呼叫原子轉帳核心

                                         com.craftcore.economy.EconomyManager.TransferResult res = com.craftcore.economy.EconomyManager.transferMoney(sender, recipient, amount, recipientOnline);



                                         if (res.success) {

                                             payCooldowns.put(sender, now); // 成功才刷新冷卻時間，避免輸入錯名字被吃冷卻

                                             player.sendSystemMessage(Component.literal("§b[Craft-Core] §f" + res.message));



                                             if (recipientOnline) {

                                                 recipientPlayer.sendSystemMessage(Component.literal("§b[Craft-Core] §a玩家 " + sender + " 向您轉帳了 $" + String.format("%.2f", amount) + " 元！"));

                                             }

                                             

                                             // 伺服器主控台日誌記錄

                                             context.getSource().getServer().sendSystemMessage(Component.literal("[CraftCore-PayLog] " + sender + " transferred $" + amount + " to " + recipient));

                                             return 1;

                                         } else {

                                             player.sendSystemMessage(Component.literal("§c[Craft-Core] " + res.message));

                                             return 0;

                                         }

                                     })

                             )

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



    private static int handleShopControl(CommandContext<CommandSourceStack> context) {

        ServerPlayer player = context.getSource().getPlayer();

        if (player == null) {

            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));

            return 0;

        }

        String coords = StringArgumentType.getString(context, "coords");

        String action = StringArgumentType.getString(context, "action");

        

        String normalized = com.craftcore.shop.ShopManager.getNormalizedKey(coords);

        com.craftcore.shop.ShopManager.Shop shop = com.craftcore.shop.ShopManager.getShop(normalized);

        if (shop == null) {

            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到該座標的商店。"));

            return 0;

        }

        

        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);

        boolean isOwner = shop.player.equals(player.getName().getString()) || isOp;

        

        net.minecraft.server.level.ServerLevel world = (net.minecraft.server.level.ServerLevel) player.level();

        String cleanCoords = com.craftcore.shop.ShopManager.getCleanCoords(shop.id);

        String[] parts = cleanCoords.split(",");

        net.minecraft.core.BlockPos pos = null;

        if (parts.length == 3) {

            try {

                int x = Integer.parseInt(parts[0]);

                int y = Integer.parseInt(parts[1]);

                int z = Integer.parseInt(parts[2]);

                pos = new net.minecraft.core.BlockPos(x, y, z);

            } catch (Throwable t) {}

        }

        

        switch (action.toLowerCase()) {

            case "toggle_infinite":

                if (!isOp) {

                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 您無權修改此商店。"));

                    return 0;

                }

                shop.infinite = !shop.infinite;

                com.craftcore.shop.ShopManager.save();

                if (pos != null) {

                    com.craftcore.shop.ShopManager.updateShopSign(world, pos, shop);

                }

                player.sendSystemMessage(Component.literal("§b[Craft-Core] §f已將商店無限模式設定為: " + (shop.infinite ? "§a啟用" : "§c停用")));

                player.playSound(net.minecraft.sounds.SoundEvents.NOTE_BLOCK_PLING.value(), 1.0f, 1.0f);

                break;

                

            case "toggle_mode":

                if (!isOwner) {

                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 您無權修改此商店。"));

                    return 0;

                }

                double s = shop.sellPrice;

                double b = shop.buyPrice;

                if (s > 0 && b <= 0) { // Buy mode

                    shop.buyPrice = s;

                    shop.sellPrice = 0.0;

                } else if (s <= 0 && b > 0) { // Sell mode

                    shop.sellPrice = b;

                } else { // Buy & Sell or both 0

                    if (shop.sellPrice <= 0) {

                        shop.sellPrice = shop.price > 0 ? shop.price : 1.0;

                    }

                    shop.buyPrice = 0.0;

                }

                com.craftcore.shop.ShopManager.save();

                if (pos != null) {

                    com.craftcore.shop.ShopManager.updateShopSign(world, pos, shop);

                }

                player.sendSystemMessage(Component.literal("§b[Craft-Core] §f已切換商店交易模式。"));

                player.playSound(net.minecraft.sounds.SoundEvents.NOTE_BLOCK_PLING.value(), 1.0f, 1.0f);

                break;

                

            case "price_config":

                if (!isOwner) {

                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 您無權修改此商店。"));

                    return 0;

                }

                com.craftcore.shop.ShopManager.addPriceConfigSession(player.getName().getString(), shop.id);

                player.sendSystemMessage(Component.literal("§b[Craft-Core] §e【步驟 1/2】設定出售價格"));

                player.sendSystemMessage(Component.literal("§f- 請在聊天欄輸入「§a出售價格§f」（玩家買你商品的單價，如: 100）。"));

                player.sendSystemMessage(Component.literal("§f- 若不提供出售，請輸入「§c0§f」或「§cnone§f」。"));

                player.sendSystemMessage(Component.literal("§f- 輸入「§c取消§f」可放棄設定。"));

                break;

                

            case "restock":

                if (!(isOp || (shop.infinite && shop.player.equals(player.getName().getString())))) {

                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 您無權執行此操作。 (僅限無限商店擁有者或管理員)"));

                    return 0;

                }

                if (pos != null) {

                    net.minecraft.world.level.block.entity.BlockEntity be = world.getBlockEntity(pos);

                    if (be instanceof net.minecraft.world.Container container) {

                        try {

                            net.minecraft.world.item.Item shopItem = net.minecraft.core.registries.BuiltInRegistries.ITEM.getValue(net.minecraft.resources.Identifier.parse(shop.item));

                            int maxStack = shopItem.getDefaultMaxStackSize();

                            for (int i = 0; i < container.getContainerSize(); i++) {

                                net.minecraft.world.item.ItemStack stack = container.getItem(i);

                                if (stack.isEmpty()) {

                                    container.setItem(i, new net.minecraft.world.item.ItemStack(shopItem, maxStack));

                                } else if (net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString().equals(shop.item)) {

                                    stack.setCount(maxStack);

                                }

                            }

                            container.setChanged();

                            

                            int stock = 0;

                            for (int i = 0; i < container.getContainerSize(); i++) {

                                net.minecraft.world.item.ItemStack stack = container.getItem(i);

                                if (!stack.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString().equals(shop.item)) {

                                    stock += stack.getCount();

                                }

                            }

                            shop.stock = stock;

                            com.craftcore.shop.ShopManager.save();

                            com.craftcore.shop.ShopManager.updateShopSign(world, pos, shop);

                            player.sendSystemMessage(Component.literal("§b[Craft-Core] §f已將商店商品遠端自動補滿！"));

                            player.playSound(net.minecraft.sounds.SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);

                        } catch (Throwable t) {

                            player.sendSystemMessage(Component.literal("§c[Craft-Core] 補貨失敗，發生錯誤。"));

                        }

                    } else {

                        player.sendSystemMessage(Component.literal("§c[Craft-Core] 商店箱子不存在或無法存取。"));

                    }

                }

                break;

                

            case "clear":

                if (!(isOp || (shop.infinite && shop.player.equals(player.getName().getString())))) {

                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 您無權執行此操作。 (僅限無限商店擁有者或管理員)"));

                    return 0;

                }

                if (pos != null) {

                    net.minecraft.world.level.block.entity.BlockEntity be = world.getBlockEntity(pos);

                    if (be instanceof net.minecraft.world.Container container) {

                        for (int i = 0; i < container.getContainerSize(); i++) {

                            net.minecraft.world.item.ItemStack stack = container.getItem(i);

                            if (!stack.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString().equals(shop.item)) {

                                container.setItem(i, net.minecraft.world.item.ItemStack.EMPTY);

                            }

                        }

                        container.setChanged();

                        shop.stock = 0;

                        com.craftcore.shop.ShopManager.save();

                        com.craftcore.shop.ShopManager.updateShopSign(world, pos, shop);

                        player.sendSystemMessage(Component.literal("§b[Craft-Core] §f已清空箱子中該商店類型的物品！"));

                        player.playSound(net.minecraft.sounds.SoundEvents.CHEST_CLOSE, 1.0f, 1.0f);

                    } else {

                        player.sendSystemMessage(Component.literal("§c[Craft-Core] 商店箱子不存在或無法存取。"));

                    }

                }

                break;

                

            case "toggle_display":

                if (!isOwner) {

                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 您無權修改此商店。"));

                    return 0;

                }

                if (pos != null) {

                    if (shop.displaySpawned) {

                        net.minecraft.world.phys.AABB box = new net.minecraft.world.phys.AABB(pos).inflate(0.4, 0.5, 0.4);

                        java.util.List<net.minecraft.world.entity.Display.ItemDisplay> entities = world.getEntitiesOfClass(

                            net.minecraft.world.entity.Display.ItemDisplay.class, box, entity -> true

                        );

                        for (var entity : entities) {

                            entity.discard();

                        }

                        shop.displaySpawned = false;

                        player.sendSystemMessage(Component.literal("§b[Craft-Core] §f已關閉懸浮物品顯示。"));

                    } else {

                        try {

                            net.minecraft.world.item.Item itemObj = net.minecraft.core.registries.BuiltInRegistries.ITEM.getValue(net.minecraft.resources.Identifier.parse(shop.item));

                            if (itemObj != net.minecraft.world.item.Items.AIR) {

                                net.minecraft.world.entity.Display.ItemDisplay itemDisplay = new net.minecraft.world.entity.Display.ItemDisplay(net.minecraft.world.entity.EntityTypes.ITEM_DISPLAY, world);

                                itemDisplay.setItemStack(new net.minecraft.world.item.ItemStack(itemObj));

                                itemDisplay.setPos(pos.getX() + 0.5, pos.getY() + 1.1, pos.getZ() + 0.5);

                                itemDisplay.setBillboardConstraints(net.minecraft.world.entity.Display.BillboardConstraints.CENTER);

                                itemDisplay.setTransformation(new com.mojang.math.Transformation(

                                    new org.joml.Vector3f(0f, 0f, 0f), 

                                    new org.joml.Quaternionf(0f, 0f, 0f, 1f), 

                                    new org.joml.Vector3f(0.5f, 0.5f, 0.5f), 

                                    new org.joml.Quaternionf(0f, 0f, 0f, 1f)

                                ));

                                world.addFreshEntity(itemDisplay);

                            }

                            shop.displaySpawned = true;

                            player.sendSystemMessage(Component.literal("§b[Craft-Core] §f已開啟懸浮物品顯示。"));

                        } catch (Throwable t) {

                            player.sendSystemMessage(Component.literal("§c[Craft-Core] 開啟懸浮物品顯示失敗。"));

                        }

                    }

                    com.craftcore.shop.ShopManager.save();

                    player.playSound(net.minecraft.sounds.SoundEvents.NOTE_BLOCK_PLING.value(), 1.0f, 1.0f);

                }

                break;

                

            case "history":

                if (!isOwner) {

                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 您無權修改此商店。"));

                    return 0;

                }

                java.util.List<com.craftcore.shop.ShopManager.TransactionLog> logs = com.craftcore.shop.ShopManager.getMerchantLogs(shop.player);

                if (logs.isEmpty()) {

                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 目前沒有任何交易紀錄。"));

                } else {

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

                break;

                

            case "delete":

                if (!isOwner) {

                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 您無權修改此商店。"));

                    return 0;

                }

                if (pos != null) {

                    com.craftcore.shop.ShopGuiManager.cleanupShopVisuals(world, pos);

                }

                com.craftcore.shop.ShopManager.unregisterShop(shop.id);

                player.sendSystemMessage(Component.literal("§b[Craft-Core] §f商店已註銷。"));

                player.playSound(net.minecraft.sounds.SoundEvents.GENERIC_EXPLODE.value(), 1.0f, 1.0f);

                break;

                

            case "buy_session":

                if (shop.sellPrice <= 0) {

                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 此商店目前未出售商品。"));

                    return 0;

                }

                com.craftcore.shop.ShopManager.BuyingSession bSession = new com.craftcore.shop.ShopManager.BuyingSession(shop.id);

                bSession.mode = "buy";

                bSession.step = 1;

                com.craftcore.shop.ShopManager.addBuyingSession(player.getName().getString(), bSession);

                player.sendSystemMessage(Component.literal("§b[Craft-Core] §f您已選擇【購買】。請在聊天欄輸入欲購買的「§a數量§f」（如: 64），或輸入「取消」取消："));

                break;

                

            case "sell_session":

                if (shop.buyPrice <= 0) {

                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 此商店目前未收購商品。"));

                    return 0;

                }

                com.craftcore.shop.ShopManager.BuyingSession sSession = new com.craftcore.shop.ShopManager.BuyingSession(shop.id);

                sSession.mode = "sell";

                sSession.step = 1;

                com.craftcore.shop.ShopManager.addBuyingSession(player.getName().getString(), sSession);

                player.sendSystemMessage(Component.literal("§b[Craft-Core] §f您已選擇【出售】。請在聊天欄輸入欲出售的「§b數量§f」（如: 32），或輸入「取消」取消："));

                break;

                

            default:

                player.sendSystemMessage(Component.literal("§c[Craft-Core] 未知的控制指令類型。"));

                return 0;

        }

        return 1;

    }

}

