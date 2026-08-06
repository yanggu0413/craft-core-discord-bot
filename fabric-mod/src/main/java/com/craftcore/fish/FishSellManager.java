package com.craftcore.fish;

import com.craftcore.economy.EconomyManager;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.ItemLore;

import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.world.Container;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Items;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class FishSellManager {

    private static final Pattern LENGTH_PATTERN = Pattern.compile("魚類尺寸:\\s*§e([0-9.]+)\\s*cm");
    private static final Pattern WEIGHT_PATTERN = Pattern.compile("魚類重量:\\s*§b([0-9.]+)\\s*kg");

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

    public static double calculateFishPrice(ItemStack stack) {
        if (stack == null || stack.isEmpty()) return 0.0;
        if (!stack.has(DataComponents.CUSTOM_NAME)) return 0.0;

        String customName = stack.get(DataComponents.CUSTOM_NAME).getString();
        if (!customName.startsWith("§6★ ")) return 0.0;

        double lengthCm = 50.0;
        double weightKg = 20.0;

        if (stack.has(DataComponents.LORE)) {
            ItemLore lore = stack.get(DataComponents.LORE);
            if (lore != null) {
                for (Component comp : lore.lines()) {
                    String text = comp.getString();
                    Matcher lm = LENGTH_PATTERN.matcher(text);
                    if (lm.find()) {
                        try { lengthCm = Double.parseDouble(lm.group(1)); } catch (Exception ignored) {}
                    }
                    Matcher wm = WEIGHT_PATTERN.matcher(text);
                    if (wm.find()) {
                        try { weightKg = Double.parseDouble(wm.group(1)); } catch (Exception ignored) {}
                    }
                }
            }
        }

        // Base $20.0 + (lengthCm * 0.3) + (weightKg * 0.4), capped at $300.0 max per fish
        double rawPrice = 20.0 + (lengthCm * 0.3) + (weightKg * 0.4);
        return Math.min(300.0, Math.max(20.0, rawPrice));
    }

    public static boolean sellHandheldFish(ServerPlayer player) {
        if (player == null) return false;
        ItemStack hand = player.getMainHandItem();
        double price = calculateFishPrice(hand);

        if (price <= 0) {
            player.sendSystemMessage(Component.literal("§c[售魚商店] 請主手拿著在 craftcore:fishing 釣到的奇幻 NBT 魚類！"));
            return false;
        }

        String username = player.getName().getString();
        String fishName = hand.get(DataComponents.CUSTOM_NAME).getString().replace("§6★ ", "");

        hand.shrink(1);
        EconomyManager.addMoney(username, price);

        player.sendSystemMessage(Component.literal(String.format("§a💰 [售魚成功] 成功售出【%s】，獲得金幣 §e$%.1f 元§a！", fishName, price)));
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.EXPERIENCE_ORB_PICKUP, SoundSource.PLAYERS, 1.0f, 1.2f);
        return true;
    }

    public static void sellAllInventoryFish(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();

        double totalRevenue = 0.0;
        int count = 0;

        for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
            ItemStack stack = player.getInventory().getItem(i);
            double price = calculateFishPrice(stack);
            if (price > 0) {
                int qty = stack.getCount();
                totalRevenue += (price * qty);
                count += qty;
                player.getInventory().setItem(i, ItemStack.EMPTY);
            }
        }

        if (count > 0) {
            EconomyManager.addMoney(username, totalRevenue);
            player.sendSystemMessage(Component.literal(String.format("§a💰 [一鍵全售] 成功售出背包內 §e%d 條§a 奇幻魚類，總共獲取金幣 §e$%.1f 元§a！", count, totalRevenue)));
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0f, 1.5f);
        } else {
            player.sendSystemMessage(Component.literal("§c[售魚商店] 背包內沒有可出售的奇幻 NBT 魚類！"));
        }
    }

    // =========================================================
    // 售魚回收箱 (Fish Sell Bin Container GUI 9x6)
    // =========================================================
    public static class FishSellBinScreenHandler extends ChestMenu {
        private final ServerPlayer seller;
        private final Container sellContainer;
        private boolean isCompleted = false;

        public FishSellBinScreenHandler(int syncId, Inventory playerInventory, ServerPlayer seller) {
            super(MenuType.GENERIC_9x6, syncId, playerInventory, new SimpleContainer(54), 6);
            this.seller = seller;
            this.sellContainer = this.getContainer();

            // Render separator
            ItemStack glass = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
            for (int i = 36; i < 45; i++) {
                sellContainer.setItem(i, glass.copy());
            }

            sellContainer.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回釣魚大廳", List.of("§7點擊返回 /fish 介面")));
            sellContainer.setItem(53, createGuiItem(Items.BARRIER, "§c❌ 取消售魚", List.of("§7點擊取消並取回所有放置的物品")));

            updateDynamicButton();
        }

        public void updateDynamicButton() {
            int fishCount = 0;
            double totalPrice = 0.0;
            int nonFishCount = 0;

            for (int i = 0; i < 36; i++) {
                ItemStack stack = sellContainer.getItem(i);
                if (!stack.isEmpty()) {
                    double price = calculateFishPrice(stack);
                    if (price > 0) {
                        int qty = stack.getCount();
                        totalPrice += (price * qty);
                        fishCount += qty;
                    } else {
                        nonFishCount += stack.getCount();
                    }
                }
            }

            String title = fishCount > 0
                    ? String.format("§a💰 確認售出 (共 §e%d 條魚§a)", fishCount)
                    : "§7💰 放置魚類以掃描金額";

            List<String> lore = new ArrayList<>();
            lore.add("§7請將欲出售的奇幻魚類放入上方 0-35 號格子中");
            lore.add(String.format("§7當前預計總收益: §e$%.1f 元金幣", totalPrice));
            if (nonFishCount > 0) {
                lore.add(String.format("§e[注意] 包含 %d 個非魚類物品 (結算時將自動退回背包)", nonFishCount));
            }
            lore.add("");
            lore.add(fishCount > 0 ? "§a[點擊確認售出金幣入帳]" : "§c[目前回收箱無可售魚類]");

            sellContainer.setItem(49, createGuiItem(Items.GOLD_INGOT, title, lore));
        }

        @Override
        public ItemStack quickMoveStack(Player player, int slot) {
            if (slot >= 36 && slot <= 53) {
                return ItemStack.EMPTY;
            }
            ItemStack stack = super.quickMoveStack(player, slot);
            updateDynamicButton();
            return stack;
        }

        @Override
        public void clicked(int slotId, int button, ContainerInput clickType, Player player) {
            if (player instanceof ServerPlayer sp) {
                sp.containerMenu.sendAllDataToRemote();
                sp.inventoryMenu.sendAllDataToRemote();
            }

            if (slotId == 45) {
                if (player instanceof ServerPlayer sp) {
                    FishingContestManager.openFishGui(sp);
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
                    double totalRevenue = 0.0;
                    int count = 0;
                    List<ItemStack> nonFishItems = new ArrayList<>();

                    for (int i = 0; i < 36; i++) {
                        ItemStack stack = sellContainer.getItem(i);
                        if (!stack.isEmpty()) {
                            double price = calculateFishPrice(stack);
                            if (price > 0) {
                                int qty = stack.getCount();
                                totalRevenue += (price * qty);
                                count += qty;
                                sellContainer.setItem(i, ItemStack.EMPTY);
                            } else {
                                nonFishItems.add(stack.copy());
                                sellContainer.setItem(i, ItemStack.EMPTY);
                            }
                        }
                    }

                    if (count <= 0) {
                        sp.sendSystemMessage(Component.literal("§c[售魚商店] 回收箱內沒有可出售的奇幻 NBT 魚類！"));
                        sp.playSound(SoundEvents.VILLAGER_NO, 1.0f, 1.0f);
                        // Return non fish items if any
                        for (ItemStack item : nonFishItems) {
                            sp.getInventory().placeItemBackInInventory(item);
                        }
                        updateDynamicButton();
                        return;
                    }

                    this.isCompleted = true;
                    sp.closeContainer();

                    // Pay seller
                    EconomyManager.addMoney(sp.getName().getString(), totalRevenue);
                    sp.sendSystemMessage(Component.literal(String.format("§a💰 [回收箱結算] 成功售出 §e%d 條§a 奇幻魚類，總共獲得金幣 §e$%.1f 元§a！", count, totalRevenue)));
                    sp.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.2f);

                    // Safely place non-fish items back into inventory
                    if (!nonFishItems.isEmpty()) {
                        for (ItemStack item : nonFishItems) {
                            sp.getInventory().placeItemBackInInventory(item);
                        }
                        sp.sendSystemMessage(Component.literal("§e[系統提示] 非魚類物品已安全退回您的背包中。"));
                    }
                }
                return;
            }

            if (slotId >= 36 && slotId <= 53) {
                return; // Block interacting with control bar
            }

            super.clicked(slotId, button, clickType, player);
            updateDynamicButton();

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
                    ItemStack stack = sellContainer.getItem(i);
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

    public static void openFishSellBin(ServerPlayer seller) {
        if (seller == null) return;
        seller.openMenu(new SimpleMenuProvider(
                (syncId, inv, p) -> new FishSellBinScreenHandler(syncId, inv, seller),
                Component.literal("§a🐟 奇幻售魚回收箱 (將魚類放回下方回收)")
        ));
    }
}
