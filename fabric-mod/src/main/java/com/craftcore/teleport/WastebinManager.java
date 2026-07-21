package com.craftcore.teleport;

import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.MenuType;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public class WastebinManager {
    private static final Map<String, SimpleContainer> playerBins = new ConcurrentHashMap<>();
    private static final Map<String, ScheduledFuture<?>> destroyTimers = new ConcurrentHashMap<>();
    private static final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public static class WastebinScreenHandler extends ChestMenu {
        private final String username;

        public WastebinScreenHandler(int syncId, Inventory playerInventory, SimpleContainer container, String username) {
            super(MenuType.GENERIC_9x3, syncId, playerInventory, container, 3);
            this.username = username;
        }

        @Override
        public void removed(Player playerEntity) {
            super.removed(playerEntity);
            if (playerEntity instanceof ServerPlayer spe) {
                WastebinManager.onContainerClosed(username, spe);
            }
        }

        @Override
        public boolean stillValid(Player player) {
            return true;
        }
    }

    public static void openWastebin(ServerPlayer player) {
        String username = player.getName().getString().toLowerCase();

        // Cancel any pending destroy timer if re-opened
        ScheduledFuture<?> timer = destroyTimers.remove(username);
        if (timer != null && !timer.isDone()) {
            timer.cancel(false);
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a已重置垃圾桶倒數計時器。"));
        }

        SimpleContainer container = playerBins.computeIfAbsent(username, k -> new SimpleContainer(27));

        player.openMenu(new SimpleMenuProvider(
                (syncId, playerInv, playerEntity) -> new WastebinScreenHandler(syncId, playerInv, container, username),
                Component.literal("🗑️ 垃圾桶 (關閉10秒後銷毀)")
        ));
    }

    private static synchronized void onContainerClosed(String username, ServerPlayer player) {
        SimpleContainer container = playerBins.get(username);
        if (container == null || container.isEmpty()) return;

        player.sendSystemMessage(Component.literal("§b[Craft-Core] §e垃圾桶已關閉，將於 10 秒後徹底銷毀暫存物品！(再次打開可取消銷毀)"));

        ScheduledFuture<?> future = scheduler.schedule(() -> {
            synchronized (WastebinManager.class) {
                container.clearContent();
                destroyTimers.remove(username);
                if (com.craftcore.event.ServerLifecycleHandler.serverInstance != null) {
                    com.craftcore.event.ServerLifecycleHandler.serverInstance.execute(() -> {
                        ServerPlayer onlinePlayer = com.craftcore.event.ServerLifecycleHandler.serverInstance.getPlayerList().getPlayerByName(player.getName().getString());
                        if (onlinePlayer != null) {
                            onlinePlayer.sendSystemMessage(Component.literal("§b[Craft-Core] §7[垃圾桶] 暫存物品已徹底銷毀。"));
                        }
                    });
                }
            }
        }, 10, TimeUnit.SECONDS);

        destroyTimers.put(username, future);
    }
}
