package com.craftcore.commands;

import com.craftcore.audit.AuditBridge;
import com.craftcore.websocket.Packet;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.permissions.Permissions;

import java.util.List;

public class AuditCommand {
    private static void dispatchOnServer(CommandSourceStack source, Runnable action) {
        MinecraftServer server = source.getServer();
        if (server != null) {
            server.execute(action);
        } else {
            action.run();
        }
    }

    private static void printList(CommandSourceStack source, List<Packet.AuditWarpEntry> audits) {
        if (audits == null || audits.isEmpty()) {
            source.sendSystemMessage(Component.literal("§e目前沒有待審核的 Warp 申請。"));
            return;
        }
        source.sendSystemMessage(Component.literal("§b=== 待審核 Warp 清單 (" + audits.size() + ") ==="));
        for (Packet.AuditWarpEntry a : audits) {
            source.sendSystemMessage(Component.literal(
                    String.format("§f[%s] §e%s §7(申請者: %s, 座標: %s, %s)", a.id, a.name, a.applicant, a.coords, a.dimension)
            ));
        }
    }

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("audit")
                .requires(source -> !source.isPlayer() || source.permissions().hasPermission(Permissions.COMMANDS_OWNER))
                .then(Commands.literal("list")
                        .executes(context -> {
                            CommandSourceStack source = context.getSource();
                            source.sendSystemMessage(Component.literal("§e正在向 Discord 審核中心查詢待審 Warp 清單..."));
                            AuditBridge.queryPendingWarps().whenComplete((audits, ex) ->
                                    dispatchOnServer(source, () -> printList(source, audits)));
                            return 1;
                        })
                )
                .then(Commands.literal("approve")
                        .then(Commands.argument("id", StringArgumentType.string())
                                .executes(context -> {
                                    CommandSourceStack source = context.getSource();
                                    String id = StringArgumentType.getString(context, "id");
                                    String adminName = source.getTextName();
                                    source.sendSystemMessage(Component.literal("§e正在送出核准請求 #" + id + " ..."));
                                    AuditBridge.decideWarp(id, "approve", adminName).whenComplete((resp, ex) ->
                                            dispatchOnServer(source, () -> {
                                                if (resp != null && resp.success) {
                                                    source.sendSystemMessage(Component.literal("§a成功核准 Warp 申請 #" + id + "，已設立公共傳送點。"));
                                                } else {
                                                    source.sendSystemMessage(Component.literal("§c核准失敗：找不到該申請或伺服器未連線。"));
                                                }
                                            }));
                                    return 1;
                                })
                        )
                )
                .then(Commands.literal("reject")
                        .then(Commands.argument("id", StringArgumentType.string())
                                .executes(context -> {
                                    CommandSourceStack source = context.getSource();
                                    String id = StringArgumentType.getString(context, "id");
                                    String adminName = source.getTextName();
                                    source.sendSystemMessage(Component.literal("§e正在送出駁回請求 #" + id + " ..."));
                                    AuditBridge.decideWarp(id, "reject", adminName).whenComplete((resp, ex) ->
                                            dispatchOnServer(source, () -> {
                                                if (resp != null && resp.success) {
                                                    source.sendSystemMessage(Component.literal("§e已駁回 Warp 申請 #" + id + "。"));
                                                } else {
                                                    source.sendSystemMessage(Component.literal("§c駁回失敗：找不到該申請或伺服器未連線。"));
                                                }
                                            }));
                                    return 1;
                                })
                        )
                )
        );
    }
}
