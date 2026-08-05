package com.craftcore.commands;

import com.craftcore.claim.ClaimManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.BoolArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemLore;

import java.util.List;

public class ClaimCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("claim")
                    .executes(context -> {
                        ServerPlayer player = context.getSource().getPlayer();
                        if (player == null) {
                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                            return 0;
                        }
                        return ClaimManager.purchaseClaim(player);
                    })
                    .then(Commands.literal("hud")
                            .executes(ClaimCommand::toggleHud)
                    )
                    .then(Commands.literal("actionbar")
                            .executes(ClaimCommand::toggleHud)
                    )
                    .then(Commands.literal("list")
                            .executes(ClaimCommand::listClaims)
                    )
                    .then(Commands.literal("transfer")
                            .then(Commands.argument("target", StringArgumentType.string())
                                    .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                                    .executes(context -> handleTransferClaim(context, StringArgumentType.getString(context, "target"), null))
                                    .then(Commands.argument("claimName", StringArgumentType.string())
                                            .executes(context -> handleTransferClaim(context, StringArgumentType.getString(context, "target"), StringArgumentType.getString(context, "claimName")))
                                    )
                            )
                    )
                    .then(Commands.literal("accept")
                            .executes(ClaimCommand::handleAcceptTransfer)
                    )
                    .then(Commands.literal("tool")
                            .executes(ClaimCommand::giveClaimTool)
                    )
                    .then(Commands.literal("tools")
                            .executes(ClaimCommand::giveClaimTool)
                    )
                    .then(Commands.literal("wand")
                            .executes(ClaimCommand::giveClaimTool)
                    )
                    .then(Commands.literal("flag")
                            .then(Commands.argument("type", StringArgumentType.string())
                                    .suggests((context, builder) -> SharedSuggestionProvider.suggest(new String[]{"container", "interact", "entry"}, builder))
                                    .then(Commands.argument("value", BoolArgumentType.bool())
                                            .executes(context -> {
                                                ServerPlayer player = context.getSource().getPlayer();
                                                if (player == null) return 0;
                                                String type = StringArgumentType.getString(context, "type");
                                                boolean val = BoolArgumentType.getBool(context, "value");
                                                
                                                ClaimManager.Claim claim = ClaimManager.getClaimAt(player.blockPosition(), player.level());
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
                                                ClaimManager.save();
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
                                        
                                        ClaimManager.Claim claim = ClaimManager.getClaimAt(player.blockPosition(), player.level());
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
                                        ClaimManager.save();
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
                                        
                                        ClaimManager.Claim claim = ClaimManager.getClaimAt(player.blockPosition(), player.level());
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
                                        ClaimManager.save();
                                        player.sendSystemMessage(Component.literal("§a[領地] 已成功將玩家 §e" + target + " §a自黑名單解封！"));
                                        return 1;
                                    })
                            )
                    )
            );
    }

    private static int listClaims(CommandContext<CommandSourceStack> context) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        String username = player.getName().getString();
        List<ClaimManager.Claim> myClaims = ClaimManager.getPlayerClaims(username);

        player.sendSystemMessage(Component.literal("§6=================== 我的領地清單 ==================="));
        if (myClaims.isEmpty()) {
            player.sendSystemMessage(Component.literal("§7您目前尚未擁有任何劃分領地。"));
            player.sendSystemMessage(Component.literal("§e提示: 輸入 /claim tool 免費領取木鋤圈選對角點後，輸入 /claim 即可購買！"));
        } else {
            for (ClaimManager.Claim c : myClaims) {
                String c1 = (c.corners != null && c.corners.length > 0) ? c.corners[0] : "未知";
                String c2 = (c.corners != null && c.corners.length > 1) ? c.corners[1] : "未知";
                player.sendSystemMessage(Component.literal("§e★ 領地名稱: §f" + (c.name != null ? c.name : c.id) + " §7(大小: §a" + c.chunks + " §7區塊)"));
                player.sendSystemMessage(Component.literal("§7  維度: §b" + c.dimension + " §7| 對角座標: §f" + c1 + " ~ " + c2));
                player.sendSystemMessage(Component.literal("§7  標籤: 公開容器[" + (c.public_containers ? "§a開啟" : "§c關閉") + "§7], 設施[" + (c.public_interact ? "§a開啟" : "§c關閉") + "§7], 允許進入[" + (c.public_entry ? "§a開啟" : "§c關閉") + "§7]"));
            }
        }
        player.sendSystemMessage(Component.literal("§6=================================================="));
        return 1;
    }

    private static int giveClaimTool(CommandContext<CommandSourceStack> context) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) {
            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
            return 0;
        }

        ItemStack tool = new ItemStack(Items.WOODEN_HOE);
        tool.set(DataComponents.CUSTOM_NAME, Component.literal("§6[🛡 領地圈地神杖]"));
        tool.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal("§7手持此神杖可用於劃分領地範圍"),
                Component.literal("§e- 左鍵點擊方塊: 設置對角點 1 (Pos1)"),
                Component.literal("§e- 右鍵點擊方塊: 設置對角點 2 (Pos2)"),
                Component.literal("§a- 選擇完成後輸入 /claim 創建劃分領地！")
        )));

        if (!player.getInventory().add(tool)) {
            player.drop(tool, false);
        }
        player.sendSystemMessage(Component.literal("§a[Craft-Core] 成功發放 §6[🛡 領地圈地神杖]§a！手持木鋤左鍵/右鍵點擊方塊即可選擇領地對角點。"));
        return 1;
    }

    private static int toggleHud(CommandContext<CommandSourceStack> context) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) {
            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
            return 0;
        }
        boolean enabled = ClaimManager.toggleHud(player.getUUID());
        player.sendSystemMessage(Component.literal("§b[Craft-Core] " + (enabled ? "§a已開啟快捷欄上方領地提示 (ActionBar)！" : "§c已關閉快捷欄上方領地提示 (ActionBar)。")));
        return 1;
    }

    private static int handleTransferClaim(CommandContext<CommandSourceStack> context, String targetName, String targetClaimName) {
        ServerPlayer sender = context.getSource().getPlayer();
        if (sender == null) return 0;

        String senderName = sender.getName().getString();
        if (senderName.equalsIgnoreCase(targetName)) {
            sender.sendSystemMessage(Component.literal("§c[Craft-Core] 您不能將領地轉讓給自己！"));
            return 0;
        }

        ServerPlayer targetPlayer = context.getSource().getServer().getPlayerList().getPlayerByName(targetName);
        if (targetPlayer == null) {
            sender.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到目標線上玩家：" + targetName));
            return 0;
        }

        ClaimManager.Claim claimToTransfer = null;
        if (targetClaimName != null && !targetClaimName.isEmpty()) {
            for (ClaimManager.Claim c : ClaimManager.getPlayerClaims(senderName)) {
                if (targetClaimName.equalsIgnoreCase(c.name) || targetClaimName.equalsIgnoreCase(c.id)) {
                    claimToTransfer = c;
                    break;
                }
            }
        } else {
            claimToTransfer = ClaimManager.getClaimAt(sender.blockPosition(), sender.level());
        }

        if (claimToTransfer == null) {
            sender.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到您擁有的指定領地，請站在該領地內或指定領地名稱！"));
            return 0;
        }

        boolean isOp = sender.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
        if (!claimToTransfer.owner.equalsIgnoreCase(senderName) && !isOp) {
            sender.sendSystemMessage(Component.literal("§c[Craft-Core] 您不是該領地的擁有者，無法發起轉讓！"));
            return 0;
        }

        String displayName = (claimToTransfer.name != null ? claimToTransfer.name : claimToTransfer.id);
        ClaimManager.addTransferRequest(senderName, targetName, claimToTransfer.id, displayName);

        sender.sendSystemMessage(Component.literal("§a[Craft-Core] 已向玩家 §e" + targetName + " §a發送領地 §f[" + displayName + "] §a轉讓請求，等待對方確認！"));
        targetPlayer.sendSystemMessage(Component.literal("§6=================================================="));
        targetPlayer.sendSystemMessage(Component.literal("§e[Craft-Core] 玩家 §f" + senderName + " §e想將領地 §f[" + displayName + "] §e轉讓給您！"));
        targetPlayer.sendSystemMessage(Component.literal("§7接收領地需支付 §a$30 §7元手續費（由系統銷毀）。"));
        targetPlayer.sendSystemMessage(Component.literal("§a請在 2 分鐘內輸入 §e/claim accept §a確認接收！"));
        targetPlayer.sendSystemMessage(Component.literal("§6=================================================="));
        return 1;
    }

    private static int handleAcceptTransfer(CommandContext<CommandSourceStack> context) {
        ServerPlayer receiver = context.getSource().getPlayer();
        if (receiver == null) return 0;

        String receiverName = receiver.getName().getString();
        ClaimManager.TransferRequest req = ClaimManager.getTransferRequest(receiverName);

        if (req == null) {
            receiver.sendSystemMessage(Component.literal("§c[Craft-Core] 您目前沒有待處理的領地轉讓請求！"));
            return 0;
        }

        double balance = com.craftcore.economy.EconomyManager.getBalance(receiverName);
        if (balance < 30.0) {
            receiver.sendSystemMessage(Component.literal("§c[Craft-Core] 您的餘額不足 $30 元 (目前: $" + String.format("%.2f", balance) + ")，無法接收領地！"));
            return 0;
        }

        // Deduct $30 fee and destroy
        com.craftcore.economy.EconomyManager.removeMoney(receiverName, 30.0);
        boolean success = ClaimManager.transferClaim(req.claimId, receiverName);

        if (success) {
            ClaimManager.removeTransferRequest(receiverName);
            receiver.sendSystemMessage(Component.literal("§b[Craft-Core] §a您已成功支付 $30 元手續費，並成為領地 §f[" + req.claimName + "] §a的新領主！"));

            ServerPlayer sender = context.getSource().getServer().getPlayerList().getPlayerByName(req.fromPlayer);
            if (sender != null) {
                sender.sendSystemMessage(Component.literal("§b[Craft-Core] §a玩家 §e" + receiverName + " §a已接受您的領地轉讓，領地 §f[" + req.claimName + "] §a已順利移交！"));
            }
            return 1;
        } else {
            receiver.sendSystemMessage(Component.literal("§c[Craft-Core] 轉讓失敗，找不到該領地資料。"));
            return 0;
        }
    }
}
