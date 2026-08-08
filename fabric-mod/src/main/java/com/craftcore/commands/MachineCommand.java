package com.craftcore.commands;

import com.craftcore.machine.MachineManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.Permissions;

import java.util.List;

public class MachineCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("machine")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        com.craftcore.menu.MenuGuiManager.openMachineMenu(player);
                    }
                    return 1;
                })
                .then(Commands.literal("apply")
                        .then(Commands.argument("name", StringArgumentType.greedyString())
                                .executes(context -> {
                                    ServerPlayer player = context.getSource().getPlayer();
                                    if (player == null) {
                                        context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
                                        return 0;
                                    }
                                    String name = StringArgumentType.getString(context, "name");
                                    String id = MachineManager.applyMachine(player, name);
                                    com.craftcore.audit.AuditBridge.submitMachineAudit(
                                            player.getName().getString(), player.getStringUUID(), id, name.trim(),
                                            player.getBlockX(), player.getBlockY(), player.getBlockZ(),
                                            player.level().dimension().identifier().toString()
                                    );
                                    player.sendSystemMessage(Component.literal("§a[Craft-Core] 機器審核申請已提交！申請編號: §e" + id + "§a。通過管理員認證後可免除領地維護費並獲得專屬稱號！"));
                                    return 1;
                                })
                        )
                )
                .then(Commands.literal("admin")
                        .requires(source -> !source.isPlayer() || source.permissions().hasPermission(Permissions.COMMANDS_OWNER))
                        .then(Commands.literal("list")
                                .executes(context -> {
                                    List<MachineManager.MachineEntry> pending = MachineManager.getPendingMachines();
                                    if (pending.isEmpty()) {
                                        context.getSource().sendSystemMessage(Component.literal("§e目前沒有待審核的機器申請。"));
                                        return 1;
                                    }
                                    context.getSource().sendSystemMessage(Component.literal("§b=== 待審核機器清單 (" + pending.size() + ") ==="));
                                    for (MachineManager.MachineEntry m : pending) {
                                        context.getSource().sendSystemMessage(Component.literal(
                                                String.format("§f[%s] §e%s §7(擁有者: %s, 座標: %d, %d, %d)", m.id, m.name, m.owner, m.x, m.y, m.z)
                                        ));
                                    }
                                    return 1;
                                })
                        )
                        .then(Commands.literal("approve")
                                .then(Commands.argument("id", StringArgumentType.string())
                                        .suggests((context, builder) -> net.minecraft.commands.SharedSuggestionProvider.suggest(MachineManager.getPendingMachines().stream().map(m -> m.id), builder))
                                        .then(Commands.argument("tier", StringArgumentType.string())
                                                .suggests((context, builder) -> net.minecraft.commands.SharedSuggestionProvider.suggest(new String[]{"T1", "T2", "T3"}, builder))
                                                .executes(context -> {
                                                    String id = StringArgumentType.getString(context, "id");
                                                    String tier = StringArgumentType.getString(context, "tier");
                                                    String adminName = context.getSource().getTextName();
                                                    boolean success = MachineManager.approveMachine(context.getSource().getServer(), id, tier, adminName);
                                                    if (success) {
                                                        context.getSource().sendSystemMessage(Component.literal("§a成功審核通過機器 " + id + " (等級: " + tier.toUpperCase() + ")！"));
                                                    } else {
                                                        context.getSource().sendSystemMessage(Component.literal("§c找不到該機器申請 ID: " + id));
                                                    }
                                                    return 1;
                                                })
                                        )
                                )
                        )
                        .then(Commands.literal("reject")
                                .then(Commands.argument("id", StringArgumentType.string())
                                        .suggests((context, builder) -> net.minecraft.commands.SharedSuggestionProvider.suggest(MachineManager.getPendingMachines().stream().map(m -> m.id), builder))
                                        .executes(context -> {
                                            String id = StringArgumentType.getString(context, "id");
                                            String adminName = context.getSource().getTextName();
                                            boolean success = MachineManager.rejectMachine(context.getSource().getServer(), id, adminName);
                                            if (success) {
                                                context.getSource().sendSystemMessage(Component.literal("§e已駁回機器申請 " + id + "。"));
                                            } else {
                                                context.getSource().sendSystemMessage(Component.literal("§c找不到該機器申請 ID: " + id));
                                            }
                                            return 1;
                                        })
                                )
                        )
                )
        );
    }
}
