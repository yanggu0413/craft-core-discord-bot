package com.craftcore.economy;

import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemLore;

import java.util.List;
import java.util.Map;

public class EcoTopScreenHandler extends ChestMenu {
    public EcoTopScreenHandler(int syncId, Inventory playerInventory) {
        super(MenuType.GENERIC_9x2, syncId, playerInventory, new SimpleContainer(18), 2);
        List<Map.Entry<String, EconomyManager.PlayerData>> top = EconomyManager.getTopWealthPlayers(10);
        for (int i = 0; i < top.size(); i++) {
            Map.Entry<String, EconomyManager.PlayerData> entry = top.get(i);
            Item itemObj;
            String rankColor;
            if (i == 0) {
                itemObj = Items.DIAMOND;
                rankColor = "§b[第一名] §f";
            } else if (i == 1) {
                itemObj = Items.EMERALD;
                rankColor = "§a[第二名] §f";
            } else if (i == 2) {
                itemObj = Items.GOLD_INGOT;
                rankColor = "§e[第三名] §f";
            } else {
                itemObj = Items.IRON_INGOT;
                rankColor = "§7[第" + (i + 1) + "名] §f";
            }
            
            ItemStack stack = new ItemStack(itemObj);
            stack.set(DataComponents.CUSTOM_NAME, Component.literal(rankColor + entry.getKey()));
            List<Component> lore = List.of(
                Component.literal("§7資產餘額: §a$" + entry.getValue().balance)
            );
            stack.set(DataComponents.LORE, new ItemLore(lore));
            this.getContainer().setItem(i, stack);
        }
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
    }

    @Override
    public boolean stillValid(Player player) {
        return true;
    }
}
