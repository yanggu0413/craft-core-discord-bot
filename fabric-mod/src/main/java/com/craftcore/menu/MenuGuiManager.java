package com.craftcore.menu;

import com.craftcore.bounty.GlobalGoalManager;
import com.craftcore.fakeplayer.FakePlayerManager;
import com.craftcore.invsee.InvSeeManager;
import com.craftcore.teleport.HomeManager;
import com.craftcore.teleport.WarpManager;
import com.craftcore.title.TitleManager;
import com.craftcore.treasure.TreasureChestManager;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.Permissions;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;

import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;

import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemLore;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class MenuGuiManager {

    public abstract static class ReadOnlyMenuHandler extends ChestMenu {
        public ReadOnlyMenuHandler(MenuType<ChestMenu> type, int syncId, net.minecraft.world.entity.player.Inventory playerInventory, net.minecraft.world.Container container, int rows) {
            super(type, syncId, playerInventory, container, rows);
        }

        @Override
        public ItemStack quickMoveStack(net.minecraft.world.entity.player.Player player, int slot) {
            return ItemStack.EMPTY;
        }

        @Override
        public void clicked(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player player) {
            if (player instanceof ServerPlayer sp) {
                sp.containerMenu.sendAllDataToRemote();
                sp.inventoryMenu.sendAllDataToRemote();
            }
            if (slotId >= 0 && slotId < getContainer().getContainerSize()) {
                handleMenuClick(slotId, button, clickType, player);
                if (player instanceof ServerPlayer sp) {
                    sp.containerMenu.sendAllDataToRemote();
                    sp.inventoryMenu.sendAllDataToRemote();
                }
                return;
            }
            if (player instanceof ServerPlayer sp) {
                sp.containerMenu.sendAllDataToRemote();
                sp.inventoryMenu.sendAllDataToRemote();
            }
        }

        @Override
        public boolean stillValid(net.minecraft.world.entity.player.Player p) {
            return true;
        }

        public abstract void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player player);
    }

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

    private static void fillBackground(SimpleContainer container) {
        ItemStack border = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < container.getContainerSize(); i++) {
            container.setItem(i, border.copy());
        }
    }

    // Helper to clear inner grid slots (row 2-5, col 2-8)
    private static void clearInnerGrid(SimpleContainer container) {
        fillBackground(container);
        int[] innerSlots = {
                10, 11, 12, 13, 14, 15, 16,
                19, 20, 21, 22, 23, 24, 25,
                28, 29, 30, 31, 32, 33, 34,
                37, 38, 39, 40, 41, 42, 43
        };
        for (int s : innerSlots) {
            container.setItem(s, ItemStack.EMPTY);
        }
    }

    // =========================================================
    // 1. 主選單 (54-Slot Hub GUI)
    // =========================================================
    public static void openMainMenu(ServerPlayer player) {
        if (player == null) return;
        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(Permissions.COMMANDS_OWNER);

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        // 🏪 商店管理
        container.setItem(10, createGuiItem(Items.EMERALD_BLOCK, "§a🏪 商店管理系統", List.of(
                "§7查看個人箱子商店、擺攤與市場行情",
                "",
                "§e[點擊開啟商店系統 (/shop)]"
        )));

        // 🛡️ 領地與保險箱
        container.setItem(12, createGuiItem(Items.SHIELD, "§b🛡️ 領地與密碼箱", List.of(
                "§7管理個人領地、獲取圈地神杖",
                "§7以及密碼鎖保險箱設定",
                "",
                "§e[點擊開啟領地子選單]"
        )));

        // 🧭 傳送與家園
        container.setItem(14, createGuiItem(Items.COMPASS, "§e🧭 傳送與家園", List.of(
                "§7傳送至個人家點 (/home)",
                "§7公共地標 (/warp)、隨機傳送 (/rtp)",
                "§7與返回死亡點 (/back)",
                "",
                "§e[點擊開啟傳送子選單]"
        )));

        // ⚔️ 任務與懸賞
        container.setItem(16, createGuiItem(Items.DIAMOND_SWORD, "§c⚔️ 任務與懸賞", List.of(
                "§7查看每日任務 (/tasks)、全服大目標 (/bounty)",
                "§7與野外藏寶圖線索 (/treasure)",
                "",
                "§e[點擊開啟任務子選單]"
        )));

        // 🎰 福利與稱號
        container.setItem(28, createGuiItem(Items.NETHER_STAR, "§d🎰 福利與頭頂稱號", List.of(
                "§7切換與佩戴頭頂炫彩稱號 (/title)",
                "§7查看在線時數與兌換幸運鑰匙",
                "",
                "§e[點擊開啟福利稱號子選單]"
        )));

        // 🤖 假人控制
        container.setItem(30, createGuiItem(Items.PLAYER_HEAD, "§f🤖 假人 (Bot) 控制台", List.of(
                "§7一鍵召喚/解散假人、切換掛機動作",
                "§7與一鍵查看假人背包 (/invsee)",
                "",
                "§e[點擊開啟假人子選單]"
        )));

        // 🏭 機器認證
        container.setItem(32, createGuiItem(Items.REDSTONE_BLOCK, "§6🏭 機器認證與免領地費", List.of(
                "§7提交自動化機器認證申請 (/machine apply)",
                "§7查看已通過認證之 T2/T3 免領地費機器",
                "",
                "§e[點擊開啟機器認證子選單]"
        )));

        // 🛠️ 管理員控制台 (OP 專屬)
        if (isOp) {
            container.setItem(34, createGuiItem(Items.BEACON, "§4🛠️ 管理員 (OP) 控制台", List.of(
                    "§c[OP 專屬權限]",
                    "§7全服玩家/假人 /invsee 背包與末影箱",
                    "§7機器認證審核、7z 地圖手動備份",
                    "",
                    "§e[點擊開啟管理員主控台]"
            )));
        }

        // ❌ 關閉選單
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此 GUI 介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 10) openShopMenu(sp);
                            else if (slotId == 12) openClaimMenu(sp);
                            else if (slotId == 14) openTeleportMenu(sp);
                            else if (slotId == 16) openTaskBountyMenu(sp);
                            else if (slotId == 28) openWelfareTitleMenu(sp);
                            else if (slotId == 30) openFakePlayerMenu(sp);
                            else if (slotId == 32) openMachineMenu(sp);
                            else if (slotId == 34 && isOp) openAdminMenu(sp);
                            else if (slotId == 49) sp.closeContainer();
                        }
                    }
                }, Component.literal("§1📜 Craft-Core 伺服器選單大廳")));
    }

    // =========================================================
    // 2. 傳送與家園 GUI (Teleport & Homes) - 精美整齊版面 (統一 Slot 45 返回)
    // =========================================================
    public static void openTeleportMenu(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();

        SimpleContainer container = new SimpleContainer(54);
        clearInnerGrid(container);

        // 頂部快捷動作 (Row 1)
        container.setItem(0, createGuiItem(Items.FEATHER, "§a🎲 隨機傳送 (/rtp)", List.of("§7隨機傳送至野外安全地點", "", "§e[點擊執行 /rtp]")));
        container.setItem(1, createGuiItem(getItem("minecraft:red_bed"), "§c💀 返回死亡點 (/back)", List.of("§7傳送回上次死亡地點", "", "§e[點擊執行 /back]")));

        // 家園清單 (Homes: Slots 10-16, 19-25)
        Map<String, HomeManager.Home> homes = HomeManager.getPlayerHomes(username);
        int[] homeSlots = {10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24, 25};
        int homeIdx = 0;
        if (homes.isEmpty()) {
            container.setItem(homeSlots[0], createGuiItem(Items.OAK_DOOR, "§7尚未設置家園", List.of("§7可於遊戲內使用 /sethome <名稱> 設置點位")));
        } else {
            for (Map.Entry<String, HomeManager.Home> entry : homes.entrySet()) {
                if (homeIdx >= homeSlots.length) break;
                String homeName = entry.getKey();
                HomeManager.Home h = entry.getValue();
                container.setItem(homeSlots[homeIdx++], createGuiItem(getItem("minecraft:cyan_bed"), "§e🏠 家園: " + homeName, List.of(
                        "§7座標: §f" + h.x + " " + h.y + " " + h.z,
                        "§7維度: " + h.dimension,
                        "",
                        "§a[點擊即時傳送至此家園]"
                )));
            }
        }

        // 公共地標 (Warps: Slots 28-34, 37-43)
        List<WarpManager.Warp> warps = WarpManager.getWarps();
        int[] warpSlots = {28, 29, 30, 31, 32, 33, 34, 37, 38, 39, 40, 41, 42, 43};
        int warpIdx = 0;
        for (WarpManager.Warp w : warps) {
            if (warpIdx >= warpSlots.length) break;
            container.setItem(warpSlots[warpIdx++], createGuiItem(Items.ENDER_PEARL, "§b🌐 地標: " + w.name, List.of(
                    "§7維度: " + w.dimension,
                    "",
                    "§a[點擊即時傳送至 " + w.name + "]"
            )));
        }

        // 底部導航按鈕 (Slot 45 返回主選單, Slot 49 關閉選單)
        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅️ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            MinecraftServer server = sp.level().getServer();
                            if (server == null) return;

                            if (slotId == 45) { openMainMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }
                            if (slotId == 0) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "rtp"); return; }
                            if (slotId == 1) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "back"); return; }

                            ItemStack clickedStack = container.getItem(slotId);
                            if (clickedStack != null && clickedStack.has(DataComponents.CUSTOM_NAME)) {
                                String name = clickedStack.get(DataComponents.CUSTOM_NAME).getString();
                                if (name.startsWith("§e🏠 家園: ")) {
                                    String homeName = name.replace("§e🏠 家園: ", "").trim();
                                    sp.closeContainer();
                                    server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "home " + homeName);
                                } else if (name.startsWith("§b🌐 地標: ")) {
                                    String warpName = name.replace("§b🌐 地標: ", "").trim();
                                    sp.closeContainer();
                                    server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "warp " + warpName);
                                }
                            }
                        }
                    }
                }, Component.literal("§1🧭 傳送與家園選單")));
    }

    // =========================================================
    // 3. 假人控制 GUI (Fake Player Hub) - 精美整齊版面 (統一 Slot 45 返回)
    // =========================================================
    public static void openFakePlayerMenu(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();

        SimpleContainer container = new SimpleContainer(54);
        clearInnerGrid(container);

        // 頂部列 (Row 1)
        container.setItem(4, createGuiItem(Items.PLAYER_HEAD, "§a➕ 召喚新假人 (/bot spawn)", List.of(
                "§7在您當前位置召喚新假人助手",
                "",
                "§e[點擊執行召喚]"
        )));

        // 假人清單 (Slots 10-16, 19-25, 28-34)
        Map<String, String> allBots = FakePlayerManager.getAllFakePlayers();
        int[] botSlots = {
                10, 11, 12, 13, 14, 15, 16,
                19, 20, 21, 22, 23, 24, 25,
                28, 29, 30, 31, 32, 33, 34
        };
        int botIdx = 0;
        for (Map.Entry<String, String> entry : allBots.entrySet()) {
            if (botIdx >= botSlots.length) break;
            String botName = entry.getKey();
            String owner = entry.getValue();

            boolean isOwner = owner.equalsIgnoreCase(username);
            boolean isOp = player.createCommandSourceStack().permissions().hasPermission(Permissions.COMMANDS_OWNER);

            if (isOwner || isOp) {
                container.setItem(botSlots[botIdx++], createGuiItem(Items.ARMOR_STAND, "§e🤖 假人: " + botName, List.of(
                        "§7擁有者: " + owner,
                        "§7- 點擊左鍵: 開啟假人背包 (/invsee " + botName + ")",
                        "§7- 點擊右鍵: 切換假人打怪/防護模式 (/fp attack)",
                        "§7- 點擊 Q 鍵 (Drop): 解散該假人"
                )));
            }
        }

        // 底部導航按鈕 (Slot 45 返回主選單, Slot 49 關閉選單)
        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅️ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            MinecraftServer server = sp.level().getServer();
                            if (server == null) return;

                            if (slotId == 45) { openMainMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }
                            if (slotId == 4) {
                                sp.closeContainer();
                                String newBotName = "fp_" + sp.getName().getString().toLowerCase() + "_" + (System.currentTimeMillis() % 100);
                                server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "player " + newBotName + " spawn");
                                FakePlayerManager.register(newBotName, sp.getName().getString());
                                return;
                            }

                            ItemStack clickedStack = container.getItem(slotId);
                            if (clickedStack != null && clickedStack.has(DataComponents.CUSTOM_NAME)) {
                                String name = clickedStack.get(DataComponents.CUSTOM_NAME).getString();
                                if (name.startsWith("§e🤖 假人: ")) {
                                    String botName = name.replace("§e🤖 假人: ", "").trim();
                                    sp.closeContainer();
                                    if (clickType == ContainerInput.THROW) {
                                        server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "player " + botName + " kill");
                                        FakePlayerManager.unregister(botName);
                                    } else if (button == 1) { // Right click
                                        server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "player " + botName + " attack interval 20");
                                    } else { // Left click
                                        InvSeeManager.openInvSeeGui(sp, botName);
                                    }
                                }
                            }
                        }
                    }
                }, Component.literal("§1🤖 假人控制台選單")));
    }

    // =========================================================
    // 4. 任務與懸賞 GUI (Tasks & Bounties)
    // =========================================================
    public static void openTaskBountyMenu(ServerPlayer player) {
        if (player == null) return;
        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅️ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        container.setItem(20, createGuiItem(Items.BOOK, "§a⚔️ 每日任務 (/tasks)", List.of(
                "§7查看今日擊殺與挖掘任務",
                "",
                "§e[點擊執行 /tasks]"
        )));

        GlobalGoalManager.GoalData goal = GlobalGoalManager.getCurrentGoal();
        double pct = Math.min(100.0, (double) goal.currentCount / goal.targetCount * 100.0);
        String topUser = GlobalGoalManager.getTopContributor();

        container.setItem(22, createGuiItem(Items.GOLDEN_APPLE, "§e🌐 全服每週大目標 (/bounty)", List.of(
                "§7目標: " + goal.title,
                String.format("§7全服進度: §a%d / %d (%.1f%%)", goal.currentCount, goal.targetCount, pct),
                "§7最高貢獻者: §6" + (topUser == null ? "無" : topUser),
                "",
                "§a[達標 100% 全服發放 $1000 + 2 鑰匙]"
        )));

        TreasureChestManager.TreasureLocation active = TreasureChestManager.getActiveTreasure();
        String treasureHint = "目前無活躍寶箱，即將刷新！";
        if (active != null && !active.opened) {
            int minX = (active.x / 300) * 300;
            int minZ = (active.z / 300) * 300;
            treasureHint = String.format("區塊: X: %d ~ %d, Z: %d ~ %d", minX, minX + 300, minZ, minZ + 300);
        }

        container.setItem(24, createGuiItem(Items.FILLED_MAP, "§6🗺️ 野外藏寶圖線索 (/treasure)", List.of(
                "§7提示: " + treasureHint,
                "",
                "§e[點擊執行 /treasure]"
        )));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            MinecraftServer server = sp.level().getServer();
                            if (server == null) return;

                            if (slotId == 45) { openMainMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }
                            if (slotId == 20) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "tasks"); return; }
                            if (slotId == 22) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "bounty"); return; }
                            if (slotId == 24) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "treasure"); return; }
                        }
                    }
                }, Component.literal("§1⚔️ 任務與懸賞選單")));
    }

    // =========================================================
    // 5. 福利與頭頂稱號 GUI (Welfare & Titles)
    // =========================================================
    public static void openWelfareTitleMenu(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅️ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        Set<String> unlocked = TitleManager.getUnlockedTitles(username);
        String active = TitleManager.getActiveTitle(username);

        container.setItem(13, createGuiItem(Items.NAME_TAG, "§d頭頂稱號狀態", List.of(
                "§7當前佩戴: " + (active.isEmpty() ? "§8(無)" : active),
                "§7已解鎖數量: §a" + unlocked.size() + " 個"
        )));

        int slot = 19;
        for (String title : unlocked) {
            if (slot >= 44) break;
            boolean isEquipped = title.equals(active);
            container.setItem(slot++, createGuiItem(Items.PAPER, title, List.of(
                    isEquipped ? "§a[當前正佩戴此稱號]" : "§e[點擊佩戴此稱號]",
                    "",
                    "§7指令: /title set \"" + title + "\""
            )));
        }

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) { openMainMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }

                            ItemStack clickedStack = container.getItem(slotId);
                            if (clickedStack != null && clickedStack.has(DataComponents.CUSTOM_NAME)) {
                                String titleName = clickedStack.get(DataComponents.CUSTOM_NAME).getString();
                                if (!titleName.equals("頭頂稱號狀態") && !titleName.equals("⬅️ 返回主選單")) {
                                    TitleManager.setActiveTitle(sp.getName().getString(), titleName);
                                    sp.sendSystemMessage(Component.literal("§a成功切換頭頂稱號為: " + titleName));
                                    openWelfareTitleMenu(sp);
                                }
                            }
                        }
                    }
                }, Component.literal("§1🎰 福利與頭頂稱號選單")));
    }

    public static void openShopMenu(ServerPlayer player) {
        if (player == null || player.level().getServer() == null) return;
        player.level().getServer().getCommands().performPrefixedCommand(player.createCommandSourceStack(), "shop");
    }

    public static void openClaimMenu(ServerPlayer player) {
        if (player == null) return;
        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅️ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        container.setItem(20, createGuiItem(Items.WOODEN_HOE, "§6🪄 領地劃分神杖 (/claim tool)", List.of(
                "§7點擊一鍵免費領取領地圈地神杖 (木鋤)",
                "§e- 左鍵點擊方塊: 設置點 1 (Pos1)",
                "§e- 右鍵點擊方塊: 設置點 2 (Pos2)",
                "",
                "§a[點擊直接領取神杖]"
        )));

        container.setItem(22, createGuiItem(Items.PAPER, "§b📜 我的領地列表 (/claim list)", List.of(
                "§7查看您目前擁有的所有領地與座標",
                "",
                "§e[點擊查看清單 (/claim list)]"
        )));

        container.setItem(24, createGuiItem(Items.EMERALD, "§a💰 購買圈選領地 (/claim)", List.of(
                "§7圈選完成後，點擊創建並購買此領地",
                "",
                "§a[點擊購買領地 (/claim)]"
        )));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            MinecraftServer server = sp.level().getServer();
                            if (server == null) return;

                            if (slotId == 45) { openMainMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }
                            if (slotId == 20) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "claim tool"); return; }
                            if (slotId == 22) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "claim list"); return; }
                            if (slotId == 24) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "claim"); return; }
                        }
                    }
                }, Component.literal("§1🛡️ 領地與保險箱選單")));
    }

    public static void openMachineMenu(ServerPlayer player) {
        if (player == null) return;
        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅️ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        container.setItem(22, createGuiItem(Items.REDSTONE_LAMP, "§a🏭 提交機器審核 (/machine apply)", List.of(
                "§7站在您的機器領地內點擊提交審核",
                "§7管理員認證 T2/T3 後可享受 100% 免領地費！",
                "",
                "§e[點擊提交認證]"
        )));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) { openMainMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }
                            if (slotId == 22) {
                                sp.closeContainer();
                                sp.sendSystemMessage(Component.literal("§b請輸入 /machine apply <機器名稱> 提交機器認證！"));
                            }
                        }
                    }
                }, Component.literal("§1🏭 機器認證選單")));
    }

    public static void openAdminMenu(ServerPlayer player) {
        if (player == null) return;
        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅️ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        container.setItem(20, createGuiItem(Items.PLAYER_HEAD, "§4全服玩家 /invsee 背包管理", List.of("§7點擊開啟線上玩家選擇器", "", "§e[點擊開啟選擇器]")));
        container.setItem(22, createGuiItem(Items.REPEATER, "§4機器認證審核列表", List.of("§7點擊查看待審核機器", "", "§e[點擊開啟]")));
        container.setItem(24, createGuiItem(Items.COMMAND_BLOCK, "§4手動觸發 7z 地圖備份", List.of("§7一鍵觸發全服地圖增量備份", "", "§e[點擊執行]")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            MinecraftServer server = sp.level().getServer();
                            if (server == null) return;

                            if (slotId == 45) { openMainMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }
                            if (slotId == 20) { openPlayerSelectorMenu(sp); return; }
                            if (slotId == 22) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "machine admin list"); return; }
                            if (slotId == 24) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "craftcorebackup start"); return; }
                        }
                    }
                }, Component.literal("§1🛠️ 管理員 (OP) 控制台")));
    }

    public static ItemStack createPlayerHead(String username) {
        ItemStack headStack = new ItemStack(Items.PLAYER_HEAD);
        if (username != null && !username.isEmpty()) {
            try {
                headStack.set(DataComponents.PROFILE, net.minecraft.world.item.component.ResolvableProfile.createUnresolved(username));
            } catch (Throwable ignored) {}
        }
        return headStack;
    }

    public static void openPlayerSelectorMenu(ServerPlayer adminPlayer) {
        if (adminPlayer == null || adminPlayer.level().getServer() == null) return;
        MinecraftServer server = adminPlayer.level().getServer();
        List<ServerPlayer> players = new ArrayList<>(server.getPlayerList().getPlayers());

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅️ 返回管理員選單", List.of("§7點擊返回 OP 控制台")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        int slot = 0;
        List<String> playerNames = new ArrayList<>();
        for (ServerPlayer p : players) {
            if (slot >= 45) break;
            if (slot == 45 || slot == 49) continue;
            String name = p.getName().getString();
            playerNames.add(name);

            ItemStack head = createPlayerHead(name);
            head.set(DataComponents.CUSTOM_NAME, Component.literal("§6" + name));
            List<Component> lore = List.of(
                Component.literal("§7點擊左鍵: 查看背包 (/invsee " + name + ")"),
                Component.literal("§7點擊右鍵: 查看末影箱 (/invsee " + name + " enderchest)"),
                Component.literal(""),
                Component.literal("§e[點擊選擇查看]")
            );
            head.set(DataComponents.LORE, new ItemLore(lore));
            container.setItem(slot++, head);
        }

        adminPlayer.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) { openAdminMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }

                            if (slotId >= 0 && slotId < playerNames.size()) {
                                String targetName = playerNames.get(slotId);
                                sp.closeContainer();
                                if (button == 1) {
                                    server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "invsee " + targetName + " enderchest");
                                } else {
                                    server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "invsee " + targetName);
                                }
                            }
                        }
                    }
                    @Override
                    public boolean stillValid(net.minecraft.world.entity.player.Player p) { return true; }
                }, Component.literal("§1🔍 選擇查看背包玩家 (/invsee)")));
    }
}
