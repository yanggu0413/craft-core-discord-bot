package com.craftcore.gui;

import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.ContainerLevelAccess;
import net.minecraft.world.inventory.CraftingMenu;

public class PortableCraftingMenu extends CraftingMenu {
    public PortableCraftingMenu(int syncId, Inventory playerInventory) {
        super(syncId, playerInventory, ContainerLevelAccess.create(playerInventory.player.level(), playerInventory.player.blockPosition()));
    }

    @Override
    public boolean stillValid(Player player) {
        return true;
    }
}
