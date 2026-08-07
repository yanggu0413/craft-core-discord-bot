package com.craftcore.menu;

import com.craftcore.data.JsonDataStore;
import com.craftcore.title.TitleManager;
import com.google.gson.reflect.TypeToken;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.Permissions;
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
import net.minecraft.world.item.component.ResolvableProfile;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

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

    public static class MenuData {
        public Map<String, Integer> playerClickStats = new ConcurrentHashMap<>();
        public Map<String, String> checkInRecords = new ConcurrentHashMap<>();
    }

    private static final String DATA_FILE = "menu.json";
    private static MenuData menuData;

    static {
        loadData();
    }

    public static synchronized void loadData() {
        menuData = JsonDataStore.loadData(DATA_FILE, MenuData.class, new MenuData());
        if (menuData.playerClickStats == null) menuData.playerClickStats = new ConcurrentHashMap<>();
        if (menuData.checkInRecords == null) menuData.checkInRecords = new ConcurrentHashMap<>();
    }

    public static synchronized void saveData() {
        JsonDataStore.saveDataAsync(DATA_FILE, menuData);
    }

    private static Item getItem(String id) {
        try {
            return BuiltInRegistries.ITEM.getValue(Identifier.parse(id));
        } catch (Throwable t) {
            return Items.PAPER;
        }
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

    public static void fillBackground(SimpleContainer container) {
        ItemStack border = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < container.getContainerSize(); i++) {
            container.setItem(i, border.copy());
        }
    }

    public static ItemStack createPlayerHead(String username) {
        ItemStack headStack = new ItemStack(Items.PLAYER_HEAD);
        if (username != null && !username.isEmpty()) {
            try {
                headStack.set(DataComponents.PROFILE, ResolvableProfile.createUnresolved(username));
            } catch (Throwable ignored) {}
        }
        return headStack;
    }

    // =========================================================
    // 1. 主選單 (54-Slot Hub GUI)
    // =========================================================
    public static void openMainMenu(ServerPlayer player) {
        if (player == null) return;
        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(Permissions.COMMANDS_OWNER);

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(10, createGuiItem(Items.EMERALD_BLOCK, "§a🏪 商店管理系統", List.of(
                "§7查看個人箱子商店、擺攤與市場行情",
                "",
                "§e[點擊開啟商店系統]"
        )));

        container.setItem(12, createGuiItem(Items.PAPER, "§e📜 銀行支票中心", List.of(
                "§7開立與兌現實體紙張支票",
                "§7可交易、贈送或經由漏斗傳輸",
                "",
                "§e[點擊開啟支票中心 GUI]"
        )));

        container.setItem(14, createGuiItem(Items.CHEST, "§e📦 虛擬快遞箱", List.of(
                "§7寄送跨服/離線物品包裹",
                "§7接收玩家寄送物資與查看歷史紀錄",
                "",
                "§e[點擊開啟快遞箱選單]"
        )));

        container.setItem(16, createGuiItem(Items.HOPPER, "§c🗑 隨身垃圾桶", List.of(
                "§7開啟 10 秒自動銷毀隨身垃圾桶",
                "",
                "§e[點擊開啟垃圾桶]"
        )));

        container.setItem(19, createGuiItem(Items.COMPASS, "§e🌐 世界與維度切換中心 (/world)", List.of(
                "§7傳送至全服各個特製維度與世界",
                "§7• 🌍 主世界 Spawn / 🔥 下界 / 🌌 終界",
                "§7• 🎣 奇幻釣魚維度 (craftcore:fishing)",
                "",
                "§e[點擊開啟 /world 維度切換 GUI]"
        )));

        container.setItem(21, createGuiItem(Items.GRASS_BLOCK, "§b🛡 領地與密碼箱", List.of(
                "§7管理個人領地、獲取圈地神杖",
                "§7以及密碼鎖保險箱設定",
                "",
                "§e[點擊開啟領地子選單]"
        )));

        container.setItem(23, createGuiItem(Items.ENDER_PEARL, "§6🤝 玩家傳送請求", List.of(
                "§7點擊開啟線上玩家頭顱列表",
                "§7發送對點傳送請求至目標玩家",
                "",
                "§e[點擊開啟 TPA 選擇器]"
        )));

        container.setItem(25, createGuiItem(Items.NETHERITE_SWORD, "§c⚔ PvP 戰鬥切換", List.of(
                "§7切換個人 PvP 戰鬥狀態",
                "",
                "§e[點擊執行 /pvp]"
        )));

        container.setItem(28, createGuiItem(Items.NETHER_STAR, "§d🎰 福利中心", List.of(
                "§7每日簽到、在線時數兌換鑰匙",
                "§7幸運 9x3 轉盤抽獎與炫彩稱號",
                "",
                "§e[點擊開啟福利中心 GUI]"
        )));

        container.setItem(30, createGuiItem(Items.DIAMOND_SWORD, "§c⚔ 每日任務中心", List.of(
                "§7查看與接取每日專屬任務",
                "",
                "§e[點擊開啟任務 GUI]"
        )));

        container.setItem(32, createGuiItem(Items.GOLD_BLOCK, "§6🏆 全服排行榜", List.of(
                "§7查看財富排行榜、鑰匙排行榜",
                "§7與連續簽到排行榜",
                "",
                "§e[點擊開啟排行榜 GUI]"
        )));

        container.setItem(34, createGuiItem(Items.DISPENSER, "§6💬 官方 Discord 社群", List.of(
                "§7點擊獲取 Discord 社群邀請連結",
                "",
                "§e[點擊開啟 Discord 選單]"
        )));

        container.setItem(37, createGuiItem(Items.ARMOR_STAND, "§f🤖 假人 (Bot) 控制台", List.of(
                "§7一鍵召喚/解散假人、切換掛機動作",
                "",
                "§e[點擊開啟假人子選單]"
        )));

        container.setItem(39, createGuiItem(Items.REDSTONE_BLOCK, "§6🏭 機器認證與免領地費", List.of(
                "§7提交自動化機器認證申請",
                "",
                "§e[點擊開啟機器認證子選單]"
        )));

        container.setItem(41, createGuiItem(Items.NAME_TAG, "§d✨ 個人外觀裝扮中心", List.of(
                "§7切換頭頂炫彩稱號與稱號炫彩粒子",
                "",
                "§e[點擊開啟外觀裝扮中心]"
        )));

        if (isOp) {
            container.setItem(43, createGuiItem(Items.BEACON, "§4🛠 管理員 (OP) 控制台", List.of(
                    "§c[OP 專屬權限]",
                    "§7全服玩家/假人背包與末影箱監看",
                    "",
                    "§e[點擊開啟管理員主控台]"
            )));
        } else {
            container.setItem(43, createGuiItem(Items.BOOK, "§e📖 伺服器指南說明", List.of(
                    "§7獲取全服功能、指令與領地保護教學",
                    "",
                    "§e[點擊顯示線上文件網址]"
            )));
        }

        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此 GUI 介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            MinecraftServer server = sp.level().getServer();
                            if (server == null) return;
                            if (slotId == 10) executeCmd(sp, "shop");
                            else if (slotId == 12) executeCmd(sp, "check");
                            else if (slotId == 14) executeCmd(sp, "express");
                            else if (slotId == 16) executeCmd(sp, "wastebin");
                            else if (slotId == 19) executeCmd(sp, "world");
                            else if (slotId == 21) executeCmd(sp, "claim");
                            else if (slotId == 23) executeCmd(sp, "tpa");
                            else if (slotId == 25) executeCmd(sp, "pvp");
                            else if (slotId == 28) openWelfareCenterMenu(sp);
                            else if (slotId == 30) executeCmd(sp, "task");
                            else if (slotId == 32) openLeaderboardMenu(sp);
                            else if (slotId == 34) executeCmd(sp, "discord");
                            else if (slotId == 37) executeCmd(sp, "fp");
                            else if (slotId == 39) executeCmd(sp, "machine");
                            else if (slotId == 41) openCosmeticsMenu(sp);
                            else if (slotId == 43) {
                                if (isOp) executeCmd(sp, "invsee");
                                else executeCmd(sp, "help");
                            }
                            else if (slotId == 49) sp.closeContainer();
                        }
                    }
                }, Component.literal("§1📜 伺服器選單大廳")));
    }

    private static void executeCmd(ServerPlayer player, String command) {
        player.closeContainer();
        MinecraftServer server = player.level().getServer();
        if (server != null) {
            server.getCommands().performPrefixedCommand(player.createCommandSourceStack(), command);
        }
    }

    // =========================================================
    // 2. 福利中心 (Welfare Center 9x3 GUI)
    // =========================================================
    public static void openWelfareCenterMenu(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();

        SimpleContainer container = new SimpleContainer(27);
        fillBackground(container);

        ItemStack head = createPlayerHead(username);
        head.set(DataComponents.CUSTOM_NAME, Component.literal("§e👤 個人福利帳號狀態"));
        head.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal("§7玩家名稱: §f" + username),
                Component.literal(""),
                Component.literal("§a[點擊進行簽到與大抽獎]")
        )));
        container.setItem(4, head);

        container.setItem(10, createGuiItem(Items.PAPER, "§a📅 30 天每日簽到月曆", List.of(
                "§7每日簽到獲得 $150 元金幣",
                "",
                "§e[點擊開啟 30 天簽到月曆 GUI]"
        )));

        container.setItem(12, createGuiItem(Items.CLOCK, "§b⌛ 遊戲時數禮包", List.of(
                "§7累積在線時數獎勵",
                "",
                "§e[點擊查看時數禮包]"
        )));

        container.setItem(14, createGuiItem(Items.NETHER_STAR, "§d🎰 幸運大抽獎", List.of(
                "§7幸運轉盤抽獎",
                "",
                "§e[點擊開啟抽獎介面]"
        )));

        container.setItem(16, createGuiItem(Items.GOLD_BLOCK, "§6🏆 全服排行榜", List.of(
                "§7查看全服各大排行榜",
                "",
                "§e[點擊開啟排行榜 GUI]"
        )));

        container.setItem(22, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x3, containerId, playerInventory, container, 3) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 22) { openMainMenu(sp); return; }
                            if (slotId == 26) { sp.closeContainer(); return; }
                            if (slotId == 10) openCheckInCalendarGui(sp);
                            else if (slotId == 12) executeCmd(sp, "checkin");
                            else if (slotId == 14) executeCmd(sp, "luckydraw");
                            else if (slotId == 16) openLeaderboardMenu(sp);
                        }
                    }
                }, Component.literal("§8❖ 🎰 福利中心大廳 ❖")));
    }

    public static void openCosmeticsMenu(ServerPlayer player) {
        if (player == null) return;
        SimpleContainer container = new SimpleContainer(27);
        fillBackground(container);

        container.setItem(4, createGuiItem(Items.NAME_TAG, "§d✨ 個人外觀裝扮中心", List.of(
                "§7客製化頭頂稱號"
        )));

        container.setItem(13, createGuiItem(Items.NAME_TAG, "§c👑 頭頂炫彩稱號", List.of(
                "§7查看與切換已解鎖的個人頭頂炫彩稱號",
                "",
                "§e[點擊開啟頭頂稱號選單]"
        )));

        container.setItem(22, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x3, containerId, playerInventory, container, 3) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 22) { openMainMenu(sp); return; }
                            if (slotId == 26) { sp.closeContainer(); return; }
                            if (slotId == 13) openWelfareTitleMenu(sp);
                        }
                    }
                }, Component.literal("§8❖ ✨ 個人外觀裝扮中心 ❖")));
    }

    public static void openWelfareTitleMenu(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();
        Set<String> unlocked = TitleManager.getUnlockedTitles(username);
        String activeTitle = TitleManager.getActiveTitle(username);

        SimpleContainer container = new SimpleContainer(27);
        fillBackground(container);

        container.setItem(4, createGuiItem(Items.NAME_TAG, "§6👑 個人稱號清單", List.of(
                "§7當前使用稱號: §e" + (activeTitle.isEmpty() ? "無" : activeTitle),
                "§7已解鎖稱號數量: §a" + unlocked.size()
        )));

        int slot = 9;
        for (String title : unlocked) {
            if (slot >= 22) break;
            boolean isActive = title.equalsIgnoreCase(activeTitle);
            ItemStack item = createGuiItem(isActive ? Items.NETHER_STAR : Items.PAPER,
                    (isActive ? "§a✔ " : "§f") + title,
                    List.of(
                            isActive ? "§a[當前佩戴中]" : "§e[點擊佩戴此稱號]"
                    ));
            container.setItem(slot++, item);
        }

        container.setItem(22, createGuiItem(Items.ARROW, "§a⬅ 返回個人裝扮", List.of("§7點擊返回外觀中心")));
        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 卸下當前稱號", List.of("§7點擊清除頭頂稱號")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x3, containerId, playerInventory, container, 3) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 22) { openCosmeticsMenu(sp); return; }
                            if (slotId == 26) {
                                TitleManager.setActiveTitle(sp.getName().getString(), "");
                                sp.sendSystemMessage(Component.literal("§a[稱號系統] 已卸下當前頭頂稱號。"));
                                openWelfareTitleMenu(sp);
                                return;
                            }
                            if (slotId >= 9 && slotId < 22) {
                                ItemStack clicked = container.getItem(slotId);
                                if (!clicked.isEmpty() && clicked.has(DataComponents.CUSTOM_NAME)) {
                                    String name = clicked.get(DataComponents.CUSTOM_NAME).getString().replace("§a✔ ", "").replace("§f", "");
                                    TitleManager.setActiveTitle(sp.getName().getString(), name);
                                    sp.sendSystemMessage(Component.literal("§a[稱號系統] 已成功佩戴稱號：" + name));
                                    openWelfareTitleMenu(sp);
                                }
                            }
                        }
                    }
                }, Component.literal("§8❖ 👑 頭頂稱號大廳 ❖")));
    }

    public static void openCheckInCalendarGui(ServerPlayer player) {
        if (player == null) return;
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Taipei"));
        int currentDay = now.getDayOfMonth();
        int daysInMonth = now.toLocalDate().lengthOfMonth();

        String username = player.getName().getString();

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(4, createGuiItem(Items.BOOK, "§6📅 30 天每日簽到月曆", List.of(
                "§7當前日期: §f第 " + currentDay + " 天 / 共 " + daysInMonth + " 天",
                "§7每日簽到獎勵: §d$150 元金幣"
        )));

        int slotStart = 9;
        for (int day = 1; day <= 30; day++) {
            int slot = slotStart + (day - 1);
            if (slot >= 45) break;

            if (day <= daysInMonth) {
                if (day < currentDay) {
                    container.setItem(slot, createGuiItem(getItem("minecraft:lime_stained_glass_pane"), "§a✔ 第 " + day + " 天 (過去)", List.of(
                            "§7狀態: §a[歷史簽到]"
                    )));
                } else if (day == currentDay) {
                    container.setItem(slot, createGuiItem(Items.NETHER_STAR, "§e🌟 第 " + day + " 天 (今日可簽到！)", List.of(
                            "§7點擊完成今日簽到",
                            "§7獎勵: $150 元金幣",
                            "",
                            "§a[點擊簽到]"
                    )));
                } else {
                    container.setItem(slot, createGuiItem(getItem("minecraft:gray_stained_glass_pane"), "§7第 " + day + " 天 (未解鎖)", List.of("§7未到日期")));
                }
            }
        }

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回福利中心", List.of("§7返回上一頁")));
        container.setItem(49, createGuiItem(Items.EMERALD_BLOCK, "§a▶️ 一鍵完成今日簽到", List.of(
                "§7點擊完成簽到",
                "",
                "§a[點擊簽到]"
        )));
        container.setItem(53, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) { openWelfareCenterMenu(sp); return; }
                            if (slotId == 53) { sp.closeContainer(); return; }
                            if (slotId == 49 || slotId == (9 + currentDay - 1)) {
                                executeCmd(sp, "checkin");
                                openCheckInCalendarGui(sp);
                            }
                        }
                    }
                }, Component.literal("§8❖ 📅 30 天每日簽到月曆 ❖")));
    }

    public static void openLeaderboardMenu(ServerPlayer player) {
        if (player == null) return;
        SimpleContainer container = new SimpleContainer(27);
        fillBackground(container);

        container.setItem(4, createGuiItem(Items.GOLD_BLOCK, "§6🏆 全服排行榜大廳", List.of(
                "§7查看全服榮耀與排行榜數據"
        )));

        container.setItem(11, createGuiItem(Items.EMERALD, "§a💰 財富排行榜", List.of("§7點擊查看金幣排行榜")));
        container.setItem(15, createGuiItem(Items.NETHER_STAR, "§d🎰 簽到與榮耀榜", List.of("§7點擊查看全服統計榜")));

        container.setItem(22, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7返回 /menu 大廳")));
        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7關閉介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x3, containerId, playerInventory, container, 3) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 22) { openMainMenu(sp); return; }
                            if (slotId == 26) { sp.closeContainer(); return; }
                            if (slotId == 11) executeCmd(sp, "baltop");
                        }
                    }
                }, Component.literal("§8❖ 🏆 全服排行榜 ❖")));
    }
}
