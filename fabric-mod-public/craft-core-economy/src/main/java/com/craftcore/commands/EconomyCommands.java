package com.craftcore.commands;

import com.craftcore.economy.EcoTopScreenHandler;
import com.craftcore.economy.EconomyManager;
import com.craftcore.gui.MenuRegistry;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.DoubleArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.SimpleMenuProvider;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class EconomyCommands {

    private static final Map<String, Long> payCooldowns = new ConcurrentHashMap<>();

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

    private static final Map<String, PendingPayTarget> pendingPayTargets = new ConcurrentHashMap<>();
    private static final Map<String, PendingPayConfirm> pendingPayConfirms = new ConcurrentHashMap<>();

    public static void setPendingPayTarget(String sender, String recipient) {
        if (sender != null && recipient != null) {
            pendingPayTargets.put(sender.toLowerCase(), new PendingPayTarget(recipient));
        }
    }

    public static ServerPlayer getPlayerCaseInsensitive(MinecraftServer server, String username) {
        if (server == null || username == null) return null;
        ServerPlayer exact = server.getPlayerList().getPlayerByName(username);
        if (exact != null) return exact;
        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            if (player.getName().getString().equalsIgnoreCase(username)) {
                return player;
            }
        }
        return null;
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
                        .withStyle(style -> style.withClickEvent(new ClickEvent.RunCommand("/payconfirm confirm"))
                                .withHoverEvent(new HoverEvent.ShowText(Component.literal("點擊扣款並轉帳給 " + target.recipient))));

                Component cancelBtn = Component.literal("§c§l[❌ 點擊取消]")
                        .withStyle(style -> style.withClickEvent(new ClickEvent.RunCommand("/payconfirm cancel"))
                                .withHoverEvent(new HoverEvent.ShowText(Component.literal("點擊取消此筆轉帳"))));

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
                    ServerPlayer recipientPlayer = getPlayerCaseInsensitive(player.level().getServer(), confirm.recipient);
                    boolean recipientOnline = (recipientPlayer != null);
                    EconomyManager.TransferResult res = EconomyManager.transferMoney(player.getName().getString(), confirm.recipient, confirm.amount, recipientOnline);
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

        dispatcher.register(Commands.literal("addmoney")
                .requires(source -> !source.isPlayer() || source.permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER))
                .then(Commands.argument("username", StringArgumentType.string())
                        .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                        .then(Commands.argument("amount", DoubleArgumentType.doubleArg(0.0))
                                .executes(context -> {
                                    String username = StringArgumentType.getString(context, "username");
                                    double amount = DoubleArgumentType.getDouble(context, "amount");
                                    boolean success = EconomyManager.addMoney(username, amount);
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
                                    boolean success = EconomyManager.removeMoney(username, amount);
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
                        player.sendSystemMessage(Component.literal("§c❌ 本伺服器已全面啟用玩家自由市場經濟！請使用 /shop 與其他玩家交易，或 /economy top 查看富豪榜。"));
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
                                (syncId, playerInv, playerEntity) -> new EcoTopScreenHandler(syncId, playerInv),
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
                                (syncId, playerInv, playerEntity) -> new EcoTopScreenHandler(syncId, playerInv),
                                Component.literal("富豪排行榜")
                            ));
                            return 1;
                        })
                )
        );

        dispatcher.register(Commands.literal("pay")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        if (MenuRegistry.isRegistered("pay:selector")) {
                            MenuRegistry.openMenu("pay:selector", player);
                        } else {
                            player.sendSystemMessage(Component.literal("§b[Craft-Core] §f請使用指令 §e/pay <玩家名稱> <金額> §f進行轉帳。"));
                        }
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

                                    cleanupExpiredCooldowns();
                                    long now = System.currentTimeMillis();
                                    long lastUsed = payCooldowns.getOrDefault(sender, 0L);

                                    if (now - lastUsed < 1000) {
                                        player.sendSystemMessage(Component.literal("§c[Craft-Core] 轉帳速度過快，請等待 1 秒。"));
                                        return 0;
                                    }

                                    if (sender.equalsIgnoreCase(recipient)) {
                                        player.sendSystemMessage(Component.literal("§c[Craft-Core] 轉帳失敗：不能轉帳給自己。"));
                                        return 0;
                                    }

                                    ServerPlayer recipientPlayer = getPlayerCaseInsensitive(context.getSource().getServer(), recipient);
                                    boolean recipientOnline = (recipientPlayer != null);

                                    EconomyManager.TransferResult res = EconomyManager.transferMoney(sender, recipient, amount, recipientOnline);

                                    if (res.success) {
                                        payCooldowns.put(sender, now);
                                        player.sendSystemMessage(Component.literal("§b[Craft-Core] §f" + res.message));

                                        if (recipientOnline) {
                                            recipientPlayer.sendSystemMessage(Component.literal("§b[Craft-Core] §a玩家 " + sender + " 向您轉帳了 $" + String.format("%.2f", amount) + " 元！"));
                                        }

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
}
