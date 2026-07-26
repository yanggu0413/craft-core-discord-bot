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

public class EconomyCommands {

    private static final java.util.Map<String, Long> payCooldowns = new java.util.concurrent.ConcurrentHashMap<>();

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
dispatcher.register(Commands.literal("events")
                    .executes(context -> {
                        if (context.getSource().getEntity() instanceof ServerPlayer player) {
                            com.craftcore.event.EventManager.checkAndNotifyEvents(player);
                        }
                        return 1;
                    })
            );

dispatcher.register(Commands.literal("luckydraw")
                    .executes(context -> {
                        ServerPlayer player = context.getSource().getPlayer();
                        if (player == null) return 0;
                        return executeBatchLotteryInGame(player, 1);
                    })
                    .then(Commands.argument("count", com.mojang.brigadier.arguments.StringArgumentType.string())
                            .executes(context -> {
                                ServerPlayer player = context.getSource().getPlayer();
                                if (player == null) return 0;
                                String arg = com.mojang.brigadier.arguments.StringArgumentType.getString(context, "count");
                                int count = 1;
                                if (arg.equalsIgnoreCase("all")) {
                                    count = -1;
                                } else {
                                    try {
                                        count = Integer.parseInt(arg);
                                    } catch (NumberFormatException e) {
                                        count = 1;
                                    }
                                }
                                return executeBatchLotteryInGame(player, count);
                            }))
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

                        if (player.getInventory().getFreeSlot() == -1) {
                            context.getSource().sendSystemMessage(Component.literal("§c[Craft-Core] 抽獎失敗：您的背包已滿，請先清出至少 1 格空間後再進行抽獎！"));
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

                             .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))

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
    }

    public static int executeBatchLotteryInGame(ServerPlayer player, int requestedCount) {
        String username = player.getName().getString();
        int currentKeys = com.craftcore.economy.EconomyManager.getLotteryKeys(username);
        if (currentKeys <= 0) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您的抽獎鑰匙不足（目前擁有 0 把）！可完成每日簽到 /checkin 或於 Discord 領取。"));
            return 0;
        }

        int countToDraw = requestedCount;
        if (countToDraw <= 0 || countToDraw > currentKeys) {
            countToDraw = currentKeys;
        }

        com.craftcore.economy.EconomyManager.setLotteryKeys(username, currentKeys - countToDraw);

        String[] items = {
            "minecraft:diamond:5:鑽石 x 5",
            "minecraft:golden_carrot:5:金胡蘿蔔 x 5",
            "minecraft:golden_apple:5:金蘋果 x 5",
            "minecraft:experience_bottle:64:經驗瓶 x 64",
            "minecraft:totem_of_undying:1:不死圖騰 x 1",
            "craftcore:money:150:遊戲金幣"
        };

        java.util.Map<String, Integer> itemSummary = new java.util.LinkedHashMap<>();
        double totalMoney = 0;
        java.util.Random rand = new java.util.Random();

        for (int i = 0; i < countToDraw; i++) {
            totalMoney += 150.0;
            String selected = items[rand.nextInt(items.length)];
            String[] parts = selected.split(":");
            String id = parts[0] + ":" + parts[1];
            int qty = Integer.parseInt(parts[2]);
            String name = parts[3];

            if (id.equals("craftcore:money")) {
                double extra = 50 + rand.nextInt(150);
                totalMoney += extra;
            } else {
                itemSummary.put(name, itemSummary.getOrDefault(name, 0) + qty);
                net.minecraft.world.item.Item item = net.minecraft.core.registries.BuiltInRegistries.ITEM.getValue(net.minecraft.resources.Identifier.parse(id));
                if (item != null) {
                    net.minecraft.world.item.ItemStack stack = new net.minecraft.world.item.ItemStack(item, qty);
                    if (!player.getInventory().add(stack)) {
                        player.drop(stack, false);
                    }
                }
            }
        }

        if (totalMoney > 0) {
            com.craftcore.economy.EconomyManager.addMoney(username, totalMoney);
        }

        player.playSound(net.minecraft.sounds.SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a🎉 成功消耗 §e" + countToDraw + " §a把鑰匙，完成批量抽獎！"));
        player.sendSystemMessage(Component.literal("§e★ 共獲得金幣：§a$" + (int)totalMoney + " 元"));
        if (!itemSummary.isEmpty()) {
            StringBuilder sb = new StringBuilder("§e★ 獲得物資：§f");
            itemSummary.forEach((k, v) -> sb.append(k).append(" x").append(v).append(", "));
            String msg = sb.toString();
            player.sendSystemMessage(Component.literal(msg.substring(0, msg.length() - 2)));
        }
        return 1;
    }

}
