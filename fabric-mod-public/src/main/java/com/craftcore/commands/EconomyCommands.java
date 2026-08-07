package com.craftcore.commands;

import com.craftcore.config.ConfigManager;
import com.craftcore.util.PlayerUtil;
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

    public static void removePlayerCooldown(String username) {
        if (username != null) {
            payCooldowns.remove(username.toLowerCase());
            payCooldowns.remove(username);
        }
    }

    public static void cleanupExpiredCooldowns() {
        long now = System.currentTimeMillis();
        payCooldowns.entrySet().removeIf(entry -> now - entry.getValue() > 5000);
    }

    public static class PendingPayTarget {
        public String recipient;
        public long timestamp;
        public PendingPayTarget(String recipient) {
            this.recipient = recipient;
            this.timestamp = System.currentTimeMillis();
        }
    }

    public static class PendingPayConfirm {
        public String recipient;
        public double amount;
        public long timestamp;
        public PendingPayConfirm(String recipient, double amount) {
            this.recipient = recipient;
            this.amount = amount;
            this.timestamp = System.currentTimeMillis();
        }
    }

    private static final java.util.Map<String, PendingPayTarget> pendingPayTargets = new java.util.concurrent.ConcurrentHashMap<>();
    private static final java.util.Map<String, PendingPayConfirm> pendingPayConfirms = new java.util.concurrent.ConcurrentHashMap<>();

    public static void setPendingPayTarget(String sender, String recipient) {
        if (sender != null && recipient != null) {
            pendingPayTargets.put(sender.toLowerCase(), new PendingPayTarget(recipient));
        }
    }

    public static boolean handleChatMessage(ServerPlayer player, String message) {
        if (player == null || message == null) return false;
        String senderKey = player.getName().getString().toLowerCase();

        PendingPayTarget target = pendingPayTargets.get(senderKey);
        if (target != null && (System.currentTimeMillis() - target.timestamp < 60_000)) {
            pendingPayTargets.remove(senderKey);
            String raw = message.trim();
            if (raw.equalsIgnoreCase("cancel") || raw.equalsIgnoreCase("取消")) {
                player.sendSystemMessage(Component.literal("§c[轉帳] 已取消轉帳。"));
                return true;
            }
            try {
                double amount = Double.parseDouble(raw);
                if (amount <= 0) {
                    player.sendSystemMessage(Component.literal("§c[轉帳] 轉帳金額必須大於 0！"));
                    return true;
                }

                pendingPayConfirms.put(senderKey, new PendingPayConfirm(target.recipient, amount));

                Component confirmBtn = Component.literal("§a§l[✔ 點擊確認轉帳 $" + amount + "]")
                        .withStyle(style -> style.withClickEvent(new net.minecraft.network.chat.ClickEvent.RunCommand("/payconfirm confirm"))
                                .withHoverEvent(new net.minecraft.network.chat.HoverEvent.ShowText(Component.literal("點擊扣款並轉帳給 " + target.recipient))));

                Component cancelBtn = Component.literal("§c§l[❌ 點擊取消]")
                        .withStyle(style -> style.withClickEvent(new net.minecraft.network.chat.ClickEvent.RunCommand("/payconfirm cancel"))
                                .withHoverEvent(new net.minecraft.network.chat.HoverEvent.ShowText(Component.literal("點擊取消此筆轉帳"))));

                Component msg = Component.literal("§e[轉帳確認] 確定要轉帳 §a$" + amount + " 元 §e給玩家 §b" + target.recipient + " §e嗎？\n")
                        .append(confirmBtn).append(Component.literal("  ")).append(cancelBtn);

                player.sendSystemMessage(msg);
                return true;
            } catch (NumberFormatException e) {
                player.sendSystemMessage(Component.literal("§c[轉帳] 金額格式不正確，轉帳已取消。"));
                return true;
            }
        }
        return false;
    }

    public static void registerPayConfirmCommand(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("payconfirm")
                .then(Commands.literal("confirm").executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    String senderKey = player.getName().getString().toLowerCase();
                    PendingPayConfirm confirm = pendingPayConfirms.remove(senderKey);
                    if (confirm == null || (System.currentTimeMillis() - confirm.timestamp > 60_000)) {
                        player.sendSystemMessage(Component.literal("§c[轉帳] 沒有待確認的轉帳或已超時！"));
                        return 0;
                    }
                    ServerPlayer recipientPlayer = PlayerUtil.getPlayerCaseInsensitive(player.level().getServer(), confirm.recipient);
                    boolean recipientOnline = (recipientPlayer != null);
                    com.craftcore.economy.EconomyManager.TransferResult res = com.craftcore.economy.EconomyManager.transferMoney(player.getName().getString(), confirm.recipient, confirm.amount, recipientOnline);
                    if (res.success) {
                        player.sendSystemMessage(Component.literal("§b[Craft-Core] §f" + res.message));
                        if (recipientOnline) {
                            recipientPlayer.sendSystemMessage(Component.literal("§b[Craft-Core] §a玩家 " + player.getName().getString() + " 向您轉帳了 $" + String.format("%.2f", confirm.amount) + " 元！"));
                        }
                    } else {
                        player.sendSystemMessage(Component.literal("§c[Craft-Core] " + res.message));
                    }
                    return 1;
                }))
                .then(Commands.literal("cancel").executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player == null) return 0;
                    String senderKey = player.getName().getString().toLowerCase();
                    pendingPayConfirms.remove(senderKey);
                    player.sendSystemMessage(Component.literal("§c[轉帳] 已取消轉帳。"));
                    return 1;
                }))
        );
    }

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        registerPayConfirmCommand(dispatcher);
        dispatcher.register(Commands.literal("events")
                .executes(context -> {
                    if (context.getSource().getEntity() instanceof ServerPlayer player) {
                        com.craftcore.event.EventManager.checkAndNotifyEvents(player, true);
                    }
                    return 1;
                })
        );
        dispatcher.register(Commands.literal("event")
                .executes(context -> {
                    if (context.getSource().getEntity() instanceof ServerPlayer player) {
                        com.craftcore.event.EventManager.checkAndNotifyEvents(player, true);
                    }
                    return 1;
                })
        );

        dispatcher.register(Commands.literal("luckydraw")
                    .executes(context -> {
                        ServerPlayer player = context.getSource().getPlayer();
                        if (player == null) return 0;
                        com.craftcore.menu.MenuGuiManager.openLuckyDrawGui(player);
                        return 1;
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
                                return handleLuckyDrawCommand(player, count);
                            }))
            );

        dispatcher.register(Commands.literal("mushroom")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        com.craftcore.mushroom.MushroomManager.toggleAiChatMode(player);
                    }
                    return 1;
                })
                .then(Commands.literal("get")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                com.craftcore.mushroom.MushroomManager.giveMushroomDirectly(player);
                            }
                            return 1;
                        }))
                .then(Commands.literal("toggle")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                com.craftcore.mushroom.MushroomManager.toggleReceiving(player);
                            }
                            return 1;
                        }))
                .then(Commands.literal("off")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                com.craftcore.mushroom.MushroomManager.setReceivingDisabled(player, true);
                            }
                            return 1;
                        }))
                .then(Commands.literal("on")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                com.craftcore.mushroom.MushroomManager.setReceivingDisabled(player, false);
                            }
                            return 1;
                        }))
                .then(Commands.literal("exit")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                com.craftcore.mushroom.MushroomManager.exitAiChatMode(player);
                            }
                            return 1;
                        }))
                .then(Commands.literal("clear")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                com.craftcore.mushroom.MushroomManager.exitAiChatMode(player);
                                player.sendSystemMessage(Component.literal("§d[洋菇] §a已成功重置記憶與歷史紀錄！"));
                            }
                            return 1;
                        }))
        );

        dispatcher.register(Commands.literal("addmoney")
                    .requires(source -> !source.isPlayer() || source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                    .then(Commands.argument("username", StringArgumentType.string())
                            .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
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
                            .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
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
                        com.craftcore.menu.MenuGuiManager.openCheckInCalendarGui(player);
                        return 1;
                    })
            );

        dispatcher.register(Commands.literal("task")
                .executes(context -> handleTasksCommand(context.getSource().getPlayer()))
                .then(Commands.literal("claim")
                        .executes(context -> handleTasksClaimCommand(context.getSource().getPlayer()))
                )
        );

        dispatcher.register(Commands.literal("tasks")
                .executes(context -> handleTasksCommand(context.getSource().getPlayer()))
                .then(Commands.literal("claim")
                        .executes(context -> handleTasksClaimCommand(context.getSource().getPlayer()))
                )
        );

        dispatcher.register(Commands.literal("pay")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        com.craftcore.menu.MenuGuiManager.openPayPlayerSelectorMenu(player);
                    }
                    return 1;
                })
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

                                         if (Double.isNaN(amount) || Double.isInfinite(amount) || amount <= 0) {
                                             player.sendSystemMessage(Component.literal("§c[Craft-Core] 轉帳失敗：金額必須為大於 0 的有效數字。"));
                                             return 0;
                                         }

                                         // 1. 冷卻時間安全檢查 (1.0 秒)
                                         cleanupExpiredCooldowns();
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

                                         // 檢查接收者是否在線 (大小寫不敏感)
                                         ServerPlayer recipientPlayer = PlayerUtil.getPlayerCaseInsensitive(context.getSource().getServer(), recipient);
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

    public static int handleLuckyDrawCommand(ServerPlayer player, int count) {
        if (player == null) return 0;
        if (player.getInventory().getFreeSlot() == -1) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 抽獎失敗：您的背包已滿，請先清出至少 1 格空間後再進行抽獎！"));
            return 0;
        }
        String username = player.getName().getString();
        int currentKeys = Math.max(0, com.craftcore.economy.EconomyManager.getLotteryKeys(username));
        if (currentKeys <= 0) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您的抽獎鑰匙不足（目前擁有 0 把）！可完成每日簽到 /checkin 或於 Discord 領取。"));
            return 0;
        }

        if (count == 1) {
            com.craftcore.menu.MenuGuiManager.openLuckyDrawGui(player);
            return 1;
        } else {
            return executeBatchLotteryInGame(player, count);
        }
    }

    public static int executeBatchLotteryInGame(ServerPlayer player, int requestedCount) {
        String username = player.getName().getString();
        int currentKeys = Math.max(0, com.craftcore.economy.EconomyManager.getLotteryKeys(username));
        if (currentKeys <= 0) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您的抽獎鑰匙不足（目前擁有 0 把）！可完成每日簽到 /checkin 或於 Discord 領取。"));
            return 0;
        }

        int countToDraw = requestedCount;
        if (countToDraw <= 0 || countToDraw > currentKeys) {
            countToDraw = currentKeys;
        }

        com.craftcore.economy.EconomyManager.setLotteryKeys(username, Math.max(0, currentKeys - countToDraw));

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

    private static int handleTasksCommand(ServerPlayer player) {
        if (player == null) return 0;
        com.craftcore.task.DailyTaskManager.checkAndAutoClaimTasks(player);

        String username = player.getName().getString();
        String dateStr = com.craftcore.task.DailyTaskManager.getTaipeiDate();
        com.craftcore.task.DailyTaskManager.DailyTaskDef[] dailyTasks = com.craftcore.task.DailyTaskManager.getDailyTasks(dateStr);

        int slayProgress = com.craftcore.economy.EconomyManager.getDailyTaskSlayProgress(username);
        int mineProgress = com.craftcore.economy.EconomyManager.getDailyTaskGatherProgress(username);
        boolean slayClaimed = com.craftcore.economy.EconomyManager.getDailyTaskSlayClaimed(username);
        boolean mineClaimed = com.craftcore.economy.EconomyManager.getDailyTaskGatherClaimed(username);

        player.sendSystemMessage(Component.literal("§6=================== 今日每日任務 ==================="));
        player.sendSystemMessage(Component.literal("§e★ 任務日期: " + dateStr));

        String slayStatus = (slayProgress >= dailyTasks[0].count || slayClaimed) ? "§a[已完成 (已自動發放)]" : "§7[未完成]";
        player.sendSystemMessage(Component.literal("§f- 擊殺 " + dailyTasks[0].target + ": §e" + slayProgress + "§f/§e" + dailyTasks[0].count + " §f(獎金 §e$" + (int)dailyTasks[0].reward + "§f) " + slayStatus));

        String mineStatus = (mineProgress >= dailyTasks[1].count || mineClaimed) ? "§a[已完成 (已自動發放)]" : "§7[未完成]";
        player.sendSystemMessage(Component.literal("§f- 挖掘 " + dailyTasks[1].target + ": §e" + mineProgress + "§f/§e" + dailyTasks[1].count + " §f(獎金 §e$" + (int)dailyTasks[1].reward + "§f) " + mineStatus));
        player.sendSystemMessage(Component.literal("§6=================================================="));
        return 1;
    }

    private static int handleTasksClaimCommand(ServerPlayer player) {
        if (player == null) return 0;
        com.craftcore.task.DailyTaskManager.checkAndAutoClaimTasks(player);
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a每日任務達標時已自動發放獎勵，無需手動領取！"));
        return 1;
    }
}
