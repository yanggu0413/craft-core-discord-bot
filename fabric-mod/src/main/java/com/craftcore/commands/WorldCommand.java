package com.craftcore.commands;

import com.craftcore.fish.FishingContestManager;
import com.craftcore.mining.MiningDimensionManager;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.core.BlockPos;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.level.Level;

import java.util.List;
import java.util.Set;

public class WorldCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("world")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        openWorldMenu(player);
                    }
                    return 1;
                })
        );
        
        dispatcher.register(Commands.literal("worlds")
                .executes(context -> {
                    ServerPlayer player = context.getSource().getPlayer();
                    if (player != null) {
                        openWorldMenu(player);
                    }
                    return 1;
                })
        );
    }

    private static abstract class ReadOnlyWorldMenuHandler extends ChestMenu {
        public ReadOnlyWorldMenuHandler(MenuType<ChestMenu> type, int syncId, net.minecraft.world.entity.player.Inventory playerInventory, SimpleContainer container, int rows) {
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

    public static void openWorldMenu(ServerPlayer player) {
        if (player == null) return;
        MinecraftServer server = player.level().getServer();
        if (server == null) return;

        SimpleContainer container = new SimpleContainer(27);
        ItemStack glass = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < 27; i++) {
            container.setItem(i, glass);
        }

        // Middle Row (Row 1): 5 Dimensions centered at slots 11, 12, 13, 14, 15
        // Slot 11: Overworld
        container.setItem(11, createGuiItem(Items.GRASS_BLOCK, "§a🌍 主世界 Spawn (Overworld)", List.of(
                "§7維度: §fminecraft:overworld",
                "§7全服主要玩家城鎮與建築圈地",
                "",
                "§a[點擊傳送至主世界 Spawn]"
        )));

        // Slot 12: Nether
        container.setItem(12, createGuiItem(Items.NETHERRACK, "§c🔥 下界 (The Nether)", List.of(
                "§7維度: §fminecraft:the_nether",
                "§7地獄熔岩、堡壘與遠古殘骸",
                "",
                "§c[點擊傳送至下界]"
        )));

        // Slot 13: End
        container.setItem(13, createGuiItem(Items.END_STONE, "§d🌌 終界 (The End)", List.of(
                "§7維度: §fminecraft:the_end",
                "§7終界島嶼、紫頌果與鞘翅冒險",
                "",
                "§d[點擊傳送至終界]"
        )));

        // Slot 14: Mining Dimension
        container.setItem(14, createGuiItem(Items.DIAMOND_PICKAXE, "§e⛏️ 資源採礦世界 (craftcore:mining)", List.of(
                "§7維度: §fcraftcore:mining",
                "§7自然 Overworld 地形、豐富礦脈與樹木",
                "§7距離下次週重置倒數: §e" + MiningDimensionManager.getNextResetCountdownString(),
                "",
                "§e[點擊隨機傳送進入採礦世界]"
        )));

        // Slot 15: Fishing Dimension
        container.setItem(15, createGuiItem(Items.FISHING_ROD, "§b🎣 奇幻釣魚維度 (craftcore:fishing)", List.of(
                "§7維度: §fcraftcore:fishing",
                "§7全虛空背景、100% 奇幻 NBT 魚類",
                "§70 PvP 安全保護、無限 255 BUFF",
                "",
                "§b[點擊傳送進入釣魚維度]"
        )));

        // Slot 22: Return to /menu (Centered in Bottom Row)
        container.setItem(22, createGuiItem(Items.ARROW, "§a⬅ 返回 /menu 主選單", List.of("§7點擊返回大廳選單")));

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
                new ReadOnlyWorldMenuHandler(MenuType.GENERIC_9x3, syncId, inv, container, 3) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 11) {
                                ServerLevel overworld = server.getLevel(Level.OVERWORLD);
                                if (overworld != null) {
                                    sp.closeContainer();
                                    BlockPos pos = new BlockPos(0, 70, 0);
                                    sp.teleportTo(overworld, pos.getX() + 0.5, pos.getY() + 1.0, pos.getZ() + 0.5, Set.of(), sp.getYRot(), sp.getXRot(), false);
                                    sp.playSound(SoundEvents.ENDERMAN_TELEPORT, 1.0f, 1.0f);
                                    sp.sendSystemMessage(Component.literal("§a🌍 已成功傳送至主世界 Spawn！"));
                                }
                                return;
                            }
                            if (slotId == 12) {
                                ServerLevel nether = server.getLevel(Level.NETHER);
                                if (nether != null) {
                                    sp.closeContainer();
                                    BlockPos pos = new BlockPos(0, 70, 0);
                                    sp.teleportTo(nether, pos.getX() + 0.5, Math.max(64.0, pos.getY() + 1.0), pos.getZ() + 0.5, Set.of(), sp.getYRot(), sp.getXRot(), false);
                                    sp.playSound(SoundEvents.PORTAL_TRAVEL, 0.5f, 1.2f);
                                    sp.sendSystemMessage(Component.literal("§c🔥 已成功傳送至下界 (The Nether)！"));
                                }
                                return;
                            }
                            if (slotId == 13) {
                                ServerLevel end = server.getLevel(Level.END);
                                if (end != null) {
                                    sp.closeContainer();
                                    BlockPos pos = ServerLevel.END_SPAWN_POINT;
                                    sp.teleportTo(end, pos.getX() + 0.5, pos.getY() + 1.0, pos.getZ() + 0.5, Set.of(), sp.getYRot(), sp.getXRot(), false);
                                    sp.playSound(SoundEvents.ENDERMAN_TELEPORT, 1.0f, 1.0f);
                                    sp.sendSystemMessage(Component.literal("§d🌌 已成功傳送至終界 (The End)！"));
                                }
                                return;
                            }
                            if (slotId == 14) {
                                sp.closeContainer();
                                MiningDimensionManager.randomTeleportToMiningDimension(sp);
                                return;
                            }
                            if (slotId == 15) {
                                sp.closeContainer();
                                FishingContestManager.teleportToFishingDimension(sp);
                                return;
                            }
                            if (slotId == 22 || slotId == 26) {
                                com.craftcore.menu.MenuGuiManager.openMainMenu(sp);
                                return;
                            }
                        }
                    }
                }, Component.literal("§8❖ 🌐 伺服器世界與維度傳送中心 (/world) ❖")));
    }

    private static Item getItem(String idStr) {
        try {
            return BuiltInRegistries.ITEM.getValue(Identifier.parse(idStr));
        } catch (Throwable t) {
            return Items.PAPER;
        }
    }

    private static ItemStack createGuiItem(Item item, String name, List<String> loreLines) {
        ItemStack stack = new ItemStack(item != null ? item : Items.PAPER);
        stack.set(DataComponents.CUSTOM_NAME, Component.literal(name));
        if (loreLines != null && !loreLines.isEmpty()) {
            List<Component> comps = loreLines.stream().map(Component::literal).map(c -> (Component) c).toList();
            stack.set(DataComponents.LORE, new ItemLore(comps));
        }
        return stack;
    }
}
