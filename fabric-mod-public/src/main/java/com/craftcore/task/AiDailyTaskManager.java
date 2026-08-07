package com.craftcore.task;

import com.craftcore.economy.EconomyManager;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerBossEvent;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.BossEvent;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.component.ItemLore;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class AiDailyTaskManager {

    private static final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public static class AiTask {
        public String id;
        public String title;
        public String description;
        public String type; // MINE, KILL, CRAFT, FISH, PLACE, EARN
        public String target;
        public int amount;
        public double reward_money;
        public int reward_keys;
        public String icon;

        public AiTask(String id, String title, String description, String type, String target, int amount, double reward_money, int reward_keys, String icon) {
            this.id = id;
            this.title = title;
            this.description = description;
            this.type = type;
            this.target = target;
            this.amount = amount;
            this.reward_money = reward_money;
            this.reward_keys = reward_keys;
            this.icon = icon;
        }
    }

    private static final List<AiTask> cachedDailyTasks = new ArrayList<>();
    private static final Map<UUID, PlayerTaskData> playerTaskMap = new ConcurrentHashMap<>();

    public static class PlayerTaskData {
        public String activeTaskId = null;
        public int activeProgress = 0;
        public Set<String> completedTaskIds = new HashSet<>();
        public ServerBossEvent bossBar = null;
    }

    public static void setDailyTasks(List<AiTask> tasks) {
        cachedDailyTasks.clear();
        if (tasks != null) {
            cachedDailyTasks.addAll(tasks);
        }
    }

    public static List<AiTask> getDailyTasks() {
        if (cachedDailyTasks.isEmpty()) {
            loadLocalTasks();
        }
        return cachedDailyTasks;
    }

    public static void loadLocalTasks() {
        try {
            java.nio.file.Path path = com.craftcore.util.FabricPathUtil.getShopConfigDir().resolve("tasks.json");
            if (!java.nio.file.Files.exists(path)) {
                path = java.nio.file.Path.of("config", "craft-core", "data", "tasks.json");
            }
            if (java.nio.file.Files.exists(path)) {
                String json = java.nio.file.Files.readString(path);
                java.lang.reflect.Type listType = new com.google.gson.reflect.TypeToken<List<AiTask>>(){}.getType();
                List<AiTask> loaded = new com.google.gson.Gson().fromJson(json, listType);
                if (loaded != null && !loaded.isEmpty()) {
                    setDailyTasks(loaded);
                    return;
                }
            }
        } catch (Throwable ignored) {}
        initDefaultFallbackTasks();
    }

    private static void initDefaultFallbackTasks() {
        cachedDailyTasks.add(new AiTask("q1", "採集深層鐵礦", "深入洞穴採集 32 個鐵礦石！", "MINE", "minecraft:iron_ore", 32, 300, 1, "minecraft:iron_ore"));
        cachedDailyTasks.add(new AiTask("q2", "清理殭屍大軍", "擊殺 15 隻殭屍，維持夜間安寧！", "KILL", "minecraft:zombie", 15, 400, 1, "minecraft:rotten_flesh"));
        cachedDailyTasks.add(new AiTask("q3", "烘焙新鮮麵包", "合成 16 個香噴噴的麵包！", "CRAFT", "minecraft:bread", 16, 250, 1, "minecraft:bread"));
        cachedDailyTasks.add(new AiTask("q4", "垂釣水邊好日", "成功釣起 10 條生魚！", "FISH", "minecraft:cod", 10, 350, 1, "minecraft:fishing_rod"));
        cachedDailyTasks.add(new AiTask("q5", "累積獲得金幣", "累積賺取 $500 金幣！", "EARN", "craftcore:money", 500, 500, 2, "minecraft:gold_ingot"));
    }

    public static PlayerTaskData getPlayerData(UUID uuid) {
        return playerTaskMap.computeIfAbsent(uuid, k -> new PlayerTaskData());
    }

    public static void requestTasks() {
        loadLocalTasks();
    }

    // =========================================================
    // BossBar Tracking & Progress
    // =========================================================
    public static void acceptTask(ServerPlayer player, AiTask task) {
        if (player == null || task == null) return;
        PlayerTaskData data = getPlayerData(player.getUUID());

        if (data.completedTaskIds.contains(task.id)) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 此任務本日已完成！"));
            return;
        }

        if (data.activeTaskId != null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您目前已有進行中的任務！請先完成當前任務後再接下一個。"));
            return;
        }

        data.activeTaskId = task.id;
        data.activeProgress = 0;

        // Setup BossBar
        if (data.bossBar != null) {
            data.bossBar.removeAllPlayers();
        }

        String bossTitle = String.format("§b[每日任務] §f%s §e(0/%d) §a0%%", task.title, task.amount);
        data.bossBar = new ServerBossEvent(
                UUID.randomUUID(),
                Component.literal(bossTitle),
                BossEvent.BossBarColor.BLUE,
                BossEvent.BossBarOverlay.PROGRESS
        );
        data.bossBar.setProgress(0.0f);
        data.bossBar.addPlayer(player);

        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.UI_BUTTON_CLICK, SoundSource.PLAYERS, 1.0f, 1.2f);
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功接下每日任務：§e" + task.title + "§a！進度已同步於畫面上方 BossBar！"));
    }

    public static void updateProgress(ServerPlayer player, String type, String target, int increment) {
        if (player == null) return;
        PlayerTaskData data = getPlayerData(player.getUUID());
        if (data.activeTaskId == null) return;

        AiTask activeTask = null;
        for (AiTask t : getDailyTasks()) {
            if (t.id.equals(data.activeTaskId)) {
                activeTask = t;
                break;
            }
        }
        if (activeTask == null) return;

        if (!activeTask.type.equalsIgnoreCase(type)) return;

        boolean matchesTarget = false;
        if (activeTask.target.equalsIgnoreCase(target) || activeTask.target.endsWith(":" + target) || target.endsWith(":" + activeTask.target)) {
            matchesTarget = true;
        } else if (type.equalsIgnoreCase("MINE") && activeTask.target.contains("ore") && target.contains("ore")) {
            matchesTarget = true;
        } else if (type.equalsIgnoreCase("KILL") && activeTask.target.toLowerCase().contains(target.toLowerCase())) {
            matchesTarget = true;
        } else if (type.equalsIgnoreCase("EARN")) {
            matchesTarget = true;
        } else if (type.equalsIgnoreCase("FISH")) {
            matchesTarget = true;
        }

        if (!matchesTarget) return;

        data.activeProgress = Math.min(activeTask.amount, data.activeProgress + increment);
        int pct = (int) (((double) data.activeProgress / activeTask.amount) * 100);

        if (data.bossBar != null) {
            String bossTitle = String.format("§b[每日任務] §f%s §e(%d/%d) §a%d%%", activeTask.title, data.activeProgress, activeTask.amount, pct);
            data.bossBar.setName(Component.literal(bossTitle));
            data.bossBar.setProgress((float) data.activeProgress / activeTask.amount);
        }

        // Check Completion
        if (data.activeProgress >= activeTask.amount) {
            completeTask(player, activeTask, data);
        }
    }

    private static void completeTask(ServerPlayer player, AiTask task, PlayerTaskData data) {
        data.completedTaskIds.add(task.id);
        data.activeTaskId = null;

        // Reward Money & Keys
        String username = player.getName().getString();
        EconomyManager.addMoney(username, task.reward_money);

        int currentKeys = EconomyManager.getLotteryKeys(username);
        EconomyManager.setLotteryKeys(username, currentKeys + task.reward_keys);

        if (data.bossBar != null) {
            data.bossBar.setColor(BossEvent.BossBarColor.YELLOW);
            data.bossBar.setName(Component.literal(String.format("§a🎉 任務完成！獲得 $%d 金幣 & %d 把鑰匙！", (int) task.reward_money, task.reward_keys)));
            data.bossBar.setProgress(1.0f);

            scheduler.schedule(() -> {
                if (player != null && data.bossBar != null) {
                    try {
                        data.bossBar.removeAllPlayers();
                        data.bossBar = null;
                    } catch (Throwable ignored) {}
                }
            }, 3, TimeUnit.SECONDS);
        }

        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0f, 1.0f);
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a🎉 恭喜完成每日任務【" + task.title + "】！獲贈 $" + (int) task.reward_money + " 金幣與 " + task.reward_keys + " 把幸運鑰匙！"));
    }

    private static abstract class ReadOnlyTaskMenuHandler extends ChestMenu {
        public ReadOnlyTaskMenuHandler(MenuType<ChestMenu> type, int syncId, net.minecraft.world.entity.player.Inventory playerInventory, SimpleContainer container, int rows) {
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

    // =========================================================
    // Chest GUI Navigation & Interaction
    // =========================================================
    public static void openTaskGui(ServerPlayer player) {
        if (player == null) return;
        List<AiTask> tasks = getDailyTasks();
        PlayerTaskData data = getPlayerData(player.getUUID());

        SimpleContainer container = new SimpleContainer(27);
        ItemStack glass = createGuiItem(getItemFromIdentifier("minecraft:gray_stained_glass_pane"), " ", List.of());
        for (int i = 0; i < 27; i++) {
            container.setItem(i, glass);
        }

        int[] taskSlots = {11, 12, 13, 14, 15};
        for (int i = 0; i < Math.min(5, tasks.size()); i++) {
            AiTask t = tasks.get(i);
            boolean isCompleted = data.completedTaskIds.contains(t.id);
            boolean isCurrentActive = t.id.equals(data.activeTaskId);

            String statusTag = isCompleted ? "§a✔ [已完成]" : (isCurrentActive ? "§e⏳ [進行中 - BossBar 追蹤中]" : "§7[點擊查看與接取]");
            Item iconItem = getItemFromIdentifier(t.icon);

            List<String> lore = new ArrayList<>();
            lore.add("§7" + t.description);
            lore.add("");
            lore.add("§f● 任務目標: §e" + getTranslatedTypeName(t.type) + " " + t.amount);
            lore.add("§f● 獎勵金幣: §a$" + (int) t.reward_money + " 元");
            lore.add("§f● 獎勵鑰匙: §e" + t.reward_keys + " 把");
            lore.add("");
            lore.add(statusTag);

            ItemStack stack = createGuiItem(iconItem, "§b" + t.title, lore);
            if (isCompleted) {
                stack.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, false);
            } else if (isCurrentActive) {
                stack.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
            }

            container.setItem(taskSlots[i], stack);
        }

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
            new ReadOnlyTaskMenuHandler(MenuType.GENERIC_9x3, syncId, inv, container, 3) {
                @Override
                public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                    if (clicker instanceof ServerPlayer sp) {
                        for (int i = 0; i < 5; i++) {
                            if (taskSlots[i] == slotId && i < tasks.size()) {
                                AiTask selectedTask = tasks.get(i);
                                openConfirmGui(sp, selectedTask);
                                break;
                            }
                        }
                    }
                }
            }, Component.literal("§8❖ 每日 AI 任務中心 ❖")));
    }

    public static void openConfirmGui(ServerPlayer player, AiTask task) {
        if (player == null || task == null) return;

        SimpleContainer container = new SimpleContainer(27);
        ItemStack glass = createGuiItem(getItemFromIdentifier("minecraft:gray_stained_glass_pane"), " ", List.of());
        for (int i = 0; i < 27; i++) {
            container.setItem(i, glass);
        }

        // Task detail slot 13
        Item iconItem = getItemFromIdentifier(task.icon);
        ItemStack taskItem = createGuiItem(iconItem, "§b" + task.title, List.of(
                "§7" + task.description,
                "",
                "§f● 獎勵金幣: §a$" + (int) task.reward_money + " 元",
                "§f● 獎勵鑰匙: §e" + task.reward_keys + " 把"
        ));
        container.setItem(13, taskItem);

        // Accept button slot 20
        ItemStack confirmWool = createGuiItem(getItemFromIdentifier("minecraft:lime_wool"), "§a✔ [點擊確認接下任務]", List.of("§7點擊後畫面上方將顯示 BossBar 追蹤進度！"));
        container.setItem(20, confirmWool);

        // Cancel button slot 24
        ItemStack cancelWool = createGuiItem(getItemFromIdentifier("minecraft:red_wool"), "§c✖ [返回任務清單]", List.of("§7點擊返回主選單"));
        container.setItem(24, cancelWool);

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
            new ReadOnlyTaskMenuHandler(MenuType.GENERIC_9x3, syncId, inv, container, 3) {
                @Override
                public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                    if (clicker instanceof ServerPlayer sp) {
                        if (slotId == 20) {
                            acceptTask(sp, task);
                            sp.closeContainer();
                        } else if (slotId == 24) {
                            openTaskGui(sp);
                        }
                    }
                }
            }, Component.literal("§8❖ 確認接取任務 ❖")));
    }

    private static Item getItemFromIdentifier(String idStr) {
        if (idStr == null || idStr.isEmpty()) return Items.BOOK;
        try {
            return BuiltInRegistries.ITEM.getValue(Identifier.parse(idStr));
        } catch (Throwable t) {
            return Items.BOOK;
        }
    }

    private static String getTranslatedTypeName(String type) {
        return switch (type.toUpperCase()) {
            case "MINE" -> "挖掘方塊";
            case "KILL" -> "擊殺生物";
            case "CRAFT" -> "合成物品";
            case "FISH" -> "水邊垂釣";
            case "PLACE" -> "擺放方塊";
            case "EARN" -> "累積賺取";
            default -> "目標數量";
        };
    }

    private static ItemStack createGuiItem(Item item, String name, List<String> loreLines) {
        ItemStack stack = new ItemStack(item);
        stack.set(DataComponents.CUSTOM_NAME, Component.literal(name));
        if (loreLines != null && !loreLines.isEmpty()) {
            List<Component> comps = loreLines.stream().map(Component::literal).map(c -> (Component) c).toList();
            stack.set(DataComponents.LORE, new ItemLore(comps));
        }
        return stack;
    }
}
