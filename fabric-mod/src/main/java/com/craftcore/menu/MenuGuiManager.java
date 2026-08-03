package com.craftcore.menu;

import com.craftcore.CraftCoreMod;
import com.craftcore.bounty.GlobalGoalManager;
import com.craftcore.claim.ClaimManager;
import com.craftcore.economy.EconomyManager;
import com.craftcore.event.ServerLifecycleHandler;
import com.craftcore.fakeplayer.FakePlayerManager;
import com.craftcore.invsee.InvSeeManager;
import com.craftcore.teleport.HomeManager;
import com.craftcore.teleport.WarpManager;
import com.craftcore.title.TitleManager;
import com.craftcore.treasure.TreasureChestManager;
import com.craftcore.websocket.CraftCoreWSClient;
import com.craftcore.websocket.Packet;
import com.craftcore.websocket.Packet.*;

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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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

        // Row 2: 🏪 商店 (11), 🧭 傳送 (13), 🛡 領地 (15)
        container.setItem(11, createGuiItem(Items.EMERALD_BLOCK, "§a🏪 商店管理系統", List.of(
                "§7查看個人箱子商店、擺攤與市場行情",
                "",
                "§e[點擊開啟商店系統 (/shop)]"
        )));

        container.setItem(13, createGuiItem(Items.COMPASS, "§e🧭 傳送與家園", List.of(
                "§7傳送至個人家點 (/home)",
                "§7公共地標 (/warp)、隨機傳送 (/rtp)",
                "§7與返回死亡點 (/back)",
                "",
                "§e[點擊開啟傳送子選單]"
        )));

        container.setItem(15, createGuiItem(Items.SHIELD, "§b🛡 領地與密碼箱", List.of(
                "§7管理個人領地、獲取圈地神杖",
                "§7以及密碼鎖保險箱設定",
                "",
                "§e[點擊開啟領地子選單]"
        )));

        // Row 3: 🎰 福利 (20), ⚔ 任務 (22), 📦 快遞 (24)
        container.setItem(20, createGuiItem(Items.NETHER_STAR, "§d🎰 福利中心", List.of(
                "§7每日簽到、在線時數兌換鑰匙",
                "§7幸運 9x3 轉盤抽獎與炫彩稱號",
                "",
                "§e[點擊開啟福利中心 GUI]"
        )));

        container.setItem(22, createGuiItem(Items.DIAMOND_SWORD, "§c⚔ 任務與懸賞", List.of(
                "§7查看每日任務 (/tasks)、全服大目標 (/bounty)",
                "§7與野外藏寶圖線索 (/treasure)",
                "",
                "§e[點擊開啟任務子選單]"
        )));

        container.setItem(24, createGuiItem(Items.CHEST, "§e📦 虛擬快遞箱 (/express)", List.of(
                "§7寄送跨服/離線物品包裹",
                "§7接收玩家寄送物資與查看歷史紀錄",
                "",
                "§e[點擊開啟快遞箱選單]"
        )));

        // Row 4: 🤖 假人 (29), 🏆 排行榜 (31), 🏭 機器 (33)
        container.setItem(29, createGuiItem(Items.ARMOR_STAND, "§f🤖 假人 (Bot) 控制台", List.of(
                "§7一鍵召喚/解散假人、切換掛機動作",
                "§7與一鍵查看假人背包 (/invsee)",
                "",
                "§e[點擊開啟假人子選單]"
        )));

        container.setItem(31, createGuiItem(Items.GOLD_BLOCK, "§6🏆 全服排行榜", List.of(
                "§7查看財富排行榜、鑰匙排行榜",
                "§7與連續簽到排行榜",
                "",
                "§e[點擊開啟排行榜 GUI]"
        )));

        container.setItem(33, createGuiItem(Items.REDSTONE_BLOCK, "§6🏭 機器認證與免領地費", List.of(
                "§7提交自動化機器認證申請 (/machine apply)",
                "§7查看已通過認證之 T2/T3 免領地費機器",
                "",
                "§e[點擊開啟機器認證子選單]"
        )));

        // Row 5: ⚔️ PvP 狀態切換 (Slot 38), 🛠️ OP 控制台 (Slot 40)
        boolean pvpEnabled = com.craftcore.pvp.PvpManager.isPvpEnabled(player.getName().getString());
        net.minecraft.world.item.Item pvpItem = pvpEnabled ? Items.NETHERITE_SWORD : Items.SHIELD;
        String pvpTitle = pvpEnabled ? "§c⚔️ PvP 戰鬥狀態 (已開啟)" : "§a🛡️ PvP 戰鬥狀態 (已關閉-保護中)";
        List<String> pvpLore = List.of(
                pvpEnabled ? "§7目前狀態: §c[已開啟 ⚔️]" : "§7目前狀態: §a[已關閉 🛡️ (安全模式)]",
                "§7開啟時可與其他開啟 PvP 的玩家戰鬥",
                "§7關閉時免受其他玩家傷害，亦無法攻擊他人",
                "",
                "§e[點擊切換 PvP 狀態 (/pvp)]"
        );
        container.setItem(38, createGuiItem(pvpItem, pvpTitle, pvpLore));

        if (isOp) {
            container.setItem(40, createGuiItem(Items.BEACON, "§4🛠️ 管理員 (OP) 控制台", List.of(
                    "§c[OP 專屬權限]",
                    "§7全服玩家/假人 /invsee 背包與末影箱",
                    "§7機器認證審核、7z 地圖手動備份",
                    "",
                    "§e[點擊開啟管理員主控台]"
            )));
        }

        // Row 6 (Slot 49): ❌ 關閉選單
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此 GUI 介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 11) openShopMenu(sp);
                            else if (slotId == 13) openTeleportMenu(sp);
                            else if (slotId == 15) openClaimMenu(sp);
                            else if (slotId == 20) openWelfareCenterMenu(sp);
                            else if (slotId == 22) openTaskBountyMenu(sp);
                            else if (slotId == 24) com.craftcore.express.ExpressGuiManager.openExpressMainMenu(sp);
                            else if (slotId == 29) openFakePlayerMenu(sp);
                            else if (slotId == 31) openLeaderboardMenu(sp, "wealth");
                            else if (slotId == 33) openMachineMenu(sp);
                            else if (slotId == 38) {
                                com.craftcore.pvp.PvpManager.togglePvp(sp);
                                openMainMenu(sp);
                            }
                            else if (slotId == 40 && isOp) openAdminMenu(sp);
                            else if (slotId == 49) sp.closeContainer();
                        }
                    }
                }, Component.literal("§1📜 Craft-Core 伺服器選單大廳")));
    }

    // =========================================================
    // 2. 福利中心 (Welfare Center 9x6 GUI)
    // =========================================================
    public static void openWelfareCenterMenu(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();
        int keys = EconomyManager.getLotteryKeys(username);

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        // Slot 13: 👤 個人福利帳號狀態
        ItemStack head = createPlayerHead(username);
        head.set(DataComponents.CUSTOM_NAME, Component.literal("§e👤 個人福利帳號狀態"));
        head.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal("§7玩家名稱: §f" + username),
                Component.literal("§7抽獎鑰匙: §e" + keys + " 把"),
                Component.literal(""),
                Component.literal("§a[可點擊下方按鈕進行簽到、時數兌換與大抽獎]")
        )));
        container.setItem(13, head);

        // Slot 20: 📅 每日簽到
        container.setItem(20, createGuiItem(Items.PAPER, "§a📅 每日簽到", List.of(
                "§7簽到可獲得 $150 元金幣與 1 把鑰匙",
                "§7連續簽到第 7 天可額外獲得 3 把鑰匙！",
                "",
                "§e[點擊進行每日簽到]"
        )));

        // Slot 22: ⌛ 遊戲時數兌換鑰匙
        container.setItem(22, createGuiItem(Items.CLOCK, "§b⌛ 遊戲時數兌換鑰匙", List.of(
                "§7累積在線時數每滿 5 小時",
                "§7即可免費兌換 1 把幸運抽獎鑰匙",
                "",
                "§e[點擊兌換 1 把鑰匙 (消耗 5hr 時數)]"
        )));

        // Slot 24: 🎰 幸運大抽獎
        container.setItem(24, createGuiItem(Items.NETHER_STAR, "§d🎰 幸運大抽獎 (9x3 轉盤)", List.of(
                "§7消耗 1 把抽獎鑰匙啟動 9x3 滾動轉盤",
                "§7獎勵包含鑽石、獄髓錠、金蘋果與不死圖騰！",
                "",
                "§e[點擊進入幸運大抽獎 GUI]"
        )));

        // Slot 26: 👑 頭頂炫彩稱號
        container.setItem(26, createGuiItem(Items.NAME_TAG, "§c👑 頭頂炫彩稱號", List.of(
                "§7查看與切換已解鎖的個人頭頂炫彩稱號",
                "",
                "§e[點擊開啟頭頂稱號選單]"
        )));

        // Slot 45 返回主選單, Slot 49 關閉選單
        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) { openMainMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }

                            if (slotId == 20) {
                                CraftCoreWSClient ws = CraftCoreMod.getWSClient();
                                if (ws != null && ws.isAuthenticated()) {
                                    ws.send(new Packet("checkin_request", new CheckinRequestPayload(sp.getName().getString(), sp.getStringUUID())));
                                    sp.sendSystemMessage(Component.literal("§b[Craft-Core] 已發送每日簽到請求..."));
                                } else {
                                    sp.sendSystemMessage(Component.literal("§c[Craft-Core] WebSocket 服務暫未連線，請稍後再試。"));
                                }
                            } else if (slotId == 22) {
                                CraftCoreWSClient ws = CraftCoreMod.getWSClient();
                                if (ws != null && ws.isAuthenticated()) {
                                    ws.send(new Packet("playtime_exchange", new PlaytimeExchangePayload(UUID.randomUUID().toString(), sp.getName().getString(), "single")));
                                    sp.sendSystemMessage(Component.literal("§b[Craft-Core] 已發送時數兌換請求..."));
                                } else {
                                    sp.sendSystemMessage(Component.literal("§c[Craft-Core] WebSocket 服務暫未連線，請稍後再試。"));
                                }
                            } else if (slotId == 24) {
                                openLuckyDrawGui(sp);
                            } else if (slotId == 26) {
                                openWelfareTitleMenu(sp);
                            }
                        }
                    }
                }, Component.literal("§1🎰 福利中心大廳")));
    }

    // =========================================================
    // 3. 幸運大抽獎 (Lucky Draw 9x3 Roulette Animation GUI)
    // =========================================================
    public static class LuckyDrawSession {
        public final ServerPlayer player;
        public final SimpleContainer container;
        public boolean isSpinning = false;
        public ItemStack winningItem = ItemStack.EMPTY;
        public int ticksRemaining = 0;
        public ScheduledFuture<?> future = null;

        public LuckyDrawSession(ServerPlayer player, SimpleContainer container) {
            this.player = player;
            this.container = container;
        }
    }

    private static final Map<UUID, LuckyDrawSession> activeLuckyDraws = new ConcurrentHashMap<>();
    private static final ScheduledExecutorService luckyDrawScheduler = Executors.newSingleThreadScheduledExecutor();

    private static final Item[] DRAW_ITEMS_POOL = {
        Items.DIAMOND,
        Items.NETHERITE_INGOT,
        Items.GOLDEN_APPLE,
        Items.EXPERIENCE_BOTTLE,
        Items.TOTEM_OF_UNDYING,
        Items.GOLDEN_CARROT,
        Items.IRON_INGOT,
        Items.GOLD_INGOT,
        Items.EMERALD
    };

    public static void openLuckyDrawGui(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();
        int keys = EconomyManager.getLotteryKeys(username);

        SimpleContainer container = new SimpleContainer(27);
        ItemStack border = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < 27; i++) {
            container.setItem(i, border.copy());
        }

        // Indicator markers
        container.setItem(4, createGuiItem(getItem("minecraft:red_stained_glass_pane"), "§e▼ 得獎位置 ▼", null));
        container.setItem(22, createGuiItem(getItem("minecraft:red_stained_glass_pane"), "§e▲ 得獎位置 ▲", null));

        // Initial conveyor items (slots 9..17)
        for (int s = 9; s <= 17; s++) {
            Item randomItem = DRAW_ITEMS_POOL[(s + (int)(System.currentTimeMillis() % DRAW_ITEMS_POOL.length)) % DRAW_ITEMS_POOL.length];
            container.setItem(s, createGuiItem(randomItem, "§f" + randomItem.getName(new ItemStack(randomItem)).getString(), null));
        }

        // Start Spin Button (Slot 18)
        container.setItem(18, createGuiItem(Items.NETHER_STAR, "§a🎰 開始抽獎 (消耗 1 把鑰匙)", List.of(
                "§7目前擁有鑰匙: §e" + keys + " 把",
                "",
                "§e[點擊啟動轉盤抽獎]"
        )));

        // Navigation (Slot 25 返回福利中心, Slot 26 關閉選單)
        container.setItem(25, createGuiItem(Items.ARROW, "§a⬅ 返回福利中心", List.of("§7點擊返回福利中心大廳")));
        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x3, containerId, playerInventory, container, 3) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 25) { openWelfareCenterMenu(sp); return; }
                            if (slotId == 26) { sp.closeContainer(); return; }

                            if (slotId == 18) {
                                String user = sp.getName().getString();
                                int currentKeys = EconomyManager.getLotteryKeys(user);
                                if (currentKeys < 1) {
                                    sp.sendSystemMessage(Component.literal("§c[Craft-Core] 鑰匙不足！您目前沒有抽獎鑰匙。"));
                                    return;
                                }

                                LuckyDrawSession session = activeLuckyDraws.get(sp.getUUID());
                                if (session != null && session.isSpinning) {
                                    return;
                                }

                                session = new LuckyDrawSession(sp, container);
                                session.isSpinning = true;
                                session.ticksRemaining = 24;
                                activeLuckyDraws.put(sp.getUUID(), session);

                                CraftCoreWSClient ws = CraftCoreMod.getWSClient();
                                if (ws != null && ws.isAuthenticated()) {
                                    ws.send(new Packet("luckydraw_request", new LuckydrawRequestPayload(user, sp.getStringUUID(), currentKeys)));
                                }

                                startLuckyDrawAnimation(session);
                            }
                        }
                    }
                }, Component.literal("§1🎰 幸運大抽獎 9x3 轉盤")));
    }

    private static void startLuckyDrawAnimation(LuckyDrawSession session) {
        final int[] step = {0};
        final int totalSteps = 24;

        Runnable tickTask = new Runnable() {
            @Override
            public void run() {
                if (session.player == null || session.player.hasDisconnected() || session.container == null) {
                    activeLuckyDraws.remove(session.player != null ? session.player.getUUID() : null);
                    return;
                }

                MinecraftServer server = ServerLifecycleHandler.serverInstance;
                if (server != null) {
                    server.execute(() -> {
                        for (int s = 9; s < 17; s++) {
                            session.container.setItem(s, session.container.getItem(s + 1));
                        }
                        Item nextRandomItem = DRAW_ITEMS_POOL[(int) (Math.random() * DRAW_ITEMS_POOL.length)];
                        session.container.setItem(17, createGuiItem(nextRandomItem, "§f" + nextRandomItem.getName(new ItemStack(nextRandomItem)).getString(), null));

                        try {
                            session.player.level().playSound(null, session.player.getX(), session.player.getY(), session.player.getZ(), SoundEvents.UI_BUTTON_CLICK, SoundSource.PLAYERS, 0.5f, 1.2f);
                        } catch (Throwable ignored) {}

                        step[0]++;
                        if (step[0] >= totalSteps) {
                            if (session.winningItem != null && !session.winningItem.isEmpty()) {
                                session.container.setItem(13, session.winningItem);
                            }
                            try {
                                session.player.level().playSound(null, session.player.getX(), session.player.getY(), session.player.getZ(), SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0f, 1.0f);
                            } catch (Throwable ignored) {}

                            int updatedKeys = EconomyManager.getLotteryKeys(session.player.getName().getString());
                            session.container.setItem(18, createGuiItem(Items.NETHER_STAR, "§a🎰 開始抽獎 (消耗 1 把鑰匙)", List.of(
                                    "§7目前擁有鑰匙: §e" + updatedKeys + " 把",
                                    "",
                                    "§e[點擊啟動轉盤抽獎]"
                            )));

                            session.isSpinning = false;
                            activeLuckyDraws.remove(session.player.getUUID());
                        } else {
                            long nextDelay = 60 + (long)(Math.pow((double)step[0] / totalSteps, 2) * 350);
                            session.future = luckyDrawScheduler.schedule(this, nextDelay, TimeUnit.MILLISECONDS);
                        }
                    });
                }
            }
        };

        session.future = luckyDrawScheduler.schedule(tickTask, 60, TimeUnit.MILLISECONDS);
    }

    public static void handleLuckyDrawResponse(LuckydrawResponsePayload payload) {
        if (payload == null || payload.username == null) return;
        for (LuckyDrawSession session : activeLuckyDraws.values()) {
            if (session != null && session.player != null && session.player.getName().getString().equalsIgnoreCase(payload.username)) {
                if (payload.success && payload.item != null) {
                    try {
                        Item itemObj = BuiltInRegistries.ITEM.getValue(Identifier.parse(payload.item));
                        if (itemObj != null && itemObj != Items.AIR) {
                            session.winningItem = new ItemStack(itemObj, Math.max(1, payload.amount));
                        }
                    } catch (Throwable ignored) {}
                }
                break;
            }
        }
    }

    // =========================================================
    // 4. 全服排行榜 (Leaderboards GUI)
    // =========================================================
    private static final Map<String, List<WelfareLeaderboardEntry>> welfareLeaderboardCache = new ConcurrentHashMap<>();
    private static final Map<UUID, String> activeLeaderboardTabs = new ConcurrentHashMap<>();

    public static void openLeaderboardsGui(ServerPlayer player, String category) {
        openLeaderboardMenu(player, category);
    }

    public static void openLeaderboardMenu(ServerPlayer player, String cat) {
        if (player == null) return;
        final String category = (cat != null && !cat.isEmpty()) ? cat.toLowerCase() : "wealth";
        activeLeaderboardTabs.put(player.getUUID(), category);

        SimpleContainer container = new SimpleContainer(54);
        clearInnerGrid(container);

        // Row 1 Tabs (Slots 2, 4, 6)
        boolean isWealth = "wealth".equalsIgnoreCase(category);
        boolean isKeys = "keys".equalsIgnoreCase(category);
        boolean isStreaks = "streaks".equalsIgnoreCase(category);

        container.setItem(2, createGuiItem(Items.GOLD_BLOCK, isWealth ? "§e💰 財富 Top 10 §a[目前查看]" : "§f💰 財富 Top 10", List.of(
                "§7點擊查看全服個人財富排行榜",
                "",
                isWealth ? "§a[當前頁面]" : "§e[點擊切換標籤]"
        )));

        container.setItem(4, createGuiItem(Items.TRIPWIRE_HOOK, isKeys ? "§e🔑 鑰匙 Top 10 §a[目前查看]" : "§f🔑 鑰匙 Top 10", List.of(
                "§7點擊查看全服抽獎鑰匙排行榜",
                "",
                isKeys ? "§a[當前頁面]" : "§e[點擊切換標籤]"
        )));

        container.setItem(6, createGuiItem(Items.CLOCK, isStreaks ? "§e📅 連續簽到 Top 10 §a[目前查看]" : "§f📅 連續簽到 Top 10", List.of(
                "§7點擊查看全服連續簽到排行榜",
                "",
                isStreaks ? "§a[當前頁面]" : "§e[點擊切換標籤]"
        )));

        // Slot positions for Top 10 players
        int[] displaySlots = {19, 20, 21, 22, 23, 24, 25, 29, 30, 31};

        if (isWealth) {
            List<Map.Entry<String, EconomyManager.PlayerData>> topWealth = EconomyManager.getTopWealthPlayers(10);
            for (int i = 0; i < topWealth.size() && i < displaySlots.length; i++) {
                Map.Entry<String, EconomyManager.PlayerData> entry = topWealth.get(i);
                String user = entry.getKey();
                double balance = entry.getValue().balance;

                String rankStr;
                if (i == 0) rankStr = "§6🥇 第 1 名";
                else if (i == 1) rankStr = "§7🥈 第 2 名";
                else if (i == 2) rankStr = "§c🥉 第 3 名";
                else rankStr = "§f第 " + (i + 1) + " 名";

                ItemStack head = createPlayerHead(user);
                head.set(DataComponents.CUSTOM_NAME, Component.literal(rankStr + " §e" + user));
                head.set(DataComponents.LORE, new ItemLore(List.of(
                        Component.literal("§7全服財富排行榜"),
                        Component.literal("§7玩家名稱: §f" + user),
                        Component.literal(String.format("§7擁有金額: §a$%.2f 元", balance))
                )));
                container.setItem(displaySlots[i], head);
            }
        } else {
            List<WelfareLeaderboardEntry> cached = welfareLeaderboardCache.get(category);
            if (cached != null && !cached.isEmpty()) {
                for (int i = 0; i < cached.size() && i < displaySlots.length; i++) {
                    WelfareLeaderboardEntry entry = cached.get(i);
                    String user = entry.getUsername();

                    String rankStr;
                    if (i == 0) rankStr = "§6🥇 第 1 名";
                    else if (i == 1) rankStr = "§7🥈 第 2 名";
                    else if (i == 2) rankStr = "§c🥉 第 3 名";
                    else rankStr = "§f第 " + (i + 1) + " 名";

                    ItemStack head = createPlayerHead(user);
                    head.set(DataComponents.CUSTOM_NAME, Component.literal(rankStr + " §e" + user));
                    List<Component> lore = new ArrayList<>();
                    if (isKeys) {
                        lore.add(Component.literal("§7全服抽獎鑰匙排行榜"));
                        lore.add(Component.literal("§7玩家名稱: §f" + user));
                        lore.add(Component.literal("§7抽獎鑰匙: §e" + entry.keys_count + " 把"));
                        lore.add(Component.literal("§7累計簽到: §a" + entry.total_checkins + " 天"));
                    } else {
                        lore.add(Component.literal("§7全服連續簽到排行榜"));
                        lore.add(Component.literal("§7玩家名稱: §f" + user));
                        lore.add(Component.literal("§7連續簽到: §a" + entry.checkin_streak + " 天"));
                        lore.add(Component.literal("§7累計簽到: §f" + entry.total_checkins + " 天"));
                    }
                    head.set(DataComponents.LORE, new ItemLore(lore));
                    container.setItem(displaySlots[i], head);
                }
            } else {
                container.setItem(22, createGuiItem(Items.PAPER, "§e🔄 載入排行榜數據中...", List.of("§7正在自資料庫查詢最新榜單資料...")));

                CraftCoreWSClient ws = CraftCoreMod.getWSClient();
                if (ws != null && ws.isAuthenticated()) {
                    ws.send(new Packet("welfare_leaderboard_query", new WelfareLeaderboardQueryPayload(UUID.randomUUID().toString(), category, 10)));
                }
            }
        }

        // Navigation (Slot 45 返回主選單, Slot 49 關閉選單)
        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) { activeLeaderboardTabs.remove(sp.getUUID()); openMainMenu(sp); return; }
                            if (slotId == 49) { activeLeaderboardTabs.remove(sp.getUUID()); sp.closeContainer(); return; }

                            if (slotId == 2) openLeaderboardMenu(sp, "wealth");
                            else if (slotId == 4) openLeaderboardMenu(sp, "keys");
                            else if (slotId == 6) openLeaderboardMenu(sp, "streaks");
                        }
                    }
                }, Component.literal("§1🏆 全服排行榜 (Leaderboards)")));
    }

    public static void handleWelfareLeaderboardResponse(WelfareLeaderboardResponsePayload payload) {
        if (payload == null || payload.category == null || payload.leaderboard == null) return;
        String cat = payload.category.toLowerCase();
        welfareLeaderboardCache.put(cat, payload.leaderboard);

        MinecraftServer server = ServerLifecycleHandler.serverInstance;
        if (server == null) return;

        for (Map.Entry<UUID, String> entry : activeLeaderboardTabs.entrySet()) {
            if (cat.equalsIgnoreCase(entry.getValue())) {
                UUID uuid = entry.getKey();
                ServerPlayer sp = server.getPlayerList().getPlayer(uuid);
                if (sp != null && sp.containerMenu != null && !(sp.containerMenu instanceof net.minecraft.world.inventory.InventoryMenu)) {
                    openLeaderboardMenu(sp, cat);
                }
            }
        }
    }

    // =========================================================
    // 5. 傳送與家園 GUI (Teleport & Homes)
    // =========================================================
    public static void openTeleportMenu(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();

        SimpleContainer container = new SimpleContainer(54);
        clearInnerGrid(container);

        container.setItem(0, createGuiItem(Items.FEATHER, "§a🎲 隨機傳送 (/rtp)", List.of("§7隨機傳送至野外安全地點", "", "§e[點擊執行 /rtp]")));
        container.setItem(1, createGuiItem(getItem("minecraft:red_bed"), "§c💀 返回死亡點 (/back)", List.of("§7傳送回上次死亡地點", "", "§e[點擊執行 /back]")));

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

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
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
    // 6. 假人控制 GUI (Fake Player Hub)
    // =========================================================
    public static void openFakePlayerMenu(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();

        SimpleContainer container = new SimpleContainer(54);
        clearInnerGrid(container);

        container.setItem(4, createGuiItem(Items.ARMOR_STAND, "§a➕ 召喚新假人 (/bot spawn)", List.of(
                "§7在您當前位置召喚新假人助手",
                "",
                "§e[點擊執行召喚]"
        )));

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
                        "",
                        "§e[點擊開啟假人詳細控制台]"
                )));
            }
        }

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
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
                                    openFakePlayerControlMenu(sp, botName);
                                }
                            }
                        }
                    }
                }, Component.literal("§1🤖 假人控制台選單")));
    }

    public static void openFakePlayerControlMenu(ServerPlayer player, String botName) {
        if (player == null || botName == null) return;
        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        // Slot 20: 🎒 開啟背包/末影箱 (executes /invsee <botName>)
        container.setItem(20, createGuiItem(Items.CHEST, "§a🎒 開啟背包/末影箱 (/invsee)", List.of(
                "§7即時檢視與管理假人 " + botName + " 的背包物資",
                "",
                "§e[點擊開啟背包]"
        )));

        // Slot 22: ⚔ 動作模式 (toggle action mode: Attack Mob / Continuous Click / Mine / Stop)
        container.setItem(22, createGuiItem(Items.DIAMOND_SWORD, "§e⚔ 動作模式", List.of(
                "§7切換假人動作模式：",
                "§7- 點擊左鍵: ⚔ 打怪模式 (attack continuous)",
                "§7- 點擊右鍵: 👆 連續點擊 (use continuous)",
                "§7- 點擊 Q 鍵: ⛏ 挖掘模式 (attack interval 20)",
                "§7- 點擊 Shift+左鍵: 🛑 停止動作 (stop)",
                "",
                "§e[點擊執行動作設定]"
        )));

        // Slot 24: 📍 傳送假人至身邊 (teleports fake player to caller position)
        container.setItem(24, createGuiItem(Items.ENDER_PEARL, "§b📍 傳送假人至身邊", List.of(
                "§7將假人 " + botName + " 即時傳送至您目前所在位置",
                "",
                "§e[點擊即時傳送]"
        )));

        // Slot 26: ❌ 解散假人 (calls FakePlayerManager.dropFakePlayerItems(bot) to drop items cleanly, then executes /player <botName> kill)
        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 解散假人", List.of(
                "§7清空假人背包物品並將其完全解散",
                "",
                "§c[點擊解散假人]"
        )));

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
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

                            if (slotId == 20) {
                                InvSeeManager.openInvSeeGui(sp, botName);
                                return;
                            }
                            if (slotId == 22) {
                                net.minecraft.commands.CommandSourceStack consoleSource = server.createCommandSourceStack();
                                net.minecraft.commands.CommandSourceStack elevatedSource = consoleSource
                                        .withPosition(sp.position())
                                        .withRotation(sp.getRotationVector())
                                        .withLevel((net.minecraft.server.level.ServerLevel) sp.level());
                                if (button == 0 && clickType == ContainerInput.QUICK_MOVE) {
                                    server.getCommands().performPrefixedCommand(elevatedSource, "player " + botName + " stop");
                                    sp.sendSystemMessage(Component.literal("§b[Craft-Core] §a已停止假人 " + botName + " 之所有動作。"));
                                } else if (button == 0) {
                                    server.getCommands().performPrefixedCommand(elevatedSource, "player " + botName + " attack continuous");
                                    sp.sendSystemMessage(Component.literal("§b[Craft-Core] §a已向假人 " + botName + " 發送指令: attack continuous (打怪模式)"));
                                } else if (button == 1) {
                                    server.getCommands().performPrefixedCommand(elevatedSource, "player " + botName + " use continuous");
                                    sp.sendSystemMessage(Component.literal("§b[Craft-Core] §a已向假人 " + botName + " 發送指令: use continuous (連續點擊)"));
                                } else if (clickType == ContainerInput.THROW) {
                                    server.getCommands().performPrefixedCommand(elevatedSource, "player " + botName + " attack interval 20");
                                    sp.sendSystemMessage(Component.literal("§b[Craft-Core] §a已向假人 " + botName + " 發送指令: attack interval 20 (挖掘模式)"));
                                }
                                return;
                            }
                            if (slotId == 24) {
                                net.minecraft.commands.CommandSourceStack consoleSource = server.createCommandSourceStack();
                                net.minecraft.commands.CommandSourceStack elevatedSource = consoleSource
                                        .withPosition(sp.position())
                                        .withRotation(sp.getRotationVector())
                                        .withLevel((net.minecraft.server.level.ServerLevel) sp.level());
                                String cmd = String.format(java.util.Locale.ROOT, "tp %s %s", botName, sp.getName().getString());
                                server.getCommands().performPrefixedCommand(elevatedSource, cmd);
                                sp.sendSystemMessage(Component.literal("§b[Craft-Core] §a已將假人 " + botName + " 傳送至您的位置！"));
                                return;
                            }
                            if (slotId == 26) {
                                ServerPlayer bot = server.getPlayerList().getPlayerByName(botName);
                                if (bot != null) {
                                    FakePlayerManager.dropFakePlayerItems(bot);
                                }
                                server.getCommands().performPrefixedCommand(server.createCommandSourceStack(), "player " + botName + " kill");
                                FakePlayerManager.unregister(botName);
                                sp.sendSystemMessage(Component.literal("§b[Craft-Core] §a假人 " + botName + " 已成功解散，背包物品已掉落。"));
                                sp.closeContainer();
                                return;
                            }
                        }
                    }
                }, Component.literal("§1🤖 假人詳細控制台: " + botName)));
    }

    // =========================================================
    // 7. 任務與懸賞 GUI (Tasks & Bounties)
    // =========================================================
    public static void openTaskBountyMenu(ServerPlayer player) {
        if (player == null) return;
        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        container.setItem(20, createGuiItem(Items.BOOK, "§a⚔ 每日任務 (/tasks)", List.of(
                "§7查看今日擊殺與挖掘任務",
                "",
                "§e[點擊執行 /tasks]"
        )));

        GlobalGoalManager.GoalData goal = GlobalGoalManager.getCurrentGoal();
        double pct = Math.min(100.0, (double) goal.currentCount / goal.targetCount * 100.0);
        String topUser = GlobalGoalManager.getTopContributor();
        int myContrib = goal.contributions.getOrDefault(player.getName().getString().toLowerCase(), 0);

        List<String> goalLore = new ArrayList<>();
        goalLore.add("§7目標: " + goal.title);
        goalLore.add(String.format("§7全服進度: §a%d / %d (%.1f%%)", goal.currentCount, goal.targetCount, pct));
        goalLore.add("§7個人貢獻: §f" + myContrib + " 個進度 " + (myContrib >= GlobalGoalManager.MIN_CONTRIBUTION_THRESHOLD ? "§a[達標 >=50]" : "§c[未達門檻 50]"));
        goalLore.add("§7最高貢獻者: §6" + (topUser == null ? "無" : topUser));
        goalLore.add("");
        if (goal.goalType == GlobalGoalManager.GoalType.SUBMIT_ITEMS) {
            goalLore.add("§b[點擊直接繳交手持物資 (64個)]");
        } else {
            goalLore.add("§a[點擊查看全服目標詳情]");
        }

        container.setItem(22, createGuiItem(Items.GOLDEN_APPLE, "§e🌐 全服每週大目標 (/bounty)", goalLore));

        TreasureChestManager.TreasureLocation active = TreasureChestManager.getActiveTreasure();
        String treasureHint = "目前無活躍寶箱，即將刷新！";
        if (active != null && !active.opened) {
            int minX = (active.x / 300) * 300;
            int minZ = (active.z / 300) * 300;
            treasureHint = String.format("區塊: X: %d ~ %d, Z: %d ~ %d", minX, minX + 300, minZ, minZ + 300);
        }

        container.setItem(24, createGuiItem(Items.FILLED_MAP, "§6🗺 野外藏寶圖線索 (/treasure)", List.of(
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
                            if (slotId == 22) {
                                if (goal.goalType == GlobalGoalManager.GoalType.SUBMIT_ITEMS) {
                                    GlobalGoalManager.submitHandItem(sp, 64);
                                } else {
                                    sp.closeContainer();
                                    server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "bounty");
                                }
                                return;
                            }
                            if (slotId == 24) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "treasure"); return; }
                        }
                    }
                }, Component.literal("§1⚔ 任務與懸賞選單")));
    }

    // =========================================================
    // 8. 頭頂稱號 GUI (Title Menu)
    // =========================================================
    public static void openWelfareTitleMenu(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回福利中心", List.of("§7點擊返回福利中心大廳")));
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
                            if (slotId == 45) { openWelfareCenterMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }

                            ItemStack clickedStack = container.getItem(slotId);
                            if (clickedStack != null && clickedStack.has(DataComponents.CUSTOM_NAME)) {
                                String titleName = clickedStack.get(DataComponents.CUSTOM_NAME).getString();
                                if (!titleName.equals("頭頂稱號狀態") && !titleName.equals("⬅ 返回福利中心")) {
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
        if (player == null) return;
        com.craftcore.shop.ShopGuiManager.openShopList(player);
    }

    public static void openClaimMenu(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();
        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(Permissions.COMMANDS_OWNER);

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        // Auto-detect player standing claim
        ClaimManager.Claim standingClaim = ClaimManager.getClaimAt(player.blockPosition(), player.level());
        if (standingClaim != null && (standingClaim.owner.equalsIgnoreCase(username) || isOp)) {
            container.setItem(4, createGuiItem(Items.BEACON, "§a🛡 當前站立領地: " + (standingClaim.name != null ? standingClaim.name : standingClaim.id), List.of(
                    "§7您正站在此領地範圍內",
                    "§7- 大小: " + standingClaim.chunks + " 區塊",
                    "§7- 擁有者: " + standingClaim.owner,
                    "",
                    "§e[點擊進入詳細領地管理 GUI]"
            )));
        } else if (standingClaim != null) {
            container.setItem(4, createGuiItem(getItem("minecraft:red_stained_glass_pane"), "§c🛡 當前位置: " + standingClaim.owner + " 的領地", List.of(
                    "§7您正站在其他玩家的領地內",
                    "§7無法進行管理者控制"
            )));
        } else {
            container.setItem(4, createGuiItem(Items.MAP, "§7🛡 當前位置: 野外 (無領地)", List.of(
                    "§7手持圈地神杖選取對角點後",
                    "§7輸入 /claim 即可創建並購買劃分領地"
            )));
        }

        container.setItem(20, createGuiItem(Items.WOODEN_HOE, "§6🪄 領地劃分神杖 (/claim tool)", List.of(
                "§7點擊一鍵免費領取領地圈地神杖 (木鋤)",
                "§e- 左鍵點擊方塊: 設置點 1 (Pos1)",
                "§e- 右鍵點擊方塊: 設置點 2 (Pos2)",
                "",
                "§a[點擊直接領取神杖]"
        )));

        container.setItem(24, createGuiItem(Items.EMERALD, "§a💰 購買圈選領地 (/claim)", List.of(
                "§7圈選完成後，點擊創建並購買此領地",
                "",
                "§a[點擊購買領地 (/claim)]"
        )));

        List<ClaimManager.Claim> myClaims = ClaimManager.getPlayerClaims(username);
        int[] claimSlots = { 28, 29, 30, 31, 32, 33, 34 };
        int claimIdx = 0;
        for (ClaimManager.Claim c : myClaims) {
            if (claimIdx >= claimSlots.length) break;
            container.setItem(claimSlots[claimIdx++], createGuiItem(Items.GRASS_BLOCK, "§e🏠 領地: " + (c.name != null ? c.name : c.id), List.of(
                    "§7維度: " + c.dimension,
                    "§7大小: " + c.chunks + " 區塊",
                    "§7防護: PvP[" + (c.pvp ? "§a開啟" : "§c關閉") + "], 防爆[" + (c.explosion_protection ? "§a開啟" : "§c關閉") + "]",
                    "",
                    "§e[點擊開啟詳細管理 GUI]"
            )));
        }

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
                            if (slotId == 24) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "claim"); return; }

                            if (slotId == 4 && standingClaim != null && (standingClaim.owner.equalsIgnoreCase(username) || isOp)) {
                                openClaimDetailGui(sp, standingClaim);
                                return;
                            }

                            ItemStack clickedStack = container.getItem(slotId);
                            if (clickedStack != null && clickedStack.has(DataComponents.CUSTOM_NAME)) {
                                String name = clickedStack.get(DataComponents.CUSTOM_NAME).getString();
                                if (name.startsWith("§e🏠 領地: ")) {
                                    String claimName = name.replace("§e🏠 領地: ", "").trim();
                                    for (ClaimManager.Claim c : myClaims) {
                                        if (claimName.equals(c.name) || claimName.equals(c.id)) {
                                            openClaimDetailGui(sp, c);
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }, Component.literal("§1🛡 領地與保險箱選單")));
    }

    public static void openClaimDetailGui(ServerPlayer player, ClaimManager.Claim claim) {
        if (player == null || claim == null) return;
        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        // Slot 11: 👥 成員權限設定 (Trust / Untrust member management)
        List<String> trusted = claim.permissions != null && claim.permissions.build != null ? claim.permissions.build : List.of();
        String trustedStr = trusted.isEmpty() ? "§7(無)" : "§e" + String.join(", ", trusted);
        container.setItem(11, createGuiItem(Items.PLAYER_HEAD, "§a👥 成員權限設定", List.of(
                "§7目前信任成員: " + trustedStr,
                "",
                "§e[點擊開啟信任成員管理 GUI]"
        )));

        // Slot 13: 🚩 安全旗幟開關 (PvP toggle, Mob Spawn toggle, Explosion Protection toggle)
        container.setItem(13, createGuiItem(Items.REDSTONE_TORCH, "§6🚩 安全旗幟開關", List.of(
                "§7- 玩家 PvP: " + (claim.pvp ? "§a[開啟 - 允許 PvP]" : "§c[關閉 - 禁止 PvP]"),
                "§7- 生物生成: " + (claim.mob_spawn ? "§a[開啟 - 允許怪物生成]" : "§c[關閉 - 禁止怪物生成]"),
                "§7- 爆炸保護: " + (claim.explosion_protection ? "§a[開啟 - 100% 防爆]" : "§c[關閉 - 允許爆炸]"),
                "",
                "§e- 點擊左鍵: 切換 PvP 模式",
                "§e- 點擊右鍵: 切換 生物生成 模式",
                "§e- 點擊 Q 鍵: 切換 爆炸保護 模式"
        )));

        // Slot 15: 🔓 公共容器存取控制 (toggle public_containers)
        container.setItem(15, createGuiItem(Items.CHEST, "§b🔓 公共容器存取控制", List.of(
                "§7當前狀態: " + (claim.public_containers ? "§a[開啟 - 所有人均可開啟]" : "§c[關閉 - 僅限成員/擁有者]"),
                "",
                "§e[點擊切換公開容器存取權限]"
        )));

        // Slot 17: 🗑 刪除/放棄領地 (calls ClaimManager.removeClaim(claim.getId()))
        container.setItem(17, createGuiItem(Items.TNT, "§c🗑 刪除/放棄領地", List.of(
                "§7警告: 刪除此領地將解除該區域的所有保護",
                "",
                "§c[點擊確認刪除並放棄該領地]"
        )));

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) { openMainMenu(sp); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }

                            if (slotId == 11) {
                                openClaimMembersGui(sp, claim);
                                return;
                            }
                            if (slotId == 13) {
                                if (button == 0 && clickType != ContainerInput.THROW) {
                                    claim.pvp = !claim.pvp;
                                    sp.sendSystemMessage(Component.literal("§a[領地] 已將 PvP 旗幟切換為: " + (claim.pvp ? "§e[開啟 - 允許 PvP]" : "§c[關閉 - 禁止 PvP]")));
                                } else if (button == 1 && clickType != ContainerInput.THROW) {
                                    claim.mob_spawn = !claim.mob_spawn;
                                    sp.sendSystemMessage(Component.literal("§a[領地] 已將生物生成旗幟切換為: " + (claim.mob_spawn ? "§e[開啟 - 允許怪物生成]" : "§c[關閉 - 禁止怪物生成]")));
                                } else if (clickType == ContainerInput.THROW) {
                                    claim.explosion_protection = !claim.explosion_protection;
                                    sp.sendSystemMessage(Component.literal("§a[領地] 已將爆炸保護旗幟切換為: " + (claim.explosion_protection ? "§e[開啟 - 100% 防爆]" : "§c[關閉 - 允許爆炸]")));
                                }
                                ClaimManager.save();
                                openClaimDetailGui(sp, claim);
                                return;
                            }
                            if (slotId == 15) {
                                claim.public_containers = !claim.public_containers;
                                ClaimManager.save();
                                sp.sendSystemMessage(Component.literal("§a[領地] 已將公共容器存取切換為: " + (claim.public_containers ? "§e[開啟 - 所有人可開啟]" : "§c[關閉 - 僅限成員]")));
                                openClaimDetailGui(sp, claim);
                                return;
                            }
                            if (slotId == 17) {
                                ClaimManager.removeClaim(claim.getId());
                                sp.sendSystemMessage(Component.literal("§a[領地] 已成功刪除與放棄領地 " + (claim.name != null ? claim.name : claim.id) + "！"));
                                openClaimMenu(sp);
                                return;
                            }
                        }
                    }
                }, Component.literal("§1🛡 領地詳細管理: " + (claim.name != null ? claim.name : claim.id))));
    }

    public static void openClaimMembersGui(ServerPlayer player, ClaimManager.Claim claim) {
        if (player == null || claim == null) return;
        SimpleContainer container = new SimpleContainer(54);
        clearInnerGrid(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回領地管理", List.of("§7點擊返回領地詳細管理 GUI")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        MinecraftServer server = player.level().getServer();
        if (server != null) {
            List<ServerPlayer> players = server.getPlayerList().getPlayers();
            int[] memberSlots = {
                    10, 11, 12, 13, 14, 15, 16,
                    19, 20, 21, 22, 23, 24, 25,
                    28, 29, 30, 31, 32, 33, 34
            };
            int idx = 0;
            for (ServerPlayer target : players) {
                if (idx >= memberSlots.length) break;
                String targetName = target.getName().getString();
                if (targetName.equalsIgnoreCase(claim.owner)) continue;

                boolean isTrusted = claim.permissions != null && claim.permissions.build != null && claim.permissions.build.contains(targetName);
                if (isTrusted) {
                    container.setItem(memberSlots[idx++], createGuiItem(Items.PLAYER_HEAD, "§a✔ 信任成員: " + targetName, List.of(
                            "§7狀態: §a已信任 (擁有建置與存取權限)",
                            "",
                            "§c[點擊取消信任 (Untrust)]"
                    )));
                } else {
                    container.setItem(memberSlots[idx++], createGuiItem(Items.PLAYER_HEAD, "§7👤 在線玩家: " + targetName, List.of(
                            "§7狀態: §c未信任",
                            "",
                            "§a[點擊新增信任 (Trust)]"
                    )));
                }
            }
        }

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) { openClaimDetailGui(sp, claim); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }

                            ItemStack clickedStack = container.getItem(slotId);
                            if (clickedStack != null && clickedStack.has(DataComponents.CUSTOM_NAME)) {
                                String name = clickedStack.get(DataComponents.CUSTOM_NAME).getString();
                                String targetName = null;
                                if (name.startsWith("§a✔ 信任成員: ")) {
                                    targetName = name.replace("§a✔ 信任成員: ", "").trim();
                                    if (claim.permissions != null) {
                                        if (claim.permissions.build != null) claim.permissions.build.remove(targetName);
                                        if (claim.permissions.breakBlocks != null) claim.permissions.breakBlocks.remove(targetName);
                                        if (claim.permissions.containers != null) claim.permissions.containers.remove(targetName);
                                        if (claim.permissions.interact != null) claim.permissions.interact.remove(targetName);
                                    }
                                    ClaimManager.save();
                                    sp.sendSystemMessage(Component.literal("§a[領地] 已移除玩家 §e" + targetName + " §a的信任權限！"));
                                    openClaimMembersGui(sp, claim);
                                } else if (name.startsWith("§7👤 在線玩家: ")) {
                                    targetName = name.replace("§7👤 在線玩家: ", "").trim();
                                    if (claim.permissions == null) claim.permissions = new ClaimManager.Claim.Permissions();
                                    if (claim.permissions.build == null) claim.permissions.build = new ArrayList<>();
                                    if (claim.permissions.breakBlocks == null) claim.permissions.breakBlocks = new ArrayList<>();
                                    if (claim.permissions.containers == null) claim.permissions.containers = new ArrayList<>();
                                    if (claim.permissions.interact == null) claim.permissions.interact = new ArrayList<>();

                                    if (!claim.permissions.build.contains(targetName)) claim.permissions.build.add(targetName);
                                    if (!claim.permissions.breakBlocks.contains(targetName)) claim.permissions.breakBlocks.add(targetName);
                                    if (!claim.permissions.containers.contains(targetName)) claim.permissions.containers.add(targetName);
                                    if (!claim.permissions.interact.contains(targetName)) claim.permissions.interact.add(targetName);

                                    ClaimManager.save();
                                    sp.sendSystemMessage(Component.literal("§a[領地] 已將玩家 §e" + targetName + " §a加入信任成員名單！"));
                                    openClaimMembersGui(sp, claim);
                                }
                            }
                        }
                    }
                }, Component.literal("§1👥 領地成員管理: " + (claim.name != null ? claim.name : claim.id))));
    }

    public static void openMachineMenu(ServerPlayer player) {
        if (player == null) return;
        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
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

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
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
                }, Component.literal("§1🛠 管理員 (OP) 控制台")));
    }

    public static void openPlayerSelectorMenu(ServerPlayer adminPlayer) {
        if (adminPlayer == null || adminPlayer.level().getServer() == null) return;
        MinecraftServer server = adminPlayer.level().getServer();
        List<ServerPlayer> players = new ArrayList<>(server.getPlayerList().getPlayers());

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回管理員選單", List.of("§7點擊返回 OP 控制台")));
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
