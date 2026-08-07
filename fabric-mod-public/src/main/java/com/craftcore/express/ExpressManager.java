package com.craftcore.express;

import com.craftcore.util.AsyncSaveExecutor;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.Tag;
import net.minecraft.nbt.TagParser;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class ExpressManager {
    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static class ExpressParcel {
        public String id;
        public String sender;
        public String recipient;
        public long sentAt;
        public boolean claimed;
        public long claimedAt;
        public List<String> itemsNbt = new ArrayList<>();

        public ExpressParcel() {}

        public ExpressParcel(String id, String sender, String recipient, long sentAt, List<String> itemsNbt) {
            this.id = id;
            this.sender = sender;
            this.recipient = recipient;
            this.sentAt = sentAt;
            this.claimed = false;
            this.claimedAt = 0;
            this.itemsNbt = itemsNbt != null ? itemsNbt : new ArrayList<>();
        }
    }

    public static class PendingSendSession {
        public final String sender;
        public String presetRecipient;
        public final List<ItemStack> items;
        public final long startTime;

        public PendingSendSession(String sender, String presetRecipient, List<ItemStack> items) {
            this.sender = sender;
            this.presetRecipient = presetRecipient;
            this.items = items;
            this.startTime = System.currentTimeMillis();
        }

        public boolean isExpired() {
            return System.currentTimeMillis() - startTime > 60000;
        }
    }

    private static final Map<String, ExpressParcel> parcelMap = new ConcurrentHashMap<>();
    private static final Map<String, PendingSendSession> pendingSends = new ConcurrentHashMap<>();

    static {
        try {
            configPath = com.craftcore.util.FabricPathUtil.getShopConfigDir().resolve("parcels.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "parcels.json");
        }
        load();
    }

    public static synchronized void setConfigPath(Path path) {
        AsyncSaveExecutor.flush();
        configPath = path;
        load();
    }

    public static synchronized void clearAll() {
        AsyncSaveExecutor.flush();
        parcelMap.clear();
        save();
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Map<String, ExpressParcel> loaded = GSON.fromJson(reader, new TypeToken<Map<String, ExpressParcel>>(){}.getType());
                if (loaded != null) {
                    parcelMap.clear();
                    parcelMap.putAll(loaded);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load parcels: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            AsyncSaveExecutor.submit(() -> {
                try {
                    Files.createDirectories(configPath.getParent());
                    try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                        GSON.toJson(parcelMap, writer);
                    }
                } catch (IOException e) {
                    System.err.println("[CraftCore] Failed to save parcels: " + e.getMessage());
                }
            });
        }
    }

    public static String serializeItemStack(ItemStack stack, HolderLookup.Provider registryAccess) {
        if (stack == null || stack.isEmpty()) return "";
        try {
            var ops = registryAccess.createSerializationContext(com.mojang.serialization.JsonOps.INSTANCE);
            com.google.gson.JsonElement json = ItemStack.CODEC.encodeStart(ops, stack).getOrThrow();
            return GSON.toJson(json);
        } catch (Throwable t1) {
            try {
                var ops = registryAccess.createSerializationContext(com.mojang.serialization.JsonOps.INSTANCE);
                com.google.gson.JsonElement json = ItemStack.OPTIONAL_CODEC.encodeStart(ops, stack).getOrThrow();
                return GSON.toJson(json);
            } catch (Throwable t2) {
                return "";
            }
        }
    }

    public static ItemStack deserializeItemStack(String nbtStr, HolderLookup.Provider registryAccess) {
        if (nbtStr == null || nbtStr.isBlank()) return ItemStack.EMPTY;
        try {
            com.google.gson.JsonElement element = com.google.gson.JsonParser.parseString(nbtStr);
            var ops = registryAccess.createSerializationContext(com.mojang.serialization.JsonOps.INSTANCE);
            return ItemStack.CODEC.parse(ops, element).result().orElseGet(() ->
                ItemStack.OPTIONAL_CODEC.parse(ops, element).result().orElse(ItemStack.EMPTY)
            );
        } catch (Throwable t) {
            return ItemStack.EMPTY;
        }
    }

    public static synchronized ExpressParcel sendParcel(String sender, String recipient, List<ItemStack> items, HolderLookup.Provider registryAccess) {
        if (sender == null || recipient == null || items == null || items.isEmpty()) {
            return null;
        }
        List<String> nbtList = new ArrayList<>();
        for (ItemStack item : items) {
            if (item != null && !item.isEmpty()) {
                String nbt = serializeItemStack(item, registryAccess);
                if (!nbt.isBlank()) {
                    nbtList.add(nbt);
                }
            }
        }
        if (nbtList.isEmpty()) return null;

        String id = "parcel_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
        ExpressParcel parcel = new ExpressParcel(id, sender, recipient, System.currentTimeMillis(), nbtList);
        parcelMap.put(id, parcel);
        save();
        return parcel;
    }

    public static synchronized List<ExpressParcel> getInboxParcels(String recipient) {
        List<ExpressParcel> list = new ArrayList<>();
        if (recipient == null) return list;
        for (ExpressParcel p : parcelMap.values()) {
            if (p.recipient != null && p.recipient.equalsIgnoreCase(recipient) && !p.claimed) {
                list.add(p);
            }
        }
        list.sort((a, b) -> Long.compare(b.sentAt, a.sentAt));
        return list;
    }

    public static synchronized List<ExpressParcel> getSentParcels(String sender) {
        List<ExpressParcel> list = new ArrayList<>();
        if (sender == null) return list;
        for (ExpressParcel p : parcelMap.values()) {
            if (p.sender != null && p.sender.equalsIgnoreCase(sender)) {
                list.add(p);
            }
        }
        list.sort((a, b) -> Long.compare(b.sentAt, a.sentAt));
        return list;
    }

    public static synchronized boolean claimParcel(String parcelId, ServerPlayer recipientPlayer) {
        ExpressParcel parcel = parcelMap.get(parcelId);
        if (parcel == null || parcel.claimed) return false;
        HolderLookup.Provider registryAccess = recipientPlayer.level().registryAccess();
        for (String nbtStr : parcel.itemsNbt) {
            ItemStack stack = deserializeItemStack(nbtStr, registryAccess);
            if (!stack.isEmpty()) {
                recipientPlayer.getInventory().placeItemBackInInventory(stack);
            }
        }
        parcel.claimed = true;
        parcel.claimedAt = System.currentTimeMillis();
        save();
        return true;
    }

    public static void addPendingSend(String sender, String presetRecipient, List<ItemStack> items) {
        pendingSends.put(sender, new PendingSendSession(sender, presetRecipient, items));
    }

    public static PendingSendSession getPendingSend(String sender) {
        PendingSendSession s = pendingSends.get(sender);
        if (s != null && s.isExpired()) {
            pendingSends.remove(sender);
            return null;
        }
        return s;
    }

    public static void removePendingSend(String sender) {
        pendingSends.remove(sender);
    }
}
