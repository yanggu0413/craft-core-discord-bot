package com.craftcore.gui;

import com.craftcore.util.ItemUtil;
import com.craftcore.util.TextUtil;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.ItemStack;

import java.util.HashMap;
import java.util.Map;
import java.util.function.BiConsumer;

public abstract class BaseChestGui {
    protected final int rows;
    protected final int size;
    protected final String titleTemplate;
    protected final SimpleContainer container;
    protected final Map<Integer, BiConsumer<ServerPlayer, ContainerInput>> slotClickHandlers = new HashMap<>();

    public BaseChestGui(int rows, String titleTemplate) {
        this.rows = Math.max(1, Math.min(6, rows));
        this.size = this.rows * 9;
        this.titleTemplate = titleTemplate != null ? titleTemplate : "";
        this.container = new SimpleContainer(this.size);
    }

    public int getRows() {
        return rows;
    }

    public int getSize() {
        return size;
    }

    public SimpleContainer getContainer() {
        return container;
    }

    public void setItem(int slot, ItemStack stack, BiConsumer<ServerPlayer, ContainerInput> onClick) {
        if (slot >= 0 && slot < size) {
            container.setItem(slot, stack != null ? stack : ItemStack.EMPTY);
            if (onClick != null) {
                slotClickHandlers.put(slot, onClick);
            } else {
                slotClickHandlers.remove(slot);
            }
        }
    }

    public void setButton(int slot, ItemStack stack, Runnable onClick) {
        setItem(slot, stack, (player, clickType) -> {
            if (onClick != null) {
                onClick.run();
            }
        });
    }

    public void fillBackground(ItemStack borderStack) {
        ItemStack border = (borderStack != null && !borderStack.isEmpty())
                ? borderStack
                : ItemUtil.createGuiItem(ItemUtil.getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < size; i++) {
            container.setItem(i, border.copy());
        }
    }

    public void fillBorder() {
        ItemStack border = ItemUtil.createGuiItem(ItemUtil.getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < size; i++) {
            int row = i / 9;
            int col = i % 9;
            if (row == 0 || row == rows - 1 || col == 0 || col == 8) {
                container.setItem(i, border.copy());
            }
        }
    }

    protected abstract void build(ServerPlayer player);

    @SuppressWarnings("unchecked")
    public void open(ServerPlayer player) {
        if (player == null) return;
        slotClickHandlers.clear();
        build(player);

        Component title = TextUtil.parse(titleTemplate);
        MenuType<ChestMenu> menuType = (MenuType<ChestMenu>) getMenuTypeForRows(rows);

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
                new ReadOnlyMenuHandler(menuType, syncId, inv, container, rows) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            BiConsumer<ServerPlayer, ContainerInput> handler = slotClickHandlers.get(slotId);
                            if (handler != null) {
                                handler.accept(sp, clickType);
                            }
                        }
                    }
                }, title));
    }

    protected MenuType<?> getMenuTypeForRows(int rows) {
        return switch (rows) {
            case 1 -> MenuType.GENERIC_9x1;
            case 2 -> MenuType.GENERIC_9x2;
            case 3 -> MenuType.GENERIC_9x3;
            case 4 -> MenuType.GENERIC_9x4;
            case 5 -> MenuType.GENERIC_9x5;
            default -> MenuType.GENERIC_9x6;
        };
    }
}
