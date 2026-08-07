package com.craftcore.fish;

import com.craftcore.data.JsonDataStore;
import com.craftcore.title.TitleManager;
import com.google.gson.reflect.TypeToken;
import net.minecraft.core.component.DataComponents;
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
import net.minecraft.world.item.component.ItemLore;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class FishCodexManager {

    public static class FishSpeciesInfo {
        public String name;
        public String itemId;
        public String description;

        public FishSpeciesInfo(String name, String itemId, String description) {
            this.name = name;
            this.itemId = itemId;
            this.description = description;
        }
    }

    public static final List<FishSpeciesInfo> ALL_SPECIES = List.of(
            new FishSpeciesInfo("遠古巨齒鯊幼崽", "minecraft:tropical_fish", "來自深海的掠食者幼體"),
            new FishSpeciesInfo("深淵紫焰海龍", "minecraft:pufferfish", "燃燒著深淵紫焰的稀有海龍"),
            new FishSpeciesInfo("炫彩幻光水母", "minecraft:salmon", "發出五彩斑斕螢光的水母"),
            new FishSpeciesInfo("黃金璀璨大旗魚", "minecraft:cod", "全身覆蓋璀璨金鱗的大型旗魚"),
            new FishSpeciesInfo("翡翠毒刺河豚", "minecraft:pufferfish", "帶有劇毒翡翠毒刺的河豚"),
            new FishSpeciesInfo("烈焰熔岩翻車魚", "minecraft:cooked_salmon", "適應高熱岩塑環境的奇特魚類"),
            new FishSpeciesInfo("雷霆電擊大鯰魚", "minecraft:cooked_cod", "能釋放強烈高壓電擊的巨型鯰魚"),
            new FishSpeciesInfo("冰霜晶鑽珍珠魚", "minecraft:tropical_fish", "晶瑩剔透如珍珠般美麗的魚類"),
            new FishSpeciesInfo("幽靈鬼魅赤魟", "minecraft:salmon", "身形飄忽如幽靈一般的罕見赤魟"),
            new FishSpeciesInfo("泰坦霸王海怪幼體", "minecraft:cod", "體型無比龐大的傳說級海怪幼體"),
            new FishSpeciesInfo("翡翠珍珠龍吐珠", "minecraft:tropical_fish", "口含翡翠珍珠的高貴觀賞魚"),
            new FishSpeciesInfo("暗黑吞噬大王烏賊", "minecraft:pufferfish", "潛伏於漆黑海底的大型軟體怪物"),
            new FishSpeciesInfo("星空幻影蝶魚", "minecraft:tropical_fish", "優雅宛如星空蝴蝶飄舞的魚類"),
            new FishSpeciesInfo("王者金鱗大錦鯉", "minecraft:cod", "象徵極致幸運與財富的王者錦鯉"),
            new FishSpeciesInfo("寒冰藍霜大馬哈魚", "minecraft:salmon", "生活於極寒冰海中的健壯馬哈魚"),
            new FishSpeciesInfo("紫晶幻夢海馬", "minecraft:tropical_fish", "散發夢幻紫晶光澤的珍稀海馬"),
            new FishSpeciesInfo("熔岩巨甲龜幼崽", "minecraft:pufferfish", "披戴高溫巨甲的神秘幼龜"),
            new FishSpeciesInfo("鑽石光華飛魚", "minecraft:tropical_fish", "展翅飛躍海面發出鑽石光芒的飛魚"),
            new FishSpeciesInfo("狂暴赤紅霸王鮭", "minecraft:salmon", "生性極其兇猛的巨型赤紅鮭魚"),
            new FishSpeciesInfo("虛空黑洞旗魚", "minecraft:nether_star", "誕生於虛空核心的神話級頂級巨魚")
    );

    private static final String DATA_FILE = "fish.json";
    private static Map<String, Map<String, Double>> playerCodexMap = new ConcurrentHashMap<>();

    static {
        loadData();
    }

    public static synchronized void loadData() {
        Map<String, Map<String, Double>> loaded = JsonDataStore.loadData(DATA_FILE, new TypeToken<Map<String, Map<String, Double>>>(){}.getType(), new ConcurrentHashMap<>());
        if (loaded != null) {
            playerCodexMap = new ConcurrentHashMap<>(loaded);
        }
    }

    public static synchronized void saveData() {
        JsonDataStore.saveDataAsync(DATA_FILE, playerCodexMap);
    }

    public static void onCatchFish(ServerPlayer player, String fishName, double lengthCm) {
        if (player == null || fishName == null) return;
        String uuidStr = player.getUUID().toString();
        String username = player.getName().getString();

        Map<String, Double> codex = playerCodexMap.computeIfAbsent(uuidStr, k -> new ConcurrentHashMap<>());
        double prev = codex.getOrDefault(fishName, 0.0);
        boolean newlyUnlocked = (prev == 0.0);

        if (lengthCm > prev) {
            codex.put(fishName, lengthCm);
            saveData();
        }

        if (newlyUnlocked) {
            player.sendSystemMessage(Component.literal("§6📖 [魚類圖鑑] 恭喜解鎖全新圖鑑條目：【" + fishName + "】！(" + codex.size() + "/20)"));

            if (codex.size() >= 20) {
                TitleManager.unlockTitle(username, "§b[海王]");
                String broadcast = String.format("§a🎉 [全服通告] 恭喜玩家 §e%s §a成功解鎖全 20 種奇幻魚類圖鑑！達成 100%% 滿貫成就，榮獲尊爵稱號 §b[海王]§a！", username);
                if (player.level().getServer() != null) {
                    player.level().getServer().getPlayerList().broadcastSystemMessage(Component.literal(broadcast), false);
                }
            }
        }
    }

    public static int getUnlockedCount(UUID uuid) {
        if (uuid == null) return 0;
        Map<String, Double> map = playerCodexMap.get(uuid.toString());
        return map != null ? map.size() : 0;
    }

    private static abstract class ReadOnlyCodexMenuHandler extends ChestMenu {
        public ReadOnlyCodexMenuHandler(MenuType<ChestMenu> type, int syncId, net.minecraft.world.entity.player.Inventory playerInventory, SimpleContainer container, int rows) {
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

    public static void openCodexGui(ServerPlayer player) {
        if (player == null) return;
        String uuidStr = player.getUUID().toString();
        Map<String, Double> codex = playerCodexMap.getOrDefault(uuidStr, Collections.emptyMap());

        SimpleContainer container = new SimpleContainer(27);
        ItemStack glass = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < 27; i++) {
            container.setItem(i, glass);
        }

        int unlockedCount = codex.size();

        for (int i = 0; i < ALL_SPECIES.size(); i++) {
            FishSpeciesInfo spec = ALL_SPECIES.get(i);
            boolean unlocked = codex.containsKey(spec.name);
            double maxLen = codex.getOrDefault(spec.name, 0.0);

            if (unlocked) {
                container.setItem(i, createGuiItem(getItem(spec.itemId), "§6★ " + spec.name + " §a[已解鎖]", List.of(
                        "§7說明: §f" + spec.description,
                        String.format("§7個人最大釣獲長度: §e%.1f cm", maxLen),
                        "",
                        "§a[已於圖鑑中收藏]"
                )));
            } else {
                container.setItem(i, createGuiItem(Items.STRUCTURE_VOID, "§8??? " + spec.name + " §c[未解鎖]", List.of(
                        "§7說明: §8" + spec.description,
                        "§7狀態: §c未釣獲過此魚種",
                        "",
                        "§e[前往 craftcore:fishing 釣魚維度即可解鎖]"
                )));
            }
        }

        Item progressIcon = (unlockedCount >= 20) ? Items.NETHER_STAR : Items.BOOK;
        container.setItem(22, createGuiItem(progressIcon, "§b📖 魚類圖鑑總進度: §e" + unlockedCount + " / 20", List.of(
                "§7解鎖全 20 種魚類圖鑑即可自動獲得",
                "§7全服尊爵稱號：§b[海王]",
                "",
                unlockedCount >= 20 ? "§a🎉 [已解鎖 100% 滿貫！稱號 [海王] 已發放]" : "§e[努力收集更多魚種吧！]"
        )));

        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉介面")));

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
                new ReadOnlyCodexMenuHandler(MenuType.GENERIC_9x3, syncId, inv, container, 3) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 26) { sp.closeContainer(); return; }
                        }
                    }
                }, Component.literal("§8❖ 📖 奇幻魚類圖鑑冊 (/fish codex) ❖")));
    }

    private static Item getItem(String idStr) {
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
