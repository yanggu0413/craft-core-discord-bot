package com.craftcore.claim;

import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.ChestBlock;
import net.minecraft.world.level.block.state.BlockState;

import java.util.List;

public class LockboxGuiManager {

    private static abstract class ReadOnlyMenuHandler extends ChestMenu {
        public ReadOnlyMenuHandler(MenuType<ChestMenu> type, int syncId, net.minecraft.world.entity.player.Inventory playerInventory, SimpleContainer container, int rows) {
            super(type, syncId, playerInventory, container, rows);
        }

        @Override
        public boolean stillValid(net.minecraft.world.entity.player.Player player) {
            return true;
        }

        @Override
        public void clicked(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player player) {
            if (slotId >= 0 && slotId < this.getContainer().getContainerSize()) {
                handleMenuClick(slotId, button, clickType, player);
                return;
            }
            super.clicked(slotId, button, clickType, player);
        }

        public abstract void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player player);
    }

    private static Item getItem(String id) {
        return BuiltInRegistries.ITEM.getValue(Identifier.parse(id));
    }

    private static ItemStack createGuiItem(Item item, String name, List<String> lore) {
        ItemStack stack = new ItemStack(item != null ? item : Items.PAPER);
        stack.set(net.minecraft.core.component.DataComponents.CUSTOM_NAME, Component.literal(name));
        if (lore != null && !lore.isEmpty()) {
            List<Component> loreComponents = lore.stream().map(Component::literal).map(c -> (Component) c).toList();
            stack.set(net.minecraft.core.component.DataComponents.LORE, new net.minecraft.world.item.component.ItemLore(loreComponents));
        }
        return stack;
    }

    private static void fillBackground(SimpleContainer container) {
        ItemStack border = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < container.getContainerSize(); i++) {
            container.setItem(i, border.copy());
        }
    }

    public static void openLockboxGui(ServerPlayer player, BlockPos pos) {
        if (player == null || pos == null) return;
        Level world = player.level();
        BlockState state = world.getBlockState(pos);
        if (!(state.getBlock() instanceof ChestBlock)) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 目標位置非箱子！請面向或站在箱子前操作。"));
            return;
        }

        String key = LockboxManager.getLockboxKey(world, pos);
        LockboxManager.Lockbox lockbox = LockboxManager.getLockbox(key);

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        String username = player.getName().getString();

        if (lockbox == null) {
            // Unlocked chest
            container.setItem(22, createGuiItem(Items.TRIPWIRE_HOOK, "§a🔒 設定此箱子密碼鎖 (/padlock)", List.of(
                    "§7目前狀態: §a[未鎖定]",
                    "§7點擊後請在聊天欄輸入欲設定的密碼",
                    "",
                    "§e[點擊設定密碼鎖]"
            )));
        } else {
            boolean isOwner = lockbox.owner != null && lockbox.owner.equalsIgnoreCase(username);

            container.setItem(13, createGuiItem(Items.CHEST, "§6🔒 密碼箱狀態資訊", List.of(
                    "§7擁有者: §f" + lockbox.owner,
                    "§7位置: §f" + lockbox.location,
                    "§7已授權成員數: §f" + (lockbox.authorized != null ? lockbox.authorized.size() : 0) + " 人"
            )));

            if (isOwner) {
                container.setItem(20, createGuiItem(Items.TRIPWIRE_HOOK, "§e🔑 修改鎖箱密碼", List.of("§7點擊後在聊天欄輸入新密碼", "", "§e[點擊修改密碼]")));
                container.setItem(22, createGuiItem(Items.PLAYER_HEAD, "§b👥 管理共享授權成員", List.of("§7新增或移除免密碼開箱的信任成員", "", "§e[點擊管理成員]")));
                container.setItem(24, createGuiItem(Items.BARRIER, "§c🗑️ 拆除/解開此箱子密碼鎖", List.of("§7移除密碼鎖，回復普通箱子", "", "§c[點擊移除密碼鎖]")));
            } else {
                container.setItem(22, createGuiItem(Items.IRON_DOOR, "§a🔓 輸入密碼嘗試解鎖開箱", List.of("§7點擊後在聊天欄輸入此箱子密碼", "", "§e[點擊輸入密碼]")));
            }
        }

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) { com.craftcore.menu.MenuGuiManager.openMainMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }

                            if (lockbox == null && slotId == 22) {
                                sp.closeContainer();
                                LockboxManager.pendingLocks.put(username.toLowerCase(), key);
                                sp.sendSystemMessage(Component.literal("§b[密碼鎖] 請在聊天欄輸入欲設定的密碼（例如: 1234），或輸入 cancel 取消："));
                                return;
                            }

                            if (lockbox != null) {
                                boolean isOwner = lockbox.owner != null && lockbox.owner.equalsIgnoreCase(username);
                                if (isOwner) {
                                    if (slotId == 20) {
                                        sp.closeContainer();
                                        LockboxManager.pendingLocks.put(username.toLowerCase(), key);
                                        sp.sendSystemMessage(Component.literal("§b[密碼鎖] 請在聊天欄輸入新的修改密碼，或輸入 cancel 取消："));
                                    } else if (slotId == 24) {
                                        sp.closeContainer();
                                        sp.level().getServer().getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "padlock remove");
                                    }
                                } else if (slotId == 22) {
                                    sp.closeContainer();
                                    sp.sendSystemMessage(Component.literal("§b[密碼鎖] 請輸入指令 /padlock <密碼> 進行開箱解鎖！"));
                                }
                            }
                        }
                    }
                }, Component.literal("§1🔒 密碼鎖保險箱管理")));
    }
}
