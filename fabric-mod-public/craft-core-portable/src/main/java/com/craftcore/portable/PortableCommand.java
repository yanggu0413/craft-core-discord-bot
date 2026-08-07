package com.craftcore.portable;

import com.craftcore.gui.PortableCraftingMenu;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.inventory.ChestMenu;

public class PortableCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        // /workbench, /wb
        dispatcher.register(Commands.literal("workbench")
                .executes(context -> openWorkbench(context.getSource()))
        );
        dispatcher.register(Commands.literal("wb")
                .executes(context -> openWorkbench(context.getSource()))
        );

        // /enderchest, /ec
        dispatcher.register(Commands.literal("enderchest")
                .executes(context -> openEnderChest(context.getSource()))
        );
        dispatcher.register(Commands.literal("ec")
                .executes(context -> openEnderChest(context.getSource()))
        );

        // /wastebin, /trashbin, /trash
        dispatcher.register(Commands.literal("wastebin")
                .executes(context -> openWastebin(context.getSource()))
        );
        dispatcher.register(Commands.literal("trashbin")
                .executes(context -> openWastebin(context.getSource()))
        );
        dispatcher.register(Commands.literal("trash")
                .executes(context -> openWastebin(context.getSource()))
        );
    }

    private static int openWorkbench(CommandSourceStack source) {
        ServerPlayer player = source.getPlayer();
        if (player == null) {
            source.sendSystemMessage(Component.literal("此指令只能由遊戲內玩家使用。"));
            return 0;
        }

        player.openMenu(new SimpleMenuProvider(
                (syncId, playerInventory, menuPlayer) ->
                        new PortableCraftingMenu(syncId, playerInventory),
                Component.literal("隨身工作台")
        ));
        return 1;
    }

    private static int openEnderChest(CommandSourceStack source) {
        ServerPlayer player = source.getPlayer();
        if (player == null) {
            source.sendSystemMessage(Component.literal("此指令只能由遊戲內玩家使用。"));
            return 0;
        }

        player.openMenu(new SimpleMenuProvider(
                (syncId, playerInventory, menuPlayer) ->
                        ChestMenu.threeRows(syncId, playerInventory, player.getEnderChestInventory()),
                Component.literal("隨身終界箱")
        ));
        return 1;
    }

    private static int openWastebin(CommandSourceStack source) {
        ServerPlayer player = source.getPlayer();
        if (player == null) {
            source.sendSystemMessage(Component.literal("此指令只能由遊戲內玩家使用。"));
            return 0;
        }

        WastebinManager.openWastebin(player);
        return 1;
    }
}
