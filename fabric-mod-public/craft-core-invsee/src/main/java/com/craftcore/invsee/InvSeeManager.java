package com.craftcore.invsee;

import com.craftcore.api.EconomyAPI;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemLore;

import java.util.List;

public class InvSeeManager {

    public static class InvSeeMenuScreenHandler extends ChestMenu {
        private final ServerPlayer viewer;
        private final ServerPlayer targetPlayer;
        private final String targetName;
        private boolean isEnderChestMode = false;
        private final SimpleContainer customContainer = new SimpleContainer(54);

        public InvSeeMenuScreenHandler(int syncId, Inventory playerInventory, ServerPlayer viewer, ServerPlayer targetPlayer, String targetName) {
            super(MenuType.GENERIC_9x6, syncId, playerInventory, new SimpleContainer(54), 6);
            this.viewer = viewer;
            this.targetPlayer = targetPlayer;
            this.targetName = targetName;
            refreshSlots();
        }

        public void refreshSlots() {
            if (isEnderChestMode) {
                renderEnderChestView();
            } else {
                renderMainInventoryView();
            }
        }

        private void renderMainInventoryView() {
            if (targetPlayer != null) {
                Inventory inv = targetPlayer.getInventory();
                for (int i = 0; i < 36; i++) {
                    customContainer.setItem(i, inv.getItem(i).copy());
                }
                customContainer.setItem(36, targetPlayer.getItemBySlot(EquipmentSlot.HEAD).copy());
                customContainer.setItem(37, targetPlayer.getItemBySlot(EquipmentSlot.CHEST).copy());
                customContainer.setItem(38, targetPlayer.getItemBySlot(EquipmentSlot.LEGS).copy());
                customContainer.setItem(39, targetPlayer.getItemBySlot(EquipmentSlot.FEET).copy());
                customContainer.setItem(40, targetPlayer.getItemBySlot(EquipmentSlot.OFFHAND).copy());
            }

            ItemStack infoStack = new ItemStack(Items.PAPER);
            infoStack.set(DataComponents.CUSTOM_NAME, Component.literal("§e[玩家狀態] " + targetName));
            if (targetPlayer != null) {
                double health = targetPlayer.getHealth();
                double maxHealth = targetPlayer.getMaxHealth();
                int food = targetPlayer.getFoodData().getFoodLevel();
                double bal = EconomyAPI.getProvider().getBalance(targetName);
                List<Component> lore = List.of(
                        Component.literal("§7生命值: §a" + (int)health + " / " + (int)maxHealth),
                        Component.literal("§7飽食度: §e" + food + " / 20"),
                        Component.literal("§7金幣餘額: §d$" + (int)bal)
                );
                infoStack.set(DataComponents.LORE, new ItemLore(lore));
            }
            customContainer.setItem(41, infoStack);

            ItemStack glass = new ItemStack(BuiltInRegistries.ITEM.getValue(Identifier.parse("minecraft:gray_stained_glass_pane")));
            glass.set(DataComponents.CUSTOM_NAME, Component.literal(" "));
            customContainer.setItem(42, glass);
            customContainer.setItem(43, glass);

            ItemStack enderBtn = new ItemStack(Items.ENDER_CHEST);
            enderBtn.set(DataComponents.CUSTOM_NAME, Component.literal("§d🟣 切換至末影箱模式"));
            enderBtn.set(DataComponents.LORE, new ItemLore(List.of(Component.literal("§7點擊檢視目標玩家的末影箱內容"))));
            customContainer.setItem(44, enderBtn);

            for (int i = 45; i < 54; i++) {
                customContainer.setItem(i, glass);
            }

            for (int i = 0; i < 54; i++) {
                this.getContainer().setItem(i, customContainer.getItem(i));
            }
        }

        private void renderEnderChestView() {
            for (int i = 0; i < 54; i++) {
                customContainer.setItem(i, ItemStack.EMPTY);
            }

            if (targetPlayer != null) {
                var ec = targetPlayer.getEnderChestInventory();
                for (int i = 0; i < Math.min(27, ec.getContainerSize()); i++) {
                    customContainer.setItem(i, ec.getItem(i).copy());
                }
            }

            ItemStack glass = new ItemStack(BuiltInRegistries.ITEM.getValue(Identifier.parse("minecraft:purple_stained_glass_pane")));
            glass.set(DataComponents.CUSTOM_NAME, Component.literal(" "));
            for (int i = 27; i < 44; i++) {
                customContainer.setItem(i, glass);
            }

            ItemStack mainBtn = new ItemStack(Items.CHEST);
            mainBtn.set(DataComponents.CUSTOM_NAME, Component.literal("§a🟢 切換至主要背包模式"));
            mainBtn.set(DataComponents.LORE, new ItemLore(List.of(Component.literal("§7點擊切換回目標玩家的主背包與裝備"))));
            customContainer.setItem(44, mainBtn);

            for (int i = 45; i < 54; i++) {
                customContainer.setItem(i, glass);
            }

            for (int i = 0; i < 54; i++) {
                this.getContainer().setItem(i, customContainer.getItem(i));
            }
        }

        @Override
        public ItemStack quickMoveStack(Player player, int slot) {
            if (!isEnderChestMode && slot >= 41 && slot <= 53) {
                return ItemStack.EMPTY;
            }
            if (isEnderChestMode && slot >= 27) {
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

            if (slotId == 44) {
                this.isEnderChestMode = !this.isEnderChestMode;
                refreshSlots();
                if (player instanceof ServerPlayer sp) {
                    sp.containerMenu.sendAllDataToRemote();
                    sp.inventoryMenu.sendAllDataToRemote();
                }
                return;
            }

            boolean isOp = viewer.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);

            if (!isEnderChestMode) {
                if (slotId >= 41 && slotId <= 53) {
                    if (player instanceof ServerPlayer sp) {
                        sp.containerMenu.sendAllDataToRemote();
                        sp.inventoryMenu.sendAllDataToRemote();
                    }
                    return;
                }

                super.clicked(slotId, button, clickType, player);

                if (targetPlayer != null) {
                    ItemStack newItem = this.getContainer().getItem(slotId);
                    if (slotId < 36) {
                        targetPlayer.getInventory().setItem(slotId, newItem.copy());
                    } else if (slotId == 36) {
                        targetPlayer.setItemSlot(EquipmentSlot.HEAD, newItem.copy());
                    } else if (slotId == 37) {
                        targetPlayer.setItemSlot(EquipmentSlot.CHEST, newItem.copy());
                    } else if (slotId == 38) {
                        targetPlayer.setItemSlot(EquipmentSlot.LEGS, newItem.copy());
                    } else if (slotId == 39) {
                        targetPlayer.setItemSlot(EquipmentSlot.FEET, newItem.copy());
                    } else if (slotId == 40) {
                        targetPlayer.setItemSlot(EquipmentSlot.OFFHAND, newItem.copy());
                    }

                    if (isOp && !targetPlayer.equals(viewer)) {
                        targetPlayer.sendSystemMessage(Component.literal("§e[Craft-Core] 管理員/OP 調整了您的背包物品。"));
                    }
                }
            } else {
                if (slotId >= 27) {
                    if (player instanceof ServerPlayer sp) {
                        sp.containerMenu.sendAllDataToRemote();
                        sp.inventoryMenu.sendAllDataToRemote();
                    }
                    return;
                }

                super.clicked(slotId, button, clickType, player);

                if (targetPlayer != null) {
                    ItemStack newItem = this.getContainer().getItem(slotId);
                    targetPlayer.getEnderChestInventory().setItem(slotId, newItem.copy());

                    if (isOp && !targetPlayer.equals(viewer)) {
                        targetPlayer.sendSystemMessage(Component.literal("§e[Craft-Core] 管理員/OP 調整了您的末影箱物品。"));
                    }
                }
            }

            if (player instanceof ServerPlayer sp) {
                sp.containerMenu.sendAllDataToRemote();
                sp.inventoryMenu.sendAllDataToRemote();
            }
        }
    }

    public static void openInvSeeGui(ServerPlayer viewer, String targetName) {
        if (viewer == null || targetName == null) return;
        MinecraftServer server = viewer.level().getServer();
        if (server == null) return;

        ServerPlayer targetPlayer = server.getPlayerList().getPlayerByName(targetName);
        if (targetPlayer == null) {
            for (ServerPlayer p : server.getPlayerList().getPlayers()) {
                if (p.getName().getString().equalsIgnoreCase(targetName) || p.getName().getString().replaceFirst("^\\.", "").equalsIgnoreCase(targetName.replaceFirst("^\\.", ""))) {
                    targetPlayer = p;
                    break;
                }
            }
        }

        if (targetPlayer == null) {
            viewer.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到玩家: " + targetName + " (對方目前離線)"));
            return;
        }

        final ServerPlayer finalTarget = targetPlayer;
        viewer.openMenu(new SimpleMenuProvider(
                (syncId, inv, p) -> new InvSeeMenuScreenHandler(syncId, inv, viewer, finalTarget, finalTarget.getName().getString()),
                Component.literal("§8[InvSee] " + finalTarget.getName().getString() + " 的背包")
        ));
    }
}
