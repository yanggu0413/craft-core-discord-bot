package com.craftcore.claim;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.ChestBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.ChestType;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class LockboxManager {

    public static class Lockbox {
        public String id; // normalized dimension:x,y,z
        public String location; // x,y,z
        public String owner;
        public String password;
        public List<String> authorized = new ArrayList<>();
    }

    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, Lockbox> lockboxes = new ConcurrentHashMap<>();

    // Temporary session for password input: Map<PlayerName, TargetChestKey>
    public static final Map<String, String> pendingLocks = new ConcurrentHashMap<>();

    static {
        try {
            configPath = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir()
                    .resolve("craft-core-shop").resolve("lockboxes.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "lockboxes.json");
        }
        load();
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Map<String, Lockbox> loaded = GSON.fromJson(reader, new TypeToken<Map<String, Lockbox>>(){}.getType());
                if (loaded != null) {
                    lockboxes.clear();
                    lockboxes.putAll(loaded);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load lockboxes: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            try {
                Files.createDirectories(configPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                    GSON.toJson(lockboxes, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save lockboxes: " + e.getMessage());
            }
        }
    }

    public static synchronized List<Lockbox> getLockboxes() {
        return new ArrayList<>(lockboxes.values());
    }

    public static synchronized Lockbox getLockbox(String id) {
        return lockboxes.get(id);
    }

    public static BlockPos getNormalizedChestPos(Level world, BlockPos pos) {
        BlockState state = world.getBlockState(pos);
        if (state.getBlock() instanceof ChestBlock) {
            ChestType chestType = state.getValue(ChestBlock.TYPE);
            if (chestType == ChestType.LEFT || chestType == ChestType.RIGHT) {
                Direction facing = state.getValue(ChestBlock.FACING);
                Direction dirToAttached = (chestType == ChestType.LEFT) 
                        ? facing.getClockWise() 
                        : facing.getCounterClockWise();
                BlockPos neighborPos = pos.relative(dirToAttached);
                if (pos.compareTo(neighborPos) > 0) {
                    return neighborPos;
                }
            }
        }
        return pos;
    }

    public static String getLockboxKey(Level world, BlockPos pos) {
        BlockPos norm = getNormalizedChestPos(world, pos);
        return world.dimension().identifier().toString() + ":" + norm.getX() + "," + norm.getY() + "," + norm.getZ();
    }

    // Start /padlock command logic
    public static int startLockSession(ServerPlayer player) {
        String username = player.getName().getString();
        HitResult hit = player.pick(4.5, 0.0F, false);
        if (hit.getType() == HitResult.Type.BLOCK) {
            BlockHitResult blockHit = (BlockHitResult) hit;
            BlockPos pos = blockHit.getBlockPos();
            Level world = player.level();
            BlockState state = world.getBlockState(pos);

            if (state.getBlock() instanceof ChestBlock) {
                String key = getLockboxKey(world, pos);
                Lockbox existing = lockboxes.get(key);

                if (existing != null) {
                    if (!existing.owner.equals(username)) {
                        player.sendSystemMessage(Component.literal("§c[Craft-Core] 您無權修改此密碼鎖！"));
                        return 0;
                    }
                }

                pendingLocks.put(username, key);
                player.sendSystemMessage(Component.literal("§b[Craft-Core] §f請輸入密碼以設定密碼鎖："));
                return 1;
            }
        }
        player.sendSystemMessage(Component.literal("§c[Craft-Core] 請看著一個箱子（最大距離 4.5 格）！"));
        return 0;
    }

    // Handle next chat message as password
    public static boolean handleChatPassword(ServerPlayer player, String password) {
        String username = player.getName().getString();
        String key = pendingLocks.remove(username);
        if (key == null) return false;

        String[] parts = key.split(":");
        if (parts.length < 2) return false;
        String dim = parts[0] + ":" + parts[1];
        String coords = parts[2];

        Lockbox lockbox = lockboxes.computeIfAbsent(key, k -> {
            Lockbox l = new Lockbox();
            l.id = key;
            l.location = coords;
            l.owner = username;
            return l;
        });

        lockbox.password = password;
        if (!lockbox.authorized.contains(username)) {
            lockbox.authorized.add(username);
        }
        save();

        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.CHEST_LOCKED, SoundSource.PLAYERS, 1.0F, 1.0F);
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a密碼鎖設定成功！"));
        return true;
    }

    // Command /padlock grant <player>
    public static int grantAccess(ServerPlayer player, String targetPlayer) {
        String username = player.getName().getString();
        HitResult hit = player.pick(4.5, 0.0F, false);
        if (hit.getType() == HitResult.Type.BLOCK) {
            BlockHitResult blockHit = (BlockHitResult) hit;
            BlockPos pos = blockHit.getBlockPos();
            Level world = player.level();
            BlockState state = world.getBlockState(pos);

            if (state.getBlock() instanceof ChestBlock) {
                String key = getLockboxKey(world, pos);
                Lockbox lockbox = lockboxes.get(key);

                if (lockbox == null) {
                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 此箱子尚未安裝密碼鎖！"));
                    return 0;
                }

                if (!lockbox.owner.equals(username)) {
                    player.sendSystemMessage(Component.literal("§c[Craft-Core] 您無權修改此密碼鎖！"));
                    return 0;
                }

                if (!lockbox.authorized.contains(targetPlayer)) {
                    lockbox.authorized.add(targetPlayer);
                    save();
                }

                player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功授權玩家 " + targetPlayer + " 開啟此箱子！"));
                return 1;
            }
        }
        player.sendSystemMessage(Component.literal("§c[Craft-Core] 請看著一個箱子（最大距離 4.5 格）！"));
        return 0;
    }

    // Can open locked chest
    public static boolean canOpen(ServerPlayer player, BlockPos pos, Level world) {
        BlockState state = world.getBlockState(pos);
        if (!(state.getBlock() instanceof ChestBlock)) return true;

        String key = getLockboxKey(world, pos);
        Lockbox lockbox = lockboxes.get(key);
        if (lockbox == null) return true; // Not locked

        String username = player.getName().getString();
        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
        if (lockbox.owner.equals(username) || isOp || lockbox.authorized.contains(username)) {
            return true;
        }

        player.sendSystemMessage(Component.literal("§c[Craft-Core] 此箱子已被密碼鎖鎖定！"));
        player.playSound(SoundEvents.CHEST_LOCKED, 1.0f, 1.0f);
        return false;
    }

    public static synchronized boolean grantPermission(String id, String targetPlayer) {
        Lockbox lockbox = lockboxes.get(id);
        if (lockbox == null) return false;
        if (!lockbox.authorized.contains(targetPlayer)) {
            lockbox.authorized.add(targetPlayer);
            save();
            return true;
        }
        return false;
    }

    public static synchronized boolean revokePermission(String id, String targetPlayer) {
        Lockbox lockbox = lockboxes.get(id);
        if (lockbox == null) return false;
        if (lockbox.authorized.contains(targetPlayer)) {
            lockbox.authorized.remove(targetPlayer);
            save();
            return true;
        }
        return false;
    }

    public static synchronized boolean changePassword(String id, String newPassword) {
        Lockbox lockbox = lockboxes.get(id);
        if (lockbox == null) return false;
        lockbox.password = newPassword;
        save();
        return true;
    }

    public static synchronized boolean removeLockbox(String id) {
        if (lockboxes.containsKey(id)) {
            lockboxes.remove(id);
            save();
            return true;
        }
        return false;
    }
}
