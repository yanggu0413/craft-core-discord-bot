package com.craftcore.machine;

import com.craftcore.data.JsonDataStore;
import com.craftcore.title.TitleManager;
import com.google.gson.reflect.TypeToken;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class MachineManager {
    public static class MachineEntry {
        public String id;
        public String name;
        public String owner;
        public String dimension;
        public int x;
        public int y;
        public int z;
        public String status; // "PENDING", "APPROVED", "REJECTED"
        public String tier;   // "NONE", "T1", "T2", "T3"
        public long applyTime;

        public MachineEntry(String id, String name, String owner, String dimension, int x, int y, int z) {
            this.id = id;
            this.name = name;
            this.owner = owner;
            this.dimension = dimension;
            this.x = x;
            this.y = y;
            this.z = z;
            this.status = "PENDING";
            this.tier = "NONE";
            this.applyTime = System.currentTimeMillis();
        }
    }

    private static final String DATA_FILE = "machines.json";
    private static Map<String, MachineEntry> machines = new ConcurrentHashMap<>();

    static {
        loadData();
    }

    public static synchronized void loadData() {
        Map<String, MachineEntry> loaded = JsonDataStore.loadData(DATA_FILE, new TypeToken<Map<String, MachineEntry>>(){}.getType(), new ConcurrentHashMap<>());
        if (loaded != null) {
            machines = new ConcurrentHashMap<>(loaded);
        }
    }

    public static synchronized void saveData() {
        JsonDataStore.saveDataAsync(DATA_FILE, machines);
    }

    public static synchronized String applyMachine(ServerPlayer player, String machineName) {
        if (player == null || machineName == null || machineName.trim().isEmpty()) return "機器名稱不可為空。";
        String owner = player.getName().getString();
        String dim = player.level().dimension().identifier().toString();
        int x = player.getBlockX();
        int y = player.getBlockY();
        int z = player.getBlockZ();

        String id = "m_" + System.currentTimeMillis() % 1000000;
        MachineEntry entry = new MachineEntry(id, machineName.trim(), owner, dim, x, y, z);
        machines.put(id, entry);
        saveData();
        return id;
    }

    public static synchronized boolean approveMachine(MinecraftServer server, String id, String tier, String adminName) {
        MachineEntry entry = machines.get(id);
        if (entry == null) return false;
        entry.status = "APPROVED";
        entry.tier = tier.toUpperCase();
        saveData();

        ServerPlayer ownerPlayer = server != null ? server.getPlayerList().getPlayerByName(entry.owner) : null;

        if ("T3".equalsIgnoreCase(tier)) {
            TitleManager.unlockTitle(entry.owner, "§6[首席工程師]");
            if (ownerPlayer != null) {
                ownerPlayer.sendSystemMessage(Component.literal("§6[Craft-Core] 恭喜！您的機器「" + entry.name + "」已通過 T3 最高認證，解鎖稱號 §6[首席工程師] §6並獲得 100% 免領地維護費！"));
            }
        } else if ("T2".equalsIgnoreCase(tier)) {
            TitleManager.unlockTitle(entry.owner, "§b[工業大亨]");
            if (ownerPlayer != null) {
                ownerPlayer.sendSystemMessage(Component.literal("§b[Craft-Core] 恭喜！您的機器「" + entry.name + "」已通過 T2 認證，解鎖稱號 §b[工業大亨] §b並獲得 100% 免領地維護費！"));
            }
        } else {
            if (ownerPlayer != null) {
                ownerPlayer.sendSystemMessage(Component.literal("§a[Craft-Core] 您的機器「" + entry.name + "」已通過 " + tier + " 審核認證！"));
            }
        }
        return true;
    }

    public static synchronized boolean rejectMachine(MinecraftServer server, String id, String adminName) {
        MachineEntry entry = machines.get(id);
        if (entry == null) return false;
        entry.status = "REJECTED";
        saveData();

        if (server != null) {
            ServerPlayer ownerPlayer = server.getPlayerList().getPlayerByName(entry.owner);
            if (ownerPlayer != null) {
                ownerPlayer.sendSystemMessage(Component.literal("§c[Craft-Core] 您的機器「" + entry.name + "」未通過審核。"));
            }
        }
        return true;
    }

    public static synchronized List<MachineEntry> getPendingMachines() {
        List<MachineEntry> list = new ArrayList<>();
        for (MachineEntry entry : machines.values()) {
            if ("PENDING".equalsIgnoreCase(entry.status)) {
                list.add(entry);
            }
        }
        return list;
    }

    public static synchronized Map<String, MachineEntry> getAllMachines() {
        return new HashMap<>(machines);
    }
}
