package com.craftcore.check;

import com.craftcore.economy.EconomyManager;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
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
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.component.ItemLore;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public class CheckManager {

    public record CheckData(String id, double amount, String issuer, long timestamp) {}

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private static Item getPaperItem() {
        Item item = BuiltInRegistries.ITEM.getValue(Identifier.parse("minecraft:paper"));
        return item != null ? item : Items.PAPER;
    }

    public static ItemStack createCheckItem(String issuer, double amount) {
        double cleanAmount = EconomyManager.round2(amount);
        Item paper = getPaperItem();
        ItemStack stack = new ItemStack(paper != null ? paper : Items.PAPER);

        // 1. Custom Name & Glint
        stack.set(DataComponents.CUSTOM_NAME, Component.literal("§e📜 銀行支票 ($" + String.format("%.2f", cleanAmount) + " 元)"));
        stack.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);

        // 2. Generate Check Data
        String checkId = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        long now = System.currentTimeMillis();
        String dateStr = LocalDateTime.now().format(DATE_FORMATTER);

        // 3. Set Lore
        List<Component> lore = new ArrayList<>();
        lore.add(Component.literal("§7面額金額: §a$" + String.format("%.2f", cleanAmount) + " 元"));
        lore.add(Component.literal("§7開票人員: §b" + (issuer != null ? issuer : "系統官方")));
        lore.add(Component.literal("§7開票時間: §f" + dateStr));
        lore.add(Component.literal("§7防偽流水號: §8#CHK-" + checkId));
        lore.add(Component.literal(""));
        lore.add(Component.literal("§e[手持按【右鍵】開啟兌現確認選單]"));
        stack.set(DataComponents.LORE, new ItemLore(lore));

        // 4. Custom NBT Data
        CompoundTag checkTag = new CompoundTag();
        checkTag.putString("id", checkId);
        checkTag.putDouble("amount", cleanAmount);
        checkTag.putString("issuer", issuer != null ? issuer : "System");
        checkTag.putLong("timestamp", now);

        CompoundTag rootTag = new CompoundTag();
        rootTag.put("craftcore_check", checkTag);

        stack.set(DataComponents.CUSTOM_DATA, CustomData.of(rootTag));

        return stack;
    }

    public static boolean isCheckItem(ItemStack stack) {
        if (stack == null || stack.isEmpty()) {
            return false;
        }
        CustomData customData = stack.get(DataComponents.CUSTOM_DATA);
        if (customData == null) return false;

        CompoundTag tag = customData.copyTag();
        if (!tag.contains("craftcore_check")) return false;

        Optional<CompoundTag> checkTagOpt = tag.getCompound("craftcore_check");
        if (checkTagOpt.isEmpty()) return false;

        CompoundTag checkTag = checkTagOpt.get();
        return checkTag.contains("amount") && checkTag.getDouble("amount").orElse(0.0) > 0;
    }

    public static CheckData getCheckData(ItemStack stack) {
        if (!isCheckItem(stack)) return null;
        CustomData customData = stack.get(DataComponents.CUSTOM_DATA);
        CompoundTag tag = customData.copyTag();
        Optional<CompoundTag> checkTagOpt = tag.getCompound("craftcore_check");
        if (checkTagOpt.isEmpty()) return null;

        CompoundTag checkTag = checkTagOpt.get();
        String id = checkTag.getString("id").orElse("");
        double amount = checkTag.getDouble("amount").orElse(0.0);
        String issuer = checkTag.getString("issuer").orElse("Unknown");
        long timestamp = checkTag.getLong("timestamp").orElse(0L);

        return new CheckData(id, amount, issuer, timestamp);
    }

    public static void openCheckMenu(ServerPlayer player) {
        player.openMenu(new SimpleMenuProvider(
            (syncId, playerInv, playerEntity) -> new CheckCenterScreenHandler(syncId, playerInv, player),
            Component.literal("📜 銀行支票發行中心")
        ));
    }

    public static void openRedeemConfirmMenu(ServerPlayer player, ItemStack checkStack) {
        CheckData data = getCheckData(checkStack);
        if (data == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 無法讀取該支票的防偽數據！"));
            return;
        }

        player.openMenu(new SimpleMenuProvider(
            (syncId, playerInv, playerEntity) -> new RedeemConfirmScreenHandler(syncId, playerInv, player, checkStack, data),
            Component.literal("📜 支票兌現確認")
        ));
    }

    // Standard 9x3 Check Center GUI
    public static class CheckCenterScreenHandler extends ChestMenu {
        private final ServerPlayer player;

        public CheckCenterScreenHandler(int syncId, Inventory playerInventory, ServerPlayer player) {
            super(MenuType.GENERIC_9x3, syncId, playerInventory, new SimpleContainer(27), 3);
            this.player = player;

            String username = player.getName().getString();
            double balance = EconomyManager.getBalance(username);

            ItemStack glass = new ItemStack(BuiltInRegistries_getItem("minecraft:gray_stained_glass_pane"));
            glass.set(DataComponents.CUSTOM_NAME, Component.literal(" "));
            for (int i = 0; i < 27; i++) {
                this.getContainer().setItem(i, glass.copy());
            }

            // Preset Amounts across Row 2 (Slots 10 to 16)
            this.getContainer().setItem(10, createPresetBtn(100.0, balance));
            this.getContainer().setItem(11, createPresetBtn(500.0, balance));
            this.getContainer().setItem(12, createPresetBtn(1000.0, balance));
            this.getContainer().setItem(13, createPresetBtn(5000.0, balance));
            this.getContainer().setItem(14, createPresetBtn(10000.0, balance));
            this.getContainer().setItem(15, createPresetBtn(50000.0, balance));
            this.getContainer().setItem(16, createPresetBtn(100000.0, balance));

            // Row 1 Info & Custom (Slots 4, 8)
            ItemStack infoBook = new ItemStack(Items.BOOK);
            infoBook.set(DataComponents.CUSTOM_NAME, Component.literal("§e📖 支票系統說明"));
            infoBook.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal("§7- 支票為可放於背包/箱子的真實實體物品。"),
                Component.literal("§7- 開立支票將從您的戶頭餘額中扣除相應金額。"),
                Component.literal("§7- 支票具備防偽標籤，可交易或傳輸。"),
                Component.literal("§7- 手持支票按【右鍵】即可開卡兌現。")
            )));
            this.getContainer().setItem(4, infoBook);

            ItemStack customWriteBtn = new ItemStack(Items.WRITABLE_BOOK);
            customWriteBtn.set(DataComponents.CUSTOM_NAME, Component.literal("§d✍️ 自訂金額開票"));
            customWriteBtn.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal("§7使用指令自訂開票金額："),
                Component.literal("§e/check <金額>"),
                Component.literal("§7例如：/check 2500")
            )));
            this.getContainer().setItem(8, customWriteBtn);

            // Row 3 Controls (Slots 22, 26)
            ItemStack backBtn = new ItemStack(Items.ARROW);
            backBtn.set(DataComponents.CUSTOM_NAME, Component.literal("§a⬅ 返回主選單"));
            backBtn.set(DataComponents.LORE, new ItemLore(List.of(Component.literal("§7返回 /menu 大廳"))));
            this.getContainer().setItem(22, backBtn);

            ItemStack closeBtn = new ItemStack(Items.BARRIER);
            closeBtn.set(DataComponents.CUSTOM_NAME, Component.literal("§c❌ 關閉選單"));
            this.getContainer().setItem(26, closeBtn);
        }

        private ItemStack createPresetBtn(double amount, double currentBalance) {
            boolean canAfford = currentBalance >= amount;
            ItemStack item = new ItemStack(canAfford ? getPaperItem() : Items.REDSTONE);
            item.set(DataComponents.CUSTOM_NAME, Component.literal((canAfford ? "§a📜 開立 $" : "§c📜 開立 $") + String.format("%.0f", amount) + " 支票"));
            item.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal("§7扣除餘額: §a$" + String.format("%.0f", amount) + " 元"),
                canAfford ? Component.literal("§e[點擊開啟此面額支票]") : Component.literal("§c[餘額不足，無法開立]")
            )));
            if (canAfford) {
                item.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
            }
            return item;
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

                if (slotId == 22) {
                    com.craftcore.menu.MenuGuiManager.openMainMenu(sp);
                    return;
                }
                if (slotId == 26) {
                    sp.closeContainer();
                    return;
                }
                if (slotId == 8) {
                    sp.closeContainer();
                    sp.sendSystemMessage(Component.literal("§b[Craft-Core] §f請使用指令 §e/check <金額> §f進行自訂金額開票！"));
                    return;
                }

                double presetAmount = 0;
                if (slotId == 10) presetAmount = 100.0;
                else if (slotId == 11) presetAmount = 500.0;
                else if (slotId == 12) presetAmount = 1000.0;
                else if (slotId == 13) presetAmount = 5000.0;
                else if (slotId == 14) presetAmount = 10000.0;
                else if (slotId == 15) presetAmount = 50000.0;
                else if (slotId == 16) presetAmount = 100000.0;

                if (presetAmount > 0) {
                    sp.closeContainer();
                    String username = player.getName().getString();
                    double balance = EconomyManager.getBalance(username);
                    if (balance < presetAmount) {
                        sp.sendSystemMessage(Component.literal("§c[Craft-Core] 餘額不足！無法開立 $" + String.format("%.0f", presetAmount) + " 支票。"));
                        sp.playSound(SoundEvents.VILLAGER_NO, 1.0f, 1.0f);
                        return;
                    }

                    if (EconomyManager.removeMoney(username, presetAmount)) {
                        ItemStack checkItem = createCheckItem(username, presetAmount);
                        sp.getInventory().placeItemBackInInventory(checkItem);
                        sp.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功開立 $" + String.format("%.0f", presetAmount) + " 元整之銀行支票！已加入您的背包。"));
                        sp.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
                    } else {
                        sp.sendSystemMessage(Component.literal("§c[Craft-Core] 扣款失敗，請稍後再試。"));
                    }
                    return;
                }
            }
            super.clicked(slotId, button, clickType, player);
        }

        @Override
        public boolean stillValid(Player player) {
            return true;
        }
    }

    // Confirmation GUI for Right-click Check Redemption
    public static class RedeemConfirmScreenHandler extends ChestMenu {
        private final ServerPlayer player;
        private final ItemStack checkStack;
        private final CheckData data;

        public RedeemConfirmScreenHandler(int syncId, Inventory playerInventory, ServerPlayer player, ItemStack checkStack, CheckData data) {
            super(MenuType.GENERIC_9x3, syncId, playerInventory, new SimpleContainer(27), 3);
            this.player = player;
            this.checkStack = checkStack;
            this.data = data;

            ItemStack glass = new ItemStack(BuiltInRegistries_getItem("minecraft:gray_stained_glass_pane"));
            glass.set(DataComponents.CUSTOM_NAME, Component.literal(" "));
            for (int i = 0; i < 27; i++) {
                this.getContainer().setItem(i, glass.copy());
            }

            // Slot 11: Confirm Button
            ItemStack confirmBtn = new ItemStack(Items.EMERALD_BLOCK);
            confirmBtn.set(DataComponents.CUSTOM_NAME, Component.literal("§a✅ 確認兌現支票"));
            confirmBtn.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal("§7面額: §a$" + String.format("%.2f", data.amount()) + " 元"),
                Component.literal("§e[點擊存入戶頭餘額]")
            )));
            this.getContainer().setItem(11, confirmBtn);

            // Slot 13: Display Item Info
            this.getContainer().setItem(13, checkStack.copy());

            // Slot 15: Cancel Button
            ItemStack cancelBtn = new ItemStack(Items.REDSTONE_BLOCK);
            cancelBtn.set(DataComponents.CUSTOM_NAME, Component.literal("§c❌ 取消"));
            this.getContainer().setItem(15, cancelBtn);
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

                if (slotId == 15) {
                    sp.closeContainer();
                    return;
                }

                if (slotId == 11) {
                    sp.closeContainer();
                    // Verify player has the check item in main hand or inventory
                    ItemStack mainHand = sp.getMainHandItem();
                    ItemStack offHand = sp.getOffhandItem();
                    ItemStack targetStack = null;

                    if (isCheckItem(mainHand) && getCheckData(mainHand).id().equals(data.id())) {
                        targetStack = mainHand;
                    } else if (isCheckItem(offHand) && getCheckData(offHand).id().equals(data.id())) {
                        targetStack = offHand;
                    } else {
                        // Search inventory
                        for (int i = 0; i < sp.getInventory().getContainerSize(); i++) {
                            ItemStack s = sp.getInventory().getItem(i);
                            if (isCheckItem(s) && getCheckData(s).id().equals(data.id())) {
                                targetStack = s;
                                break;
                            }
                        }
                    }

                    if (targetStack == null || targetStack.isEmpty()) {
                        sp.sendSystemMessage(Component.literal("§c[Craft-Core] 兌現失敗：未在您的背包中找到該張支票！"));
                        sp.playSound(SoundEvents.VILLAGER_NO, 1.0f, 1.0f);
                        return;
                    }

                    // Consume 1 check
                    targetStack.shrink(1);

                    // Add money
                    String username = sp.getName().getString();
                    EconomyManager.addMoney(username, data.amount());

                    sp.sendSystemMessage(Component.literal("§b[Craft-Core] §a★ 支票兌現成功 ★"));
                    sp.sendSystemMessage(Component.literal("§f- 已將 §a$" + String.format("%.2f", data.amount()) + " 元 §f存入您的個人戶頭！"));
                    sp.playSound(SoundEvents.EXPERIENCE_ORB_PICKUP, 1.0f, 1.0f);
                    sp.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
                    return;
                }
            }
            super.clicked(slotId, button, clickType, player);
        }

        @Override
        public boolean stillValid(Player player) {
            return true;
        }
    }

    private static net.minecraft.world.item.Item BuiltInRegistries_getItem(String id) {
        net.minecraft.world.item.Item item = net.minecraft.core.registries.BuiltInRegistries.ITEM.getValue(net.minecraft.resources.Identifier.parse(id));
        return item != null ? item : Items.PAPER;
    }
}
