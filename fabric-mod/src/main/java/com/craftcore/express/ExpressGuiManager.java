package com.craftcore.express;

import com.craftcore.menu.MenuGuiManager;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.Container;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemLore;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

public class ExpressGuiManager {

    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd HH:mm");

    private static Item getItem(String id) {
        return BuiltInRegistries.ITEM.getValue(Identifier.parse(id));
    }

    private static ItemStack createGuiItem(Item item, String displayName, List<String> loreLines) {
        ItemStack stack = new ItemStack(item != null ? item : Items.PAPER);
        stack.set(DataComponents.CUSTOM_NAME, Component.literal(displayName));
        if (loreLines != null && !loreLines.isEmpty()) {
            List<Component> components = new ArrayList<>();
            for (String line : loreLines) {
                components.add(Component.literal(line));
            }
            stack.set(DataComponents.LORE, new ItemLore(components));
        }
        return stack;
    }

    private static ItemStack createPlayerHead(String username) {
        ItemStack headStack = new ItemStack(Items.PLAYER_HEAD);
        if (username != null && !username.isEmpty()) {
            try {
                headStack.set(DataComponents.PROFILE, net.minecraft.world.item.component.ResolvableProfile.createUnresolved(username));
            } catch (Throwable ignored) {}
        }
        return headStack;
    }

    private static void fillBackground(SimpleContainer container) {
        ItemStack border = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < container.getContainerSize(); i++) {
            container.setItem(i, border.copy());
        }
    }

    // =========================================================
    // 1. 快遞主選單 (Express Main Hub GUI 9x6)
    // =========================================================
    public static void openExpressMainMenu(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();
        List<ExpressManager.ExpressParcel> inbox = ExpressManager.getInboxParcels(username);

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        // Slot 20: ✉️ 寄送包裹
        container.setItem(20, createGuiItem(Items.WRITABLE_BOOK, "§a✉️ 寄送包裹", List.of(
                "§7將背包物資放入虛擬箱子中，",
                "§7即可線上/離線跨服寄送給指定玩家！",
                "",
                "§e[點擊開啟寄送介面]"
        )));

        // Slot 22: 📦 離線收件箱
        container.setItem(22, createGuiItem(Items.CHEST, "§b📦 離線收件箱", List.of(
                "§7查看與領取其他玩家寄給您的包裹",
                "§7目前未領取包裹: §e" + inbox.size() + " 個",
                "",
                "§e[點擊開啟收件箱]"
        )));

        // Slot 24: 📜 寄件紀錄
        container.setItem(24, createGuiItem(Items.PAPER, "§e📜 寄件紀錄", List.of(
                "§7查看您已寄出的包裹清單與對方的簽收狀態",
                "",
                "§e[點擊開啟寄件紀錄]"
        )));

        // Slot 45: ⬅️ 返回主選單
        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅️ 返回主選單", List.of("§7點擊返回 /menu 大廳")));

        // Slot 49: ❌ 關閉選單
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new MenuGuiManager.ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 20) openSendParcelContainer(sp, null);
                            else if (slotId == 22) openInboxGui(sp);
                            else if (slotId == 24) openHistoryGui(sp);
                            else if (slotId == 45) MenuGuiManager.openMainMenu(sp);
                            else if (slotId == 49) sp.closeContainer();
                        }
                    }
                }, Component.literal("§1📦 虛擬快遞箱中心 (/express)")));
    }

    // =========================================================
    // 2. 寄送包裹容器 GUI (Send Parcel Slot Container 9x6)
    // =========================================================
    public static class ParcelSendScreenHandler extends ChestMenu {
        private final ServerPlayer sender;
        private final String presetRecipient;
        private final Container parcelContainer;
        private boolean isCompleted = false;

        public ParcelSendScreenHandler(int syncId, Inventory playerInventory, ServerPlayer sender, String presetRecipient) {
            super(MenuType.GENERIC_9x6, syncId, playerInventory, new SimpleContainer(54), 6);
            this.sender = sender;
            this.presetRecipient = presetRecipient;
            this.parcelContainer = this.getContainer();

            // Render separator and control buttons
            ItemStack glass = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
            for (int i = 36; i < 45; i++) {
                parcelContainer.setItem(i, glass.copy());
            }

            parcelContainer.setItem(45, createGuiItem(Items.ARROW, "§a⬅️ 返回快遞主頁", List.of("§7點擊返回 /express 主頁")));

            String btnTitle = presetRecipient != null ? "§a✉️ 寄送給 §e" + presetRecipient : "§a✉️ 選擇收件人並寄出";
            List<String> btnLore = List.of(
                    "§7將要寄送的物品放置於上方 0-35 號格子",
                    presetRecipient != null ? "§7指定收件人: §e" + presetRecipient : "§7點擊後將在聊天欄輸入/指定收件人",
                    "",
                    "§e[點擊確認寄出包裹]"
            );
            parcelContainer.setItem(49, createGuiItem(Items.WRITABLE_BOOK, btnTitle, btnLore));

            parcelContainer.setItem(53, createGuiItem(Items.BARRIER, "§c❌ 取消寄送", List.of("§7點擊取消並取回物品")));
        }

        @Override
        public ItemStack quickMoveStack(Player player, int slot) {
            if (slot >= 36 && slot <= 53) {
                return ItemStack.EMPTY;
            }
            return super.quickMoveStack(player, slot);
        }

        @Override
        public void clicked(int slotId, int button, ContainerInput clickType, Player player) {
            if (player instanceof ServerPlayer sp) {
                sp.containerMenu.sendAllDataToRemote();
                sp.inventoryMenu.sendAllDataToRemote();
            }

            if (slotId == 45) {
                if (player instanceof ServerPlayer sp) {
                    openExpressMainMenu(sp);
                }
                return;
            }

            if (slotId == 53) {
                if (player instanceof ServerPlayer sp) {
                    sp.closeContainer();
                }
                return;
            }

            if (slotId == 49) {
                if (player instanceof ServerPlayer sp) {
                    List<ItemStack> itemsToSend = new ArrayList<>();
                    for (int i = 0; i < 36; i++) {
                        ItemStack stack = parcelContainer.getItem(i);
                        if (!stack.isEmpty()) {
                            itemsToSend.add(stack.copy());
                        }
                    }

                    if (itemsToSend.isEmpty()) {
                        sp.sendSystemMessage(Component.literal("§c[Craft-Core] 寄件箱中沒有任何物品！請將欲寄出的物資放入 0-35 號槽位中。"));
                        sp.playSound(SoundEvents.VILLAGER_NO, 1.0f, 1.0f);
                        return;
                    }

                    this.isCompleted = true;

                    // Clear container so removed() won't drop them back
                    for (int i = 0; i < 36; i++) {
                        parcelContainer.setItem(i, ItemStack.EMPTY);
                    }

                    sp.closeContainer();

                    if (presetRecipient != null && !presetRecipient.isBlank()) {
                        ExpressManager.sendParcel(sp.getName().getString(), presetRecipient, itemsToSend, sp.level().registryAccess());
                        sp.sendSystemMessage(Component.literal("§b[Craft-Core] §a★ 包裹成功寄出！★"));
                        sp.sendSystemMessage(Component.literal("§f- 收件人: §e" + presetRecipient));
                        sp.sendSystemMessage(Component.literal("§f- 物品數量: §a" + itemsToSend.size() + " §f種"));
                        sp.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
                    } else {
                        ExpressManager.addPendingSend(sp.getName().getString(), null, itemsToSend);
                        sp.sendSystemMessage(Component.literal("§b[Craft-Core] §a請在 60 秒內於聊天欄輸入接收包裹的玩家名稱（線上或離線名稱），或輸入「取消」："));
                        sp.playSound(SoundEvents.NOTE_BLOCK_PLING.value(), 1.0f, 1.0f);
                    }
                }
                return;
            }

            if (slotId >= 36 && slotId <= 53) {
                return; // Block interacting with control bar
            }

            super.clicked(slotId, button, clickType, player);
            if (player instanceof ServerPlayer sp) {
                sp.containerMenu.sendAllDataToRemote();
                sp.inventoryMenu.sendAllDataToRemote();
            }
        }

        @Override
        public void removed(Player player) {
            super.removed(player);
            if (!isCompleted && player instanceof ServerPlayer sp) {
                for (int i = 0; i < 36; i++) {
                    ItemStack stack = parcelContainer.getItem(i);
                    if (!stack.isEmpty()) {
                        sp.getInventory().placeItemBackInInventory(stack);
                    }
                }
            }
        }

        @Override
        public boolean stillValid(Player player) {
            return true;
        }
    }

    public static void openSendParcelContainer(ServerPlayer sender, String presetRecipient) {
        if (sender == null) return;
        sender.openMenu(new SimpleMenuProvider(
                (syncId, inv, p) -> new ParcelSendScreenHandler(syncId, inv, sender, presetRecipient),
                Component.literal(presetRecipient != null ? "✉️ 寄送包裹給: " + presetRecipient : "✉️ 放置寄送物品 (0-35槽)")
        ));
    }

    // =========================================================
    // 3. 離線收件箱 GUI (Inbox GUI 9x6)
    // =========================================================
    public static void openInboxGui(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();
        List<ExpressManager.ExpressParcel> parcels = ExpressManager.getInboxParcels(username);

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅️ 返回快遞主頁", List.of("§7點擊返回 /express 主頁")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        int[] innerSlots = {
                10, 11, 12, 13, 14, 15, 16,
                19, 20, 21, 22, 23, 24, 25,
                28, 29, 30, 31, 32, 33, 34
        };

        if (parcels.isEmpty()) {
            container.setItem(22, createGuiItem(Items.CHEST, "§7目前收件箱無包裹", List.of("§7當有玩家寄送包裹給您時，將會顯示於此處。")));
        } else {
            for (int i = 0; i < parcels.size() && i < innerSlots.length; i++) {
                ExpressManager.ExpressParcel parcel = parcels.get(i);
                ItemStack head = createPlayerHead(parcel.sender);
                head.set(DataComponents.CUSTOM_NAME, Component.literal("§a📦 包裹: 來自 " + parcel.sender));

                List<Component> lore = new ArrayList<>();
                lore.add(Component.literal("§7寄件人: §f" + parcel.sender));
                lore.add(Component.literal("§7寄送時間: §7" + DATE_FORMAT.format(new Date(parcel.sentAt))));
                lore.add(Component.literal("§7包含物資: §e" + parcel.itemsNbt.size() + " 種物品"));
                lore.add(Component.literal(""));
                lore.add(Component.literal("§a[點擊全數領取至背包]"));
                head.set(DataComponents.LORE, new ItemLore(lore));

                container.setItem(innerSlots[i], head);
            }
        }

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new MenuGuiManager.ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) { openExpressMainMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }

                            for (int i = 0; i < innerSlots.length; i++) {
                                if (slotId == innerSlots[i] && i < parcels.size()) {
                                    ExpressManager.ExpressParcel parcel = parcels.get(i);
                                    if (ExpressManager.claimParcel(parcel.id, sp)) {
                                        sp.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功領取來自 §e" + parcel.sender + " §a的包裹！"));
                                        sp.playSound(SoundEvents.ITEM_PICKUP, 1.0f, 1.0f);
                                        openInboxGui(sp);
                                    } else {
                                        sp.sendSystemMessage(Component.literal("§c[Craft-Core] 領取包裹失敗或該包裹已被領取。"));
                                    }
                                    return;
                                }
                            }
                        }
                    }
                }, Component.literal("§1📦 離線收件箱 (" + parcels.size() + " 個待領)")));
    }

    // =========================================================
    // 4. 寄件紀錄 GUI (Sent History GUI 9x6)
    // =========================================================
    public static void openHistoryGui(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();
        List<ExpressManager.ExpressParcel> history = ExpressManager.getSentParcels(username);

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅️ 返回快遞主頁", List.of("§7點擊返回 /express 主頁")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        int[] innerSlots = {
                10, 11, 12, 13, 14, 15, 16,
                19, 20, 21, 22, 23, 24, 25,
                28, 29, 30, 31, 32, 33, 34
        };

        if (history.isEmpty()) {
            container.setItem(22, createGuiItem(Items.PAPER, "§7無寄件紀錄", List.of("§7您尚未寄出任何包裹。")));
        } else {
            for (int i = 0; i < history.size() && i < innerSlots.length; i++) {
                ExpressManager.ExpressParcel parcel = history.get(i);
                ItemStack head = createPlayerHead(parcel.recipient);
                head.set(DataComponents.CUSTOM_NAME, Component.literal("§e📜 寄出包裹 -> " + parcel.recipient));

                List<Component> lore = new ArrayList<>();
                lore.add(Component.literal("§7收件人: §f" + parcel.recipient));
                lore.add(Component.literal("§7寄送時間: §7" + DATE_FORMAT.format(new Date(parcel.sentAt))));
                lore.add(Component.literal("§7物品種類: §e" + parcel.itemsNbt.size() + " 種"));
                if (parcel.claimed) {
                    lore.add(Component.literal("§7簽收狀態: §a[已簽收 " + DATE_FORMAT.format(new Date(parcel.claimedAt)) + "]"));
                } else {
                    lore.add(Component.literal("§7簽收狀態: §e[等待對方領取]"));
                }
                head.set(DataComponents.LORE, new ItemLore(lore));

                container.setItem(innerSlots[i], head);
            }
        }

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new MenuGuiManager.ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) { openExpressMainMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }
                        }
                    }
                }, Component.literal("§1📜 寄件歷史紀錄")));
    }
}
