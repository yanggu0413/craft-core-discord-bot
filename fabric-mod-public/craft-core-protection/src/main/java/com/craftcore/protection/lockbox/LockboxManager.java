package com.craftcore.protection.lockbox;

import com.craftcore.api.JsonDataStore;
import com.craftcore.api.RebrandEngine;
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

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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

    private static final Map<String, Lockbox> lockboxes = new ConcurrentHashMap<>();
    public static final Map<String, String> pendingLocks = new ConcurrentHashMap<>();

    static {
        load();
    }

    public static String hashPassword(String password) {
        if (password == null || password.isEmpty()) return "";
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(("CraftCoreSalt:" + password).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder("$SHA256$");
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return password;
        }
    }

    public static boolean verifyPassword(String inputPassword, String storedPassword) {
        if (storedPassword == null) return false;
        if (storedPassword.startsWith("$SHA256$")) {
            return storedPassword.equals(hashPassword(inputPassword));
        } else {
            return storedPassword.equals(inputPassword);
        }
    }

    public static synchronized void load() {
        Map<String, Lockbox> loaded = JsonDataStore.loadData("lockboxes.json", new TypeToken<Map<String, Lockbox>>(){}.getType(), new ConcurrentHashMap<>());
        if (loaded != null) {
            lockboxes.clear();
            boolean migrated = false;
            for (Map.Entry<String, Lockbox> entry : loaded.entrySet()) {
                Lockbox lb = entry.getValue();
                if (lb != null && lb.password != null && !lb.password.startsWith("$SHA256$")) {
                    lb.password = hashPassword(lb.password);
                    migrated = true;
                }
                if (lb != null) {
                    lockboxes.put(entry.getKey(), lb);
                }
            }
            if (migrated) {
                save();
            }
        }
    }

    public static synchronized void save() {
        JsonDataStore.saveDataAsync("lockboxes.json", lockboxes);
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

    public static int startLockSession(ServerPlayer player) {
        String username = player.getName().getString();
        HitResult hit = player.pick(4.5, 0.0F, false);
        if (hit.getType() == HitResult.Type.BLOCK) {
            BlockHitResult blockHit = (BlockHitResult) hit;
            BlockPos pos = blockHit.getBlockPos();
            Level world = player.level();
            BlockState state = world.getBlockState(pos);

            String dimId = world.dimension().identifier().toString();
            if (dimId.contains("craftcore:mining") || dimId.contains("craftcore:fishing")) {
                player.sendSystemMessage(Component.literal("§c[專屬維度保護] 釣魚世界與採礦世界專供全服自由活動，禁止設定私人密碼箱！"));
                return 0;
            }

            if (state.getBlock() instanceof ChestBlock) {
                String key = getLockboxKey(world, pos);
                Lockbox existing = lockboxes.get(key);

                if (existing != null) {
                    if (!existing.owner.equals(username)) {
                        player.sendSystemMessage(RebrandEngine.rebrandText("§c[%server_name%] 您無權修改此密碼鎖！"));
                        return 0;
                    }
                }

                pendingLocks.put(username.toLowerCase(), key);
                player.sendSystemMessage(RebrandEngine.rebrandText("§b[%server_name%] §f請輸入密碼以設定密碼鎖："));
                return 1;
            }
        }
        player.sendSystemMessage(RebrandEngine.rebrandText("§c[%server_name%] 請看著一個箱子（最大距離 4.5 格）！"));
        return 0;
    }

    public static boolean handleChatPassword(ServerPlayer player, String password) {
        String username = player.getName().getString();
        String key = pendingLocks.remove(username.toLowerCase());
        if (key == null) {
            key = pendingLocks.remove(username);
        }
        if (key == null) return false;

        if ("cancel".equalsIgnoreCase(password.trim()) || "取消".equals(password.trim())) {
            player.sendSystemMessage(RebrandEngine.rebrandText("§c[%server_name%] 密碼設定已取消。"));
            return true;
        }

        String[] parts = key.split(":");
        if (parts.length < 2) return false;
        String coords = parts[parts.length - 1];

        Lockbox lockbox = lockboxes.computeIfAbsent(key, k -> {
            Lockbox l = new Lockbox();
            l.id = k;
            l.location = coords;
            l.owner = username;
            return l;
        });

        lockbox.password = hashPassword(password);
        if (!lockbox.authorized.contains(username)) {
            lockbox.authorized.add(username);
        }
        save();

        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.CHEST_LOCKED, SoundSource.PLAYERS, 1.0F, 1.0F);
        player.sendSystemMessage(RebrandEngine.rebrandText("§b[%server_name%] §a密碼鎖設定成功！"));
        return true;
    }

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
                    player.sendSystemMessage(RebrandEngine.rebrandText("§c[%server_name%] 此箱子尚未安裝密碼鎖！"));
                    return 0;
                }

                if (!lockbox.owner.equals(username)) {
                    player.sendSystemMessage(RebrandEngine.rebrandText("§c[%server_name%] 您無權修改此密碼鎖！"));
                    return 0;
                }

                if (!lockbox.authorized.contains(targetPlayer)) {
                    lockbox.authorized.add(targetPlayer);
                    save();
                }

                player.sendSystemMessage(RebrandEngine.rebrandText("§b[%server_name%] §a成功授權玩家 " + targetPlayer + " 開啟此箱子！"));
                return 1;
            }
        }
        player.sendSystemMessage(RebrandEngine.rebrandText("§c[%server_name%] 請看著一個箱子（最大距離 4.5 格）！"));
        return 0;
    }

    public static boolean canOpen(ServerPlayer player, BlockPos pos, Level world) {
        BlockState state = world.getBlockState(pos);
        if (!(state.getBlock() instanceof ChestBlock)) return true;

        String key = getLockboxKey(world, pos);
        Lockbox lockbox = lockboxes.get(key);
        if (lockbox == null) return true; // Not locked

        String username = player.getName().getString();
        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
        if (lockbox.owner.equalsIgnoreCase(username) || isOp || lockbox.authorized.contains(username)) {
            return true;
        }

        player.sendSystemMessage(RebrandEngine.rebrandText("§c[%server_name%] 此箱子已被密碼鎖鎖定！"));
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
        lockbox.password = hashPassword(newPassword);
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
