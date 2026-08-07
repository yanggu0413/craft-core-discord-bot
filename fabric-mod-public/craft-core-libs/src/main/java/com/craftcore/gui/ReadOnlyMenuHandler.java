package com.craftcore.gui;

import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.Container;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.ItemStack;

public abstract class ReadOnlyMenuHandler extends ChestMenu {

    public ReadOnlyMenuHandler(MenuType<ChestMenu> type, int syncId, Inventory playerInventory, Container container, int rows) {
        super(type, syncId, playerInventory, container, rows);
    }

    @Override
    public ItemStack quickMoveStack(Player player, int slot) {
        return ItemStack.EMPTY;
    }

    @Override
    public void clicked(int slotId, int button, ContainerInput clickType, Player player) {
        if (player instanceof ServerPlayer sp) {
            sp.containerMenu.sendAllDataToRemote();
            sp.inventoryMenu.sendAllDataToRemote();
        }
        if (slotId >= 0 && slotId < getContainer().getContainerSize()) {
            handleMenuClick(slotId, button, clickType, player);
            if (player instanceof ServerPlayer sp) {
                sp.containerMenu.sendAllDataToRemote();
                sp.inventoryMenu.sendAllDataToRemote();
            }
            return;
        }
        if (player instanceof ServerPlayer sp) {
            sp.containerMenu.sendAllDataToRemote();
            sp.inventoryMenu.sendAllDataToRemote();
        }
    }

    @Override
    public boolean stillValid(Player player) {
        return true;
    }

    public abstract void handleMenuClick(int slotId, int button, ContainerInput clickType, Player player);
}
