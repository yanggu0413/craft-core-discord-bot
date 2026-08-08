package com.craftcore.mushroom;

import net.minecraft.core.component.DataComponents;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.item.component.ResolvableProfile;

import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class MushroomManager {

    private static final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public static ItemStack createMushroomStack() {
        ItemStack head = new ItemStack(Items.PLAYER_HEAD);

        // 1. Profile for skull (im_little_rory) with full Mojang texture Base64
        com.google.common.collect.Multimap<String, com.mojang.authlib.properties.Property> map = com.google.common.collect.HashMultimap.create();
        map.put("textures", new com.mojang.authlib.properties.Property(
                "textures",
                "ewogICJ0aW1lc3RhbXAiIDogMTc4NTkwODE3ODkzMiwKICAicHJvZmlsZUlkIiA6ICI3OTk2YzM3OGNlYmU0Y2JmOGZhMzA2NDI4MzYwMWYxMiIsCiAgInByb2ZpbGVOYW1lIiA6ICJpbV9saXR0bGVfcm9yeSIsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS84YTQ0NjQ4MTMyZjZjMGNkZWE4MTVhMjEyMDc3YjJkZTQ4MDNmNmU0OTk5MWFiYWFmNzUxZDNlNDIxYmIzMzE4IgogICAgfSwKICAgICJDQVBFIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS81ZWM5MzBjZGQyNjI5Yzg3NzE2NTVjNjBlZWJlYjg2N2I0YjY1NTliMGU2ZDNiYzcxYzQwYzk2MzQ3ZmEwM2YwIgogICAgfQogIH0KfQ=="
        ));
        com.mojang.authlib.properties.PropertyMap propertyMap = new com.mojang.authlib.properties.PropertyMap(map);
        com.mojang.authlib.GameProfile gameProfile = new com.mojang.authlib.GameProfile(
                UUID.fromString("7996c378-cebe-4cbf-8fa3-064283601f12"),
                "im_little_rory",
                propertyMap
        );
        head.set(DataComponents.PROFILE, ResolvableProfile.createResolved(gameProfile));

        // 2. Custom Name: 【洋菇】
        head.set(DataComponents.CUSTOM_NAME, Component.literal("§d【洋菇】"));

        // 3. Lore
        head.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal("§7這是一顆看起來非常鮮美的洋菇。"),
                Component.literal("§7但不知為何，總覺得哪裡怪怪的……"),
                Component.literal("§7真的沒打錯嗎？")
        )));

        // 4. Enchantment Glint
        head.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);

        // 5. Custom Data tag for 100% accurate identification
        CompoundTag tag = new CompoundTag();
        tag.putBoolean("craftcore_is_mushroom", true);
        head.set(DataComponents.CUSTOM_DATA, CustomData.of(tag));

        // 6. Enforce max stack size = 1
        head.set(DataComponents.MAX_STACK_SIZE, 1);

        return head;
    }

    public static boolean isMushroom(ItemStack stack) {
        if (stack == null || stack.isEmpty()) return false;
        if (stack.getItem() != Items.PLAYER_HEAD) return false;

        CustomData customData = stack.get(DataComponents.CUSTOM_DATA);
        if (customData != null) {
            CompoundTag nbt = customData.copyTag();
            if (nbt.getBoolean("craftcore_is_mushroom").orElse(false)) {
                return true;
            }
        }

        Component name = stack.get(DataComponents.CUSTOM_NAME);
        if (name != null && name.getString().contains("洋菇")) {
            return true;
        }

        return false;
    }

    public static boolean hasMushroomInInventory(ServerPlayer player) {
        if (player == null || player.getInventory() == null) return false;
        for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
            ItemStack stack = player.getInventory().getItem(i);
            if (isMushroom(stack)) {
                return true;
            }
        }
        return false;
    }

    public static void enforceSingleMushroom(ServerPlayer player) {
        if (player == null || player.getInventory() == null) return;
        boolean foundOne = false;
        for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
            ItemStack stack = player.getInventory().getItem(i);
            if (isMushroom(stack)) {
                if (!foundOne) {
                    foundOne = true;
                    if (stack.getCount() > 1) {
                        stack.setCount(1);
                    }
                } else {
                    player.getInventory().setItem(i, ItemStack.EMPTY);
                }
            }
        }
    }

    private static final Set<UUID> disabledReceivingPlayers = java.util.concurrent.ConcurrentHashMap.newKeySet();
    private static java.nio.file.Path configFile;

    static {
        try {
            configFile = com.craftcore.util.FabricPathUtil.getShopConfigDir().resolve("mushroom_disabled.json");
        } catch (Throwable e) {
            configFile = java.nio.file.Path.of("config", "craft-core-shop", "mushroom_disabled.json");
        }
        loadConfig();
    }

    private static void loadConfig() {
        if (configFile != null && java.nio.file.Files.exists(configFile)) {
            try (java.io.BufferedReader reader = java.nio.file.Files.newBufferedReader(configFile)) {
                java.lang.reflect.Type type = new com.google.gson.reflect.TypeToken<Set<String>>(){}.getType();
                Set<String> set = new com.google.gson.Gson().fromJson(reader, type);
                if (set != null) {
                    for (String str : set) {
                        disabledReceivingPlayers.add(UUID.fromString(str));
                    }
                }
            } catch (Throwable ignored) {}
        }
    }

    private static void saveConfig() {
        if (configFile == null) return;
        try {
            if (configFile.getParent() != null) java.nio.file.Files.createDirectories(configFile.getParent());
            try (java.io.BufferedWriter writer = java.nio.file.Files.newBufferedWriter(configFile)) {
                Set<String> strings = new java.util.HashSet<>();
                for (UUID u : disabledReceivingPlayers) strings.add(u.toString());
                new com.google.gson.GsonBuilder().setPrettyPrinting().create().toJson(strings, writer);
            }
        } catch (Throwable ignored) {}
    }

    public static boolean isReceivingDisabled(UUID uuid) {
        return disabledReceivingPlayers.contains(uuid);
    }

    public static void setReceivingDisabled(ServerPlayer player, boolean disabled) {
        if (player == null) return;
        if (disabled) {
            disabledReceivingPlayers.add(player.getUUID());
            player.sendSystemMessage(Component.literal("§d[洋菇] §c已關閉【洋菇】自動發放功能！輸入 /mushroom get 或 /mushroom toggle 可重新啟用。"));
        } else {
            disabledReceivingPlayers.remove(player.getUUID());
            player.sendSystemMessage(Component.literal("§d[洋菇] §a已開啟【洋菇】自動發放功能！"));
            checkAndGiveMushroom(player);
        }
        saveConfig();
    }

    public static boolean toggleReceiving(ServerPlayer player) {
        if (player == null) return false;
        boolean nowDisabled = !isReceivingDisabled(player.getUUID());
        setReceivingDisabled(player, nowDisabled);
        return !nowDisabled;
    }

    public static void giveMushroomDirectly(ServerPlayer player) {
        if (player == null) return;
        enforceSingleMushroom(player);
        if (hasMushroomInInventory(player)) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您的背包內已有【洋菇】，無須重複領取！"));
            return;
        }
        int freeSlot = player.getInventory().getFreeSlot();
        if (freeSlot != -1) {
            ItemStack mushroom = createMushroomStack();
            player.getInventory().add(mushroom);
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 0.8f, 1.2f);
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a手動領取了神秘物品 §d【洋菇】§a！"));
        } else {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您的背包空間不足，請空出一個格子後再試！"));
        }
    }

    public static void checkAndGiveMushroom(ServerPlayer player) {
        if (player == null) return;
        if (isReceivingDisabled(player.getUUID())) return;

        // First enforce strictly only 1 mushroom exists in inventory
        enforceSingleMushroom(player);

        if (hasMushroomInInventory(player)) return;

        int freeSlot = player.getInventory().getFreeSlot();
        if (freeSlot != -1) {
            ItemStack mushroom = createMushroomStack();
            player.getInventory().add(mushroom);
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 0.8f, 1.2f);
            player.sendSystemMessage(Component.literal("§b[Craft-Core] §a獲得了神秘物品 §d【洋菇】§a！"));
        }
    }

    private static final Set<UUID> activeAiChatPlayers = java.util.concurrent.ConcurrentHashMap.newKeySet();

    public static boolean toggleAiChatMode(ServerPlayer player) {
        if (player == null) return false;
        UUID uuid = player.getUUID();
        if (activeAiChatPlayers.contains(uuid)) {
            activeAiChatPlayers.remove(uuid);
            player.sendSystemMessage(Component.literal("§d[洋菇] §c對話已結束！有空再來找洋菇聊天喔～"));
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.VILLAGER_NO, SoundSource.PLAYERS, 1.0f, 1.0f);
            return false;
        } else {
            activeAiChatPlayers.add(uuid);
            player.sendSystemMessage(Component.literal("§d[洋菇] §a嘿嘿！你開啟了與洋菇的通靈對話～接下來在聊天室說話我都會回覆你喔！\n§7(再次右鍵【洋菇】或輸入 exit / 退出 即可結束)"));
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.VILLAGER_YES, SoundSource.PLAYERS, 1.0f, 1.0f);
            return true;
        }
    }

    public static boolean isAiChatActive(ServerPlayer player) {
        return player != null && activeAiChatPlayers.contains(player.getUUID());
    }

    public static void exitAiChatMode(ServerPlayer player) {
        if (player == null) return;
        if (activeAiChatPlayers.remove(player.getUUID())) {
            player.sendSystemMessage(Component.literal("§d[洋菇] §c對話已結束！有空再來找洋菇聊天喔～"));
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.VILLAGER_NO, SoundSource.PLAYERS, 1.0f, 1.0f);
        }
    }

    public static void startLoop(net.minecraft.server.MinecraftServer server) {
        scheduler.scheduleAtFixedRate(() -> {
            try {
                if (server != null) {
                    server.execute(() -> {
                        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
                            checkAndGiveMushroom(player);
                        }
                    });
                }
            } catch (Throwable t) {
                t.printStackTrace();
            }
        }, 5, 30, TimeUnit.SECONDS);
    }
}
