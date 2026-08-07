package com.craftcore.vein;

import com.craftcore.claim.ClaimManager;
import net.minecraft.core.BlockPos;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.tags.BlockTags;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.tags.ItemTags;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class VeinMinerManager {

    public static class PlayerVeinConfig {
        public boolean treeFellerEnabled = true;
        public boolean veinMinerEnabled = true;

        public PlayerVeinConfig(boolean treeFellerEnabled, boolean veinMinerEnabled) {
            this.treeFellerEnabled = treeFellerEnabled;
            this.veinMinerEnabled = veinMinerEnabled;
        }
    }

    private static final Map<UUID, PlayerVeinConfig> playerConfigs = new ConcurrentHashMap<>();
    private static final ThreadLocal<Boolean> IS_VEIN_MINING = ThreadLocal.withInitial(() -> false);

    public static PlayerVeinConfig getConfig(UUID uuid) {
        return playerConfigs.computeIfAbsent(uuid, k -> new PlayerVeinConfig(true, true));
    }

    public static boolean isCurrentlyVeinMining() {
        return IS_VEIN_MINING.get();
    }

    public static void onBlockBreak(ServerPlayer player, BlockPos originPos, BlockState originState) {
        if (player == null || originPos == null || originState == null) return;
        if (IS_VEIN_MINING.get()) return; // Prevent recursion loop

        ServerLevel level = (ServerLevel) player.level();
        ItemStack handItem = player.getMainHandItem();
        if (handItem.isEmpty()) return;

        PlayerVeinConfig config = getConfig(player.getUUID());
        Block originBlock = originState.getBlock();
        String blockId = BuiltInRegistries.BLOCK.getKey(originBlock).toString();

        boolean isTree = config.treeFellerEnabled && isAxeTool(handItem) && isLogBlock(originState, blockId);
        boolean isOre = config.veinMinerEnabled && isPickaxeTool(handItem) && isOreBlock(originState, blockId);

        if (!isTree && !isOre) return;

        IS_VEIN_MINING.set(true);
        try {
            int maxBlocks = 64;
            int blocksBroken = 0;

            Queue<BlockPos> queue = new LinkedList<>();
            Set<BlockPos> visited = new HashSet<>();

            queue.add(originPos);
            visited.add(originPos);

            int maxDistanceSq = isTree ? 100 : 36; // 10 blocks for trees, 6 for ores

            while (!queue.isEmpty() && blocksBroken < maxBlocks) {
                BlockPos currentPos = queue.poll();

                // Skip the initial broken block itself
                if (!currentPos.equals(originPos)) {
                    BlockState currentState = level.getBlockState(currentPos);
                    if (isMatchingBlock(currentState, originBlock, isTree)) {
                        // Claim permission check
                        if (!ClaimManager.checkPermission(player, currentPos, level, "break")) {
                            continue;
                        }

                        // Durability check (Keep at least 1 durability)
                        ItemStack currentHandItem = player.getMainHandItem();
                        if (currentHandItem.isDamageableItem() && (currentHandItem.getMaxDamage() - currentHandItem.getDamageValue()) <= 1) {
                            player.sendSystemMessage(Component.literal("§c[連鎖挖掘] 工具耐久度過低！保護性停止連鎖以防工具爆掉。"));
                            break;
                        }

                        // Destroy block with drops and trigger LevelMixin events
                        boolean success = level.destroyBlock(currentPos, true, player);
                        if (success) {
                            blocksBroken++;
                            // Damage hand item
                            currentHandItem.hurtAndBreak(1, level, player, item -> {});
                        }
                    }
                }

                // Add adjacent connected blocks (3x3x3 search sphere)
                for (int dx = -1; dx <= 1; dx++) {
                    for (int dy = -1; dy <= 1; dy++) {
                        for (int dz = -1; dz <= 1; dz++) {
                            if (dx == 0 && dy == 0 && dz == 0) continue;
                            BlockPos neighbor = currentPos.offset(dx, dy, dz);
                            if (!visited.contains(neighbor) && neighbor.distSqr(originPos) <= maxDistanceSq) {
                                visited.add(neighbor);
                                BlockState neighborState = level.getBlockState(neighbor);
                                if (isMatchingBlock(neighborState, originBlock, isTree)) {
                                    queue.add(neighbor);
                                }
                            }
                        }
                    }
                }
            }
        } finally {
            IS_VEIN_MINING.set(false);
        }
    }

    private static boolean isAxeTool(ItemStack item) {
        if (item == null || item.isEmpty()) return false;
        if (item.is(ItemTags.AXES)) return true;
        return item.getItem().toString().contains("axe");
    }

    private static boolean isPickaxeTool(ItemStack item) {
        if (item == null || item.isEmpty()) return false;
        if (item.is(ItemTags.PICKAXES)) return true;
        return item.getItem().toString().contains("pickaxe");
    }

    private static boolean isLogBlock(BlockState state, String blockId) {
        if (state.is(BlockTags.LOGS)) return true;
        return blockId.contains("_log") || blockId.contains("_wood") || blockId.contains("_stem") || blockId.contains("hyphae");
    }

    private static boolean isOreBlock(BlockState state, String blockId) {
        if (blockId == null) return false;
        return blockId.contains("_ore") || blockId.contains("ancient_debris") || blockId.endsWith(":raw_iron_block") || blockId.endsWith(":raw_gold_block") || blockId.endsWith(":raw_copper_block");
    }

    private static boolean isMatchingBlock(BlockState state, Block originBlock, boolean isTree) {
        if (state == null || state.isAir()) return false;
        if (state.getBlock() == originBlock) return true;
        String id = BuiltInRegistries.BLOCK.getKey(state.getBlock()).toString();
        String originId = BuiltInRegistries.BLOCK.getKey(originBlock).toString();

        if (isTree) {
            return isLogBlock(state, id);
        } else {
            return isOreBlock(state, id) && (id.replace("deepslate_", "").equals(originId.replace("deepslate_", "")));
        }
    }

    private static abstract class ReadOnlyVeinMenuHandler extends ChestMenu {
        public ReadOnlyVeinMenuHandler(MenuType<ChestMenu> type, int syncId, net.minecraft.world.entity.player.Inventory playerInventory, SimpleContainer container, int rows) {
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

        @Override
        public ItemStack quickMoveStack(net.minecraft.world.entity.player.Player player, int slot) {
            return ItemStack.EMPTY;
        }

        public abstract void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker);
    }

    public static void openVeinGui(ServerPlayer player) {
        if (player == null) return;
        PlayerVeinConfig config = getConfig(player.getUUID());

        SimpleContainer container = new SimpleContainer(27);
        ItemStack glass = createGuiItem(getItemFromIdentifier("minecraft:gray_stained_glass_pane"), " ", List.of());
        for (int i = 0; i < 27; i++) {
            container.setItem(i, glass);
        }

        container.setItem(4, createGuiItem(Items.DIAMOND_PICKAXE, "§6⛏️ 連鎖挖掘與砍樹系統 (/vein)", List.of(
                "§7支援所有原木樹種與礦石連鎖破壞",
                "§7相容每日 AI 任務與全服成就系統",
                "§7手持工具自動連鎖，耐久度不足保護停止"
        )));

        // Slot 11: Tree Feller Toggle
        Item treeIcon = config.treeFellerEnabled ? Items.OAK_LOG : Items.BARRIER;
        container.setItem(11, createGuiItem(treeIcon, "§e🌲 連鎖砍樹功能 " + (config.treeFellerEnabled ? "§a[已開啟]" : "§c[已關閉]"), List.of(
                "§7手持斧頭砍伐原木時連鎖破壞周遭樹木",
                "§7當前狀態: " + (config.treeFellerEnabled ? "§a[開啟中]" : "§c[關閉中]"),
                "",
                "§e[點擊切換連鎖砍樹開關]"
        )));

        // Slot 15: Vein Miner Toggle
        Item oreIcon = config.veinMinerEnabled ? Items.DIAMOND_ORE : Items.BARRIER;
        container.setItem(15, createGuiItem(oreIcon, "§b⛏️ 連鎖採礦功能 " + (config.veinMinerEnabled ? "§a[已開啟]" : "§c[已關閉]"), List.of(
                "§7手持鎬子挖掘礦石時連鎖破壞整條礦脈",
                "§7當前狀態: " + (config.veinMinerEnabled ? "§a[開啟中]" : "§c[關閉中]"),
                "",
                "§e[點擊切換連鎖採礦開關]"
        )));

        // Slot 26: Close
        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉介面")));

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
            new ReadOnlyVeinMenuHandler(MenuType.GENERIC_9x3, syncId, inv, container, 3) {
                @Override
                public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                    if (clicker instanceof ServerPlayer sp) {
                        if (slotId == 11) {
                            config.treeFellerEnabled = !config.treeFellerEnabled;
                            sp.sendSystemMessage(Component.literal("§b[連鎖挖掘] 已切換連鎖砍樹為: " + (config.treeFellerEnabled ? "§a[開啟]" : "§c[關閉]")));
                            openVeinGui(sp);
                        } else if (slotId == 15) {
                            config.veinMinerEnabled = !config.veinMinerEnabled;
                            sp.sendSystemMessage(Component.literal("§b[連鎖挖掘] 已切換連鎖採礦為: " + (config.veinMinerEnabled ? "§a[開啟]" : "§c[關閉]")));
                            openVeinGui(sp);
                        } else if (slotId == 26) {
                            sp.closeContainer();
                        }
                    }
                }
            }, Component.literal("§8❖ ⛏️ 連鎖挖掘控制台 (/vein) ❖")));
    }

    private static Item getItemFromIdentifier(String idStr) {
        if (idStr == null || idStr.isEmpty()) return Items.BOOK;
        try {
            return BuiltInRegistries.ITEM.getValue(Identifier.parse(idStr));
        } catch (Throwable t) {
            return Items.BOOK;
        }
    }

    private static ItemStack createGuiItem(Item item, String name, List<String> loreLines) {
        ItemStack stack = new ItemStack(item != null ? item : Items.BOOK);
        stack.set(DataComponents.CUSTOM_NAME, Component.literal(name));
        if (loreLines != null && !loreLines.isEmpty()) {
            List<Component> comps = loreLines.stream().map(Component::literal).map(c -> (Component) c).toList();
            stack.set(DataComponents.LORE, new ItemLore(comps));
        }
        return stack;
    }
}
