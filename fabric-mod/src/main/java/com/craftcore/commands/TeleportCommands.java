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

public class TeleportCommands {

    private static final java.util.Map<String, Long> rtpCooldowns = new java.util.concurrent.ConcurrentHashMap<>();

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
dispatcher.register(Commands.literal("back")
                    .executes(context -> {
                        if (context.getSource().getEntity() instanceof ServerPlayer player) {
                            com.craftcore.teleport.BackManager.executeBack(player);
                        }
                        return 1;
                    })
            );

dispatcher.register(Commands.literal("workbench")
                    .executes(context -> {
                        ServerPlayer player = context.getSource().getPlayer();
                        if (player == null) {
                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家使用。"));
                            return 0;
                        }

                        player.openMenu(new SimpleMenuProvider(
                                (syncId, playerInventory, menuPlayer) ->
                                        new PortableCraftingMenu(syncId, playerInventory),
                                Component.literal("隨身工作台")
                        ));
                        return 1;
                    })
            );

dispatcher.register(Commands.literal("enderchest")
                    .executes(context -> {
                        ServerPlayer player = context.getSource().getPlayer();
                        if (player == null) {
                            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家使用。"));
                            return 0;
                        }

                        player.openMenu(new SimpleMenuProvider(
                                (syncId, playerInventory, menuPlayer) ->
                                        net.minecraft.world.inventory.ChestMenu.threeRows(
                                                syncId, playerInventory, player.getEnderChestInventory()),
                                Component.literal("隨身終界箱")
                        ));
                        return 1;
                    })
            );

dispatcher.register(Commands.literal("tpa")
                    .then(Commands.literal("cancel")
                            .executes(context -> handleTpaCancelCommand(context, null))
                            .then(Commands.argument("target", StringArgumentType.string())
                                    .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                                    .executes(context -> handleTpaCancelCommand(context, StringArgumentType.getString(context, "target")))
                            )
                    )
                    .then(Commands.argument("target", StringArgumentType.string())
                            .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                            .executes(context -> handleTpaCommand(context, false))
                    )
            );

dispatcher.register(Commands.literal("tpahere")
                    .then(Commands.argument("target", StringArgumentType.string())
                            .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                            .executes(context -> handleTpaCommand(context, true))
                    )
            );

dispatcher.register(Commands.literal("tpaccept")
                    .executes(context -> handleTpAcceptCommand(context, null))
                    .then(Commands.argument("target", StringArgumentType.string())
                            .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                            .executes(context -> handleTpAcceptCommand(context, StringArgumentType.getString(context, "target")))
                    )
            );

dispatcher.register(Commands.literal("tpdeny")
                    .executes(context -> handleTpDenyCommand(context, null))
                    .then(Commands.argument("target", StringArgumentType.string())
                            .suggests((context, builder) -> SharedSuggestionProvider.suggest(context.getSource().getOnlinePlayerNames(), builder))
                            .executes(context -> handleTpDenyCommand(context, StringArgumentType.getString(context, "target")))
                    )
            );

dispatcher.register(Commands.literal("warp")
                    .executes(context -> handleWarpListCommand(context))
                    .then(Commands.argument("name", StringArgumentType.greedyString())
                            .suggests((context, builder) -> SharedSuggestionProvider.suggest(com.craftcore.teleport.WarpManager.getWarps().stream().map(w -> w.name), builder))
                            .executes(context -> handleWarpTeleportCommand(context, StringArgumentType.getString(context, "name")))
                    )
            );

dispatcher.register(Commands.literal("setwarp")
                    .then(Commands.argument("name", StringArgumentType.greedyString())
                            .executes(context -> handleSetWarpCommand(context, StringArgumentType.getString(context, "name")))
                    )
            );

dispatcher.register(Commands.literal("delwarp")
                    .then(Commands.argument("name", StringArgumentType.greedyString())
                            .suggests((context, builder) -> SharedSuggestionProvider.suggest(com.craftcore.teleport.WarpManager.getWarps().stream().map(w -> w.name), builder))
                            .executes(context -> handleDelWarpCommand(context, StringArgumentType.getString(context, "name")))
                    )
            );

dispatcher.register(Commands.literal("home")
                    .executes(context -> handleHomeListCommand(context))
                    .then(Commands.argument("name", StringArgumentType.string())
                            .suggests((context, builder) -> {
                                ServerPlayer p = context.getSource().getPlayer();
                                if (p == null) return SharedSuggestionProvider.suggest(java.util.Collections.emptyList(), builder);
                                return SharedSuggestionProvider.suggest(com.craftcore.teleport.HomeManager.getPlayerHomes(p.getName().getString()).values().stream().map(h -> h.name), builder);
                            })
                            .executes(context -> handleHomeTeleportCommand(context, StringArgumentType.getString(context, "name")))
                    )
            );

dispatcher.register(Commands.literal("sethome")
                    .then(Commands.argument("name", StringArgumentType.string())
                            .executes(context -> handleSetHomeCommand(context, StringArgumentType.getString(context, "name")))
                    )
            );

dispatcher.register(Commands.literal("delhome")
                    .then(Commands.argument("name", StringArgumentType.string())
                            .suggests((context, builder) -> {
                                ServerPlayer p = context.getSource().getPlayer();
                                if (p == null) return SharedSuggestionProvider.suggest(java.util.Collections.emptyList(), builder);
                                return SharedSuggestionProvider.suggest(com.craftcore.teleport.HomeManager.getPlayerHomes(p.getName().getString()).values().stream().map(h -> h.name), builder);
                            })
                            .executes(context -> handleDelHomeCommand(context, StringArgumentType.getString(context, "name")))
                    )
            );

dispatcher.register(Commands.literal("rtp")
                    .executes(context -> handleRtpCommand(context))
            );

dispatcher.register(Commands.literal("wastebin")
                    .executes(context -> handleWastebinCommand(context))
            );
    }

    private static int handleTpaCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, boolean tpahere) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        String targetName = StringArgumentType.getString(context, "target");
        ServerPlayer target = com.craftcore.event.ServerLifecycleHandler.serverInstance.getPlayerList().getPlayerByName(targetName);

        if (target == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到玩家：" + targetName));
            return 0;
        }

        if (player.getName().getString().equalsIgnoreCase(target.getName().getString())) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您不能對自己發送傳送請求！"));
            return 0;
        }

        com.craftcore.teleport.TeleportRequestManager.sendRequest(player, target, tpahere ? "tpahere" : "tpa");
        return 1;
    }

    private static int handleTpaCancelCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String target) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;
        com.craftcore.teleport.TeleportRequestManager.cancelRequest(player, target);
        return 1;
    }

    private static int handleTpAcceptCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String target) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;
        com.craftcore.teleport.TeleportRequestManager.acceptRequest(player, target);
        return 1;
    }

    private static int handleTpDenyCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String target) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;
        com.craftcore.teleport.TeleportRequestManager.denyRequest(player, target);
        return 1;
    }

    private static int handleWarpListCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        java.util.List<com.craftcore.teleport.WarpManager.Warp> list = com.craftcore.teleport.WarpManager.getWarps();
        if (list.isEmpty()) {
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §7目前沒有設定任何公共地標。"));
            return 1;
        }

        player.sendSystemMessage(Component.literal("§6=================== 公共地標列表 ==================="));
        for (com.craftcore.teleport.WarpManager.Warp w : list) {
            player.sendSystemMessage(Component.literal("§f- §e" + w.name + " §7(" + w.dimension.replace("minecraft:", "") + ": " + (int)w.x + "," + (int)w.y + "," + (int)w.z + ")"));
        }
        player.sendSystemMessage(Component.literal("§6=================================================="));
        return 1;
    }

    private static int handleWarpTeleportCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String name) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        com.craftcore.teleport.WarpManager.Warp w = com.craftcore.teleport.WarpManager.getWarp(name);
        if (w == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到名為「" + name + "」的公共地標！"));
            return 0;
        }

        ServerLevel destLevel = null;
        for (ServerLevel level : com.craftcore.event.ServerLifecycleHandler.serverInstance.getAllLevels()) {
            if (level.dimension().identifier().toString().equalsIgnoreCase(w.dimension)) {
                destLevel = level;
                break;
            }
        }

        if (destLevel == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 地標所在世界未載入！"));
            return 0;
        }

        com.craftcore.teleport.BackManager.recordLocation(player);
        player.teleportTo(destLevel, w.x, w.y, w.z, java.util.Collections.emptySet(), w.yaw, w.pitch, true);
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), net.minecraft.sounds.SoundEvents.ENDERMAN_TELEPORT, net.minecraft.sounds.SoundSource.PLAYERS, 1.0f, 1.0f);
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功傳送至地標：" + w.name));
        return 1;
    }

    private static int handleSetWarpCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String name) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
        if (!isOp) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 只有管理員可以使用此指令！"));
            return 0;
        }

        com.craftcore.teleport.WarpManager.addWarp(
                name,
                player.getX(), player.getY(), player.getZ(),
                player.getYRot(), player.getXRot(),
                player.level().dimension().identifier().toString()
        );
        CraftCoreWSClient client = CraftCoreMod.getWSClient();
        if (client != null && client.isAuthenticated()) {
            client.send(new Packet("warps_changed", null));
        }
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功設定公共地標：" + name));
        return 1;
    }

    private static int handleDelWarpCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String name) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
        if (!isOp) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 只有管理員可以使用此指令！"));
            return 0;
        }

        if (com.craftcore.teleport.WarpManager.removeWarp(name)) {
            CraftCoreWSClient client = CraftCoreMod.getWSClient();
            if (client != null && client.isAuthenticated()) {
                client.send(new Packet("warps_changed", null));
            }
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功刪除公共地標：" + name));
            return 1;
        } else {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到公共地標：" + name));
            return 0;
        }
    }

    private static int handleHomeListCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        String username = player.getName().getString();
        java.util.Map<String, com.craftcore.teleport.HomeManager.Home> homes = com.craftcore.teleport.HomeManager.getPlayerHomes(username);

        if (homes.isEmpty()) {
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §7您目前尚未設定任何家。"));
            return 1;
        }

        player.sendSystemMessage(Component.literal("§6=================== 我的家園列表 (" + homes.size() + "/15) ==================="));
        for (com.craftcore.teleport.HomeManager.Home h : homes.values()) {
            player.sendSystemMessage(Component.literal("§f- §e" + h.name + " §7(" + h.dimension.replace("minecraft:", "") + ": " + (int)h.x + "," + (int)h.y + "," + (int)h.z + ")"));
        }
        player.sendSystemMessage(Component.literal("§6=================================================="));
        return 1;
    }

    private static int handleHomeTeleportCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String name) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        String username = player.getName().getString();
        com.craftcore.teleport.HomeManager.Home h = com.craftcore.teleport.HomeManager.getHome(username, name);

        if (h == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到名為「" + name + "」的家！"));
            return 0;
        }

        ServerLevel destLevel = null;
        for (ServerLevel level : com.craftcore.event.ServerLifecycleHandler.serverInstance.getAllLevels()) {
            if (level.dimension().identifier().toString().equalsIgnoreCase(h.dimension)) {
                destLevel = level;
                break;
            }
        }

        if (destLevel == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 該家所在世界未載入！"));
            return 0;
        }

        com.craftcore.teleport.BackManager.recordLocation(player);
        player.teleportTo(destLevel, h.x, h.y, h.z, java.util.Collections.emptySet(), h.yaw, h.pitch, true);
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), net.minecraft.sounds.SoundEvents.ENDERMAN_TELEPORT, net.minecraft.sounds.SoundSource.PLAYERS, 1.0f, 1.0f);
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功傳送回家：" + h.name));
        return 1;
    }

    private static int handleSetHomeCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String name) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        String username = player.getName().getString();
        String result = com.craftcore.teleport.HomeManager.setHome(
                username, name,
                player.getX(), player.getY(), player.getZ(),
                player.getYRot(), player.getXRot(),
                player.level().dimension().identifier().toString()
        );

        if (result.equals("SUCCESS")) {
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a家園「" + name + "」設定成功！"));
            return 1;
        } else {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] " + result));
            return 0;
        }
    }

    private static int handleDelHomeCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String name) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;

        String username = player.getName().getString();
        if (com.craftcore.teleport.HomeManager.deleteHome(username, name)) {
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a家園「" + name + "」刪除成功！"));
            return 1;
        } else {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到家園：「" + name + "」！"));
            return 0;
        }
    }

    private static int handleRtpCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) {
            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
            return 0;
        }

        String username = player.getName().getString();
        long now = System.currentTimeMillis();
        Long lastRtp = rtpCooldowns.get(username.toLowerCase());
        if (lastRtp != null && now - lastRtp < 60_000) {
            long secLeft = 60 - (now - lastRtp) / 1000;
            player.sendSystemMessage(Component.literal("§c[Craft-Core] RTP 冷卻中，請等待 " + secLeft + " 秒！"));
            return 0;
        }

        ServerLevel world = (ServerLevel) player.level();
        java.util.Random rand = new java.util.Random();
        
        for (int attempts = 0; attempts < 20; attempts++) {
            double rx = player.getX() + (rand.nextDouble() * 6000 - 3000);
            double rz = player.getZ() + (rand.nextDouble() * 6000 - 3000);
            int blockX = (int) rx;
            int blockZ = (int) rz;
            int startY = 120;
            int minY = 10;
            
            if (!world.dimension().identifier().getPath().contains("nether")) {
                startY = 310;
                minY = -60;
            }

            int safeY = -999;
            for (int y = startY; y > minY; y--) {
                net.minecraft.core.BlockPos pos = new net.minecraft.core.BlockPos(blockX, y, blockZ);
                net.minecraft.world.level.block.state.BlockState state = world.getBlockState(pos);
                net.minecraft.world.level.block.state.BlockState stateAbove1 = world.getBlockState(pos.above(1));
                net.minecraft.world.level.block.state.BlockState stateAbove2 = world.getBlockState(pos.above(2));

                if (!state.isAir() && stateAbove1.isAir() && stateAbove2.isAir()) {
                    net.minecraft.world.level.block.Block b = state.getBlock();
                    String key = net.minecraft.core.registries.BuiltInRegistries.BLOCK.getKey(b).toString();
                    if (!key.contains("lava") && !key.contains("water") && !key.contains("air") && !key.contains("fire") && !key.contains("magma")) {
                        safeY = y + 1;
                        break;
                    }
                }
            }

            if (safeY != -999) {
                com.craftcore.teleport.BackManager.recordLocation(player);
                player.teleportTo(world, blockX + 0.5, (double) safeY, blockZ + 0.5, java.util.Collections.emptySet(), player.getYRot(), player.getXRot(), true);
                player.level().playSound(null, player.getX(), player.getY(), player.getZ(), net.minecraft.sounds.SoundEvents.ENDERMAN_TELEPORT, net.minecraft.sounds.SoundSource.PLAYERS, 1.0f, 1.0f);
                player.sendSystemMessage(Component.literal("§b[Craft-Core] §a已隨機傳送至：X:" + blockX + ", Y:" + safeY + ", Z:" + blockZ));
                rtpCooldowns.put(username.toLowerCase(), now);
                return 1;
            }
        }

        player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到安全的傳送位置，請再試一次！"));
        return 0;
    }

    private static int handleWastebinCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) return 0;
        com.craftcore.teleport.WastebinManager.openWastebin(player);
        return 1;
    }

    public static class PortableCraftingMenu extends net.minecraft.world.inventory.CraftingMenu {
        public PortableCraftingMenu(int syncId, net.minecraft.world.entity.player.Inventory playerInventory) {
            super(syncId, playerInventory, net.minecraft.world.inventory.ContainerLevelAccess.create(playerInventory.player.level(), playerInventory.player.blockPosition()));
        }

        @Override
        public boolean stillValid(net.minecraft.world.entity.player.Player player) {
            return true;
        }
    }

    
}
