package com.craftcore.gui;

import com.craftcore.util.ItemUtil;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

import java.util.Collections;
import java.util.List;

public abstract class PaginatedChestGui<T> extends BaseChestGui {
    protected int currentPage = 0;
    protected final List<T> items;

    public PaginatedChestGui(int rows, String titleTemplate, List<T> items) {
        super(rows, titleTemplate);
        this.items = items != null ? items : Collections.emptyList();
    }

    public int getCurrentPage() {
        return currentPage;
    }

    public void setCurrentPage(int page) {
        this.currentPage = page;
    }

    protected int[] getGridSlots() {
        if (rows >= 6) {
            return new int[]{
                    10, 11, 12, 13, 14, 15, 16,
                    19, 20, 21, 22, 23, 24, 25,
                    28, 29, 30, 31, 32, 33, 34,
                    37, 38, 39, 40, 41, 42, 43
            };
        } else if (rows >= 4) {
            return new int[]{
                    10, 11, 12, 13, 14, 15, 16,
                    19, 20, 21, 22, 23, 24, 25
            };
        } else {
            return new int[]{1, 2, 3, 4, 5, 6, 7};
        }
    }

    @Override
    protected void build(ServerPlayer player) {
        fillBackground(null);
        int[] gridSlots = getGridSlots();
        int itemsPerPage = gridSlots.length;
        int maxPages = Math.max(1, (int) Math.ceil((double) items.size() / itemsPerPage));

        currentPage = Math.max(0, Math.min(currentPage, maxPages - 1));
        int startIndex = currentPage * itemsPerPage;
        int endIndex = Math.min(startIndex + itemsPerPage, items.size());

        for (int i = 0; i < itemsPerPage; i++) {
            int slot = gridSlots[i];
            int itemIndex = startIndex + i;
            if (itemIndex < endIndex) {
                T data = items.get(itemIndex);
                renderItem(slot, data, player);
            } else {
                container.setItem(slot, ItemStack.EMPTY);
                slotClickHandlers.remove(slot);
            }
        }

        int navRowStart = (rows - 1) * 9;
        int prevSlot = navRowStart;
        int infoSlot = navRowStart + 4;
        int nextSlot = navRowStart + 8;

        if (currentPage > 0) {
            setButton(prevSlot, ItemUtil.createGuiItem(Items.ARROW, "§a⬅ 上一頁 (頁碼 " + currentPage + "/" + maxPages + ")", null), () -> {
                currentPage--;
                open(player);
            });
        }

        setButton(infoSlot, ItemUtil.createGuiItem(Items.PAPER, "§e頁碼: " + (currentPage + 1) + " / " + maxPages, List.of("§7共 " + items.size() + " 項紀錄")), null);

        if (currentPage < maxPages - 1) {
            setButton(nextSlot, ItemUtil.createGuiItem(Items.ARROW, "§a下一頁 ➡ (頁碼 " + (currentPage + 2) + "/" + maxPages + ")", null), () -> {
                currentPage++;
                open(player);
            });
        }
    }

    protected abstract void renderItem(int slot, T itemData, ServerPlayer player);
}
