package com.craftcore.commands;

import com.craftcore.claim.LockboxGuiManager;
import com.craftcore.claim.LockboxManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.ChestBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;

public class LockboxCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("padlock")
                .executes(context -> openOrLock(context.getSource().getPlayer()))
                .then(Commands.literal("lock")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                LockboxManager.startLockSession(player);
                            }
                            return 1;
                        })
                )
                .then(Commands.literal("remove")
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            if (player != null) {
                                removeLock(player);
                            }
                            return 1;
                        })
                )
                .then(Commands.literal("grant")
                        .then(Commands.argument("target", StringArgumentType.word())
                                .executes(context -> {
                                    ServerPlayer player = context.getSource().getPlayer();
                                    String target = StringArgumentType.getString(context, "target");
                                    if (player != null) {
                                        LockboxManager.grantAccess(player, target);
                                    }
                                    return 1;
                                })
                        )
                )
                .then(Commands.argument("password", StringArgumentType.word())
                        .executes(context -> {
                            ServerPlayer player = context.getSource().getPlayer();
                            String pwd = StringArgumentType.getString(context, "password");
                            if (player != null) {
                                tryUnlock(player, pwd);
                            }
                            return 1;
                        })
                )
        );

        dispatcher.register(Commands.literal("lockbox")
                .executes(context -> openOrLock(context.getSource().getPlayer()))
        );
    }

    private static int openOrLock(ServerPlayer player) {
        if (player == null) return 0;
        BlockPos pos = getTargetChestPos(player);
        if (pos != null) {
            LockboxGuiManager.openLockboxGui(player, pos);
            return 1;
        }
        player.sendSystemMessage(Component.literal("§c[密碼鎖] 請正對看著一個箱子（最大距離 5 格）！"));
        return 0;
    }

    private static void removeLock(ServerPlayer player) {
        BlockPos pos = getTargetChestPos(player);
        if (pos == null) {
            player.sendSystemMessage(Component.literal("§c[密碼鎖] 請正對看著欲拆除密碼鎖的箱子（最大距離 5 格）！"));
            return;
        }
        String key = LockboxManager.getLockboxKey(player.level(), pos);
        LockboxManager.Lockbox lockbox = LockboxManager.getLockbox(key);
        if (lockbox == null) {
            player.sendSystemMessage(Component.literal("§c[密碼鎖] 此箱子尚未安裝密碼鎖！"));
            return;
        }

        String username = player.getName().getString();
        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
        if (!lockbox.owner.equalsIgnoreCase(username) && !isOp) {
            player.sendSystemMessage(Component.literal("§c[密碼鎖] 您無權拆除此箱子的密碼鎖！"));
            return;
        }

        LockboxManager.removeLockbox(key);
        player.sendSystemMessage(Component.literal("§b[密碼鎖] §a已成功拆除並解開此箱子的密碼鎖！"));
    }

    private static void tryUnlock(ServerPlayer player, String password) {
        BlockPos pos = getTargetChestPos(player);
        if (pos == null) {
            player.sendSystemMessage(Component.literal("§c[密碼鎖] 請正對看著要解鎖的密碼箱（最大距離 5 格）！"));
            return;
        }
        String key = LockboxManager.getLockboxKey(player.level(), pos);
        LockboxManager.Lockbox lockbox = LockboxManager.getLockbox(key);
        if (lockbox == null) {
            player.sendSystemMessage(Component.literal("§c[密碼鎖] 此箱子並未設定密碼鎖，可直接開啟！"));
            return;
        }

        String username = player.getName().getString();
        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
        if (lockbox.owner.equalsIgnoreCase(username) || isOp || lockbox.authorized.contains(username) || LockboxManager.verifyPassword(password, lockbox.password)) {
            player.sendSystemMessage(Component.literal("§b[密碼鎖] §a密碼正確！已為您驗證成功並開啟密碼箱！"));
            player.openMenu(player.level().getBlockState(pos).getMenuProvider(player.level(), pos));
        } else {
            player.sendSystemMessage(Component.literal("§c[密碼鎖] 密碼錯誤！解鎖失敗。"));
        }
    }

    public static BlockPos getTargetChestPos(ServerPlayer player) {
        if (player == null) return null;
        HitResult hit = player.pick(5.0, 0.0F, false);
        if (hit.getType() == HitResult.Type.BLOCK) {
            BlockHitResult blockHit = (BlockHitResult) hit;
            BlockPos pos = blockHit.getBlockPos();
            Level world = player.level();
            BlockState state = world.getBlockState(pos);
            if (state.getBlock() instanceof ChestBlock) {
                return pos;
            }
        }
        return null;
    }
}
