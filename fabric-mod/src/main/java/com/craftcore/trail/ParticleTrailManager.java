package com.craftcore.trail;

import com.craftcore.title.TitleManager;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerLevel;
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

public class ParticleTrailManager {

    public static class PlayerTrailConfig {
        public boolean footstepEnabled = true;
        public boolean auraEnabled = true;
        public boolean attackEnabled = true;
        public boolean placeEnabled = true;
    }

    private static final Map<UUID, PlayerTrailConfig> playerConfigs = new ConcurrentHashMap<>();
    private static int tickCounter = 0;

    public static PlayerTrailConfig getConfig(UUID uuid) {
        return playerConfigs.computeIfAbsent(uuid, k -> new PlayerTrailConfig());
    }

    public static void registerTickLoop() {
        net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents.END_SERVER_TICK.register(server -> {
            tickCounter++;
            if (tickCounter % 3 != 0) return; // 0.15s throttle

            for (ServerPlayer player : server.getPlayerList().getPlayers()) {
                if (player == null || !player.isAlive()) continue;

                String activeTitle = TitleManager.getActiveTitle(player.getName().getString());
                if (activeTitle == null || activeTitle.isEmpty()) continue;

                ParticleOptions particle = getParticleForTitle(activeTitle);
                if (particle == null) continue;

                PlayerTrailConfig cfg = getConfig(player.getUUID());
                ServerLevel level = (ServerLevel) player.level();

                // 1. Footstep Trail (When moving - Richer dual-layer burst)
                if (cfg.footstepEnabled) {
                    double speedSq = player.getDeltaMovement().lengthSqr();
                    if (speedSq > 0.001) {
                        level.sendParticles(particle, player.getX(), player.getY() + 0.1, player.getZ(), 6, 0.35, 0.08, 0.35, 0.03);
                        // Secondary sparkle accent
                        level.sendParticles(ParticleTypes.END_ROD, player.getX(), player.getY() + 0.15, player.getZ(), 2, 0.2, 0.05, 0.2, 0.02);
                    }
                }

                // 2. Aura Effect (Dual-helix floating spiral)
                if (cfg.auraEnabled) {
                    double angle1 = (tickCounter % 30) * (Math.PI / 15);
                    double angle2 = angle1 + Math.PI;
                    double radius = 0.75;
                    double height = 0.2 + ((tickCounter % 30) / 30.0) * 1.6; // Vertical oscillation

                    double x1 = player.getX() + radius * Math.cos(angle1);
                    double z1 = player.getZ() + radius * Math.sin(angle1);
                    level.sendParticles(particle, x1, player.getY() + height, z1, 2, 0.04, 0.04, 0.04, 0.01);

                    double x2 = player.getX() + radius * Math.cos(angle2);
                    double z2 = player.getZ() + radius * Math.sin(angle2);
                    level.sendParticles(particle, x2, player.getY() + (1.8 - height + 0.2), z2, 2, 0.04, 0.04, 0.04, 0.01);
                }
            }
        });
    }

    public static void onPlayerAttack(ServerPlayer player, double targetX, double targetY, double targetZ) {
        if (player == null || player.level().isClientSide()) return;
        PlayerTrailConfig cfg = getConfig(player.getUUID());
        if (!cfg.attackEnabled) return;

        String activeTitle = TitleManager.getActiveTitle(player.getName().getString());
        if (activeTitle == null || activeTitle.isEmpty()) return;

        ParticleOptions particle = getParticleForTitle(activeTitle);
        if (particle == null) return;

        ServerLevel level = (ServerLevel) player.level();
        level.sendParticles(particle, targetX, targetY + 1.0, targetZ, 20, 0.5, 0.5, 0.5, 0.25);
        level.sendParticles(ParticleTypes.CRIT, targetX, targetY + 1.0, targetZ, 10, 0.3, 0.3, 0.3, 0.3);
    }

    public static void onBlockPlace(ServerPlayer player, double blockX, double blockY, double blockZ) {
        if (player == null || player.level().isClientSide()) return;
        PlayerTrailConfig cfg = getConfig(player.getUUID());
        if (!cfg.placeEnabled) return;

        String activeTitle = TitleManager.getActiveTitle(player.getName().getString());
        if (activeTitle == null || activeTitle.isEmpty()) return;

        ParticleOptions particle = getParticleForTitle(activeTitle);
        if (particle == null) return;

        ServerLevel level = (ServerLevel) player.level();
        level.sendParticles(particle, blockX + 0.5, blockY + 0.5, blockZ + 0.5, 16, 0.4, 0.4, 0.4, 0.15);
        level.sendParticles(ParticleTypes.GLOW, blockX + 0.5, blockY + 0.5, blockZ + 0.5, 8, 0.3, 0.3, 0.3, 0.05);
    }

    public static ParticleOptions getParticleForTitle(String title) {
        if (title == null) return null;
        if (title.contains("老玩家")) return ParticleTypes.WAX_ON;
        if (title.contains("百萬富翁")) return ParticleTypes.HAPPY_VILLAGER;
        if (title.contains("重鎚大師")) return ParticleTypes.WITCH;
        if (title.contains("挖掘機")) return ParticleTypes.SOUL_FIRE_FLAME;
        if (title.contains("蜘蛛人")) return ParticleTypes.CHERRY_LEAVES;
        if (title.contains("一隻鳥")) return ParticleTypes.FLAME;
        if (title.contains("黑貓宅急便")) return ParticleTypes.NOTE;
        if (title.contains("低頭族")) return ParticleTypes.SOUL;
        if (title.contains("我愛簽到") || title.contains("繁殖高手")) return ParticleTypes.HEART;
        return ParticleTypes.END_ROD; // Default fallback
    }

    public static String getParticleNameForTitle(String title) {
        if (title == null) return "無特效";
        if (title.contains("老玩家")) return "黃金耀斑 (WAX_ON)";
        if (title.contains("百萬富翁")) return "閃耀綠寶石 (HAPPY_VILLAGER)";
        if (title.contains("重鎚大師")) return "女巫紫氣 (WITCH)";
        if (title.contains("挖掘機")) return "靈魂青焰 (SOUL_FIRE_FLAME)";
        if (title.contains("蜘蛛人")) return "櫻花飄落 (CHERRY_LEAVES)";
        if (title.contains("一隻鳥")) return "烈焰風暴 (FLAME)";
        if (title.contains("黑貓宅急便")) return "炫彩音符 (NOTE)";
        if (title.contains("低頭族")) return "幽冥靈魂 (SOUL)";
        if (title.contains("我愛簽到") || title.contains("繁殖高手")) return "粉紅愛心 (HEART)";
        return "終界光閃 (END_ROD)";
    }

    private static abstract class ReadOnlyTrailMenuHandler extends ChestMenu {
        public ReadOnlyTrailMenuHandler(MenuType<ChestMenu> type, int syncId, net.minecraft.world.entity.player.Inventory playerInventory, SimpleContainer container, int rows) {
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

    public static void openTrailGui(ServerPlayer player) {
        if (player == null) return;
        UUID uuid = player.getUUID();
        PlayerTrailConfig cfg = getConfig(uuid);
        String activeTitle = TitleManager.getActiveTitle(player.getName().getString());
        String particleName = getParticleNameForTitle(activeTitle);

        SimpleContainer container = new SimpleContainer(27);
        ItemStack glass = createGuiItem(getItemFromIdentifier("minecraft:gray_stained_glass_pane"), " ", List.of());
        for (int i = 0; i < 27; i++) {
            container.setItem(i, glass);
        }

        // Slot 4: Player Info
        List<String> infoLore = List.of(
                "§7目前配戴稱號: " + (activeTitle != null ? activeTitle : "§c[無]"),
                "§7對應粒子主題: §e" + particleName,
                "",
                "§a[下方可獨立自由切換 4 種特效開關]"
        );
        container.setItem(4, createGuiItem(Items.NETHER_STAR, "§e✨ 稱號粒子特效面板", infoLore));

        // Slot 10: Footstep
        String fsStatus = cfg.footstepEnabled ? "§a[已開啟 ✔]" : "§c[已關閉 ✖]";
        container.setItem(10, createGuiItem(Items.GOLDEN_BOOTS, "§b🐾 移動足跡粒子", List.of("§7走路/跑步時於腳下產生粒子", "", "§7目前狀態: " + fsStatus, "§e[點擊切換狀態]")));

        // Slot 12: Aura
        String auraStatus = cfg.auraEnabled ? "§a[已開啟 ✔]" : "§c[已關閉 ✖]";
        container.setItem(12, createGuiItem(Items.END_CRYSTAL, "§d💫 身上環繞光環", List.of("§7靜止與移動時於身上環繞旋轉粒子", "", "§7目前狀態: " + auraStatus, "§e[點擊切換狀態]")));

        // Slot 14: Attack
        String atkStatus = cfg.attackEnabled ? "§a[已開啟 ✔]" : "§c[已關閉 ✖]";
        container.setItem(14, createGuiItem(Items.DIAMOND_SWORD, "§c⚔ 攻擊爆發特效", List.of("§7揮打或擊中生物時產生粒子爆發", "", "§7目前狀態: " + atkStatus, "§e[點擊切換狀態]")));

        // Slot 16: Place
        String plcStatus = cfg.placeEnabled ? "§a[已開啟 ✔]" : "§c[已關閉 ✖]";
        container.setItem(16, createGuiItem(Items.GRASS_BLOCK, "§a🧱 方塊放置特效", List.of("§7擺放方塊時產生粒子爆發", "", "§7目前狀態: " + plcStatus, "§e[點擊切換狀態]")));

        // Slot 22: Toggle All
        container.setItem(22, createGuiItem(Items.REDSTONE_TORCH, "§e⚡ 一鍵全開 / 全關", List.of("§7快速切換所有 4 種粒子特效開關", "", "§e[點擊切換]")));

        // Slot 26: Close
        container.setItem(26, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉介面")));

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
            new ReadOnlyTrailMenuHandler(MenuType.GENERIC_9x3, syncId, inv, container, 3) {
                @Override
                public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                    if (clicker instanceof ServerPlayer sp) {
                        if (slotId == 10) cfg.footstepEnabled = !cfg.footstepEnabled;
                        else if (slotId == 12) cfg.auraEnabled = !cfg.auraEnabled;
                        else if (slotId == 14) cfg.attackEnabled = !cfg.attackEnabled;
                        else if (slotId == 16) cfg.placeEnabled = !cfg.placeEnabled;
                        else if (slotId == 22) {
                            boolean anyOn = cfg.footstepEnabled || cfg.auraEnabled || cfg.attackEnabled || cfg.placeEnabled;
                            cfg.footstepEnabled = !anyOn;
                            cfg.auraEnabled = !anyOn;
                            cfg.attackEnabled = !anyOn;
                            cfg.placeEnabled = !anyOn;
                        } else if (slotId == 26) {
                            sp.closeContainer();
                            return;
                        }

                        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), net.minecraft.sounds.SoundEvents.UI_BUTTON_CLICK, net.minecraft.sounds.SoundSource.PLAYERS, 1.0f, 1.2f);
                        openTrailGui(sp);
                    }
                }
            }, Component.literal("§8❖ 稱號炫彩粒子控制台 (/trail) ❖")));
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
