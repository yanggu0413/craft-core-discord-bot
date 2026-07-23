package com.craftcore.claim;

import com.craftcore.economy.EconomyManager;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.annotations.SerializedName;
import com.google.gson.reflect.TypeToken;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundSetSubtitleTextPacket;
import net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.Vec3;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class ClaimManager {

    public static class Claim {
        public String id;
        public String name;
        public String owner;
        public int chunks;
        public String[] corners; // ["x1,y1,z1", "x2,y2,z2"]
        public String dimension;
        public boolean public_containers = false;
        public boolean public_interact = false;
        public boolean public_entry = true;
        public List<String> banned_players = new ArrayList<>();
        public Permissions permissions = new Permissions();

        public static class Permissions {
            @SerializedName("build")
            public List<String> build = new ArrayList<>();

            @SerializedName("break")
            public List<String> breakBlocks = new ArrayList<>();

            @SerializedName("containers")
            public List<String> containers = new ArrayList<>();

            @SerializedName("interact")
            public List<String> interact = new ArrayList<>();
        }
    }

    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Map<String, Claim> claims = new ConcurrentHashMap<>();

    // Temporary player selection cache
    public static final Map<String, BlockPos> playerCornerA = new ConcurrentHashMap<>();
    public static final Map<String, BlockPos> playerCornerB = new ConcurrentHashMap<>();
    public static final Map<String, String> playerCornerADim = new ConcurrentHashMap<>();
    public static final Map<String, String> playerCornerBDim = new ConcurrentHashMap<>();

    static {
        try {
            configPath = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir()
                    .resolve("craft-core-shop").resolve("claims.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "claims.json");
        }
        load();
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Map<String, Claim> loaded = GSON.fromJson(reader, new TypeToken<Map<String, Claim>>(){}.getType());
                if (loaded != null) {
                    claims.clear();
                    claims.putAll(loaded);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load claims: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            try {
                Files.createDirectories(configPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                    GSON.toJson(claims, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save claims: " + e.getMessage());
            }
        }
    }

    public static synchronized List<Claim> getClaims() {
        return new ArrayList<>(claims.values());
    }

    public static synchronized Claim getClaim(String id) {
        return claims.get(id);
    }

    public static synchronized void addClaim(Claim claim) {
        claims.put(claim.id, claim);
        save();
    }

    public static synchronized void removeClaim(String id) {
        claims.remove(id);
        save();
    }

    // Set Corner A (Left click)
    public static void setCornerA(ServerPlayer player, BlockPos pos, Level world) {
        String username = player.getName().getString();
        String dim = world.dimension().identifier().toString();
        playerCornerA.put(username, pos);
        playerCornerADim.put(username, dim);
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §f已設定角落 A: " + pos.getX() + ", " + pos.getY() + ", " + pos.getZ()));
        checkSelection(player, username);
    }

    // Set Corner B (Right click)
    public static void setCornerB(ServerPlayer player, BlockPos pos, Level world) {
        String username = player.getName().getString();
        String dim = world.dimension().identifier().toString();
        playerCornerB.put(username, pos);
        playerCornerBDim.put(username, dim);
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §f已設定角落 B: " + pos.getX() + ", " + pos.getY() + ", " + pos.getZ()));
        checkSelection(player, username);
    }

    private static void checkSelection(ServerPlayer player, String username) {
        BlockPos a = playerCornerA.get(username);
        BlockPos b = playerCornerB.get(username);
        String dimA = playerCornerADim.get(username);
        String dimB = playerCornerBDim.get(username);

        if (a != null && b != null && dimA != null && dimB != null && dimA.equals(dimB)) {
            int chunks = calculateChunks(a, b);
            boolean hasExistingClaim = claims.values().stream().anyMatch(c -> c.owner.equalsIgnoreCase(username));
            double cost = hasExistingClaim ? (chunks * 30.0) : 0.0;
            if (!hasExistingClaim) {
                player.sendSystemMessage(Component.literal(String.format("§b[Craft-Core] §f選取區域跨越了 %d 個區塊 (Chunk)。§a【新手特權】首塊初始領地完全免費！§f- 請輸入 §a/claim§f 進行確認建立。", chunks)));
            } else {
                player.sendSystemMessage(Component.literal(String.format("§b[Craft-Core] §f選取區域跨越了 %d 個區塊 (Chunk)。總計費用: §e$%.1f§f 元。§f- 請輸入 §a/claim§f 進行確認購買。", chunks, cost)));
            }
        }
    }

    public static int calculateChunks(BlockPos a, BlockPos b) {
        int minX = Math.min(a.getX(), b.getX());
        int maxX = Math.max(a.getX(), b.getX());
        int minZ = Math.min(a.getZ(), b.getZ());
        int maxZ = Math.max(a.getZ(), b.getZ());

        int minChunkX = minX >> 4;
        int maxChunkX = maxX >> 4;
        int minChunkZ = minZ >> 4;
        int maxChunkZ = maxZ >> 4;

        return (maxChunkX - minChunkX + 1) * (maxChunkZ - minChunkZ + 1);
    }

    // Purchase Claim
    public static int purchaseClaim(ServerPlayer player) {
        String username = player.getName().getString();
        BlockPos a = playerCornerA.get(username);
        BlockPos b = playerCornerB.get(username);
        String dimA = playerCornerADim.get(username);
        String dimB = playerCornerBDim.get(username);

        if (a == null || b == null || dimA == null || dimB == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 請先以木鋤設定角落 A 與 B！"));
            return 0;
        }

        if (!dimA.equals(dimB)) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 角落 A 與 B 必須在相同世界/維度！"));
            return 0;
        }

        int chunks = calculateChunks(a, b);
        boolean hasExistingClaim = claims.values().stream().anyMatch(c -> c.owner.equalsIgnoreCase(username));
        double cost = hasExistingClaim ? (chunks * 30.0) : 0.0;
        double balance = EconomyManager.getBalance(username);

        if (cost > 0 && balance < cost) {
            player.sendSystemMessage(Component.literal(String.format("§c[Craft-Core] 金額不足！需要 $%s，但您只有 $%s。", String.format("%.1f", cost), String.format("%.1f", balance))));
            return 0;
        }

        if (cost == 0.0 || EconomyManager.removeMoney(username, cost)) {
            Claim claim = new Claim();
            claim.id = UUID.randomUUID().toString();
            claim.name = username + " 的領地";
            claim.owner = username;
            claim.chunks = chunks;
            claim.dimension = dimA;
            claim.corners = new String[] {
                    a.getX() + "," + a.getY() + "," + a.getZ(),
                    b.getX() + "," + b.getY() + "," + b.getZ()
            };

            addClaim(claim);

            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0F, 1.0F);
            if (!hasExistingClaim) {
                player.sendSystemMessage(Component.literal("§b[Craft-Core] §a首塊初始領地建立成功！（新手特權：免收費用）"));
            } else {
                player.sendSystemMessage(Component.literal(String.format("§b[Craft-Core] §a領地購買成功！扣除 $%s 元。", String.format("%.1f", cost))));
            }

            // Clear temporary selection cache
            playerCornerA.remove(username);
            playerCornerB.remove(username);
            playerCornerADim.remove(username);
            playerCornerBDim.remove(username);
            return 1;
        }

        player.sendSystemMessage(Component.literal("§c[Craft-Core] 購買失敗，請重試。"));
        return 0;
    }

    public static Claim getClaimAt(BlockPos pos, Level world) {
        String dim = world.dimension().identifier().toString();
        int px = pos.getX();
        int pz = pos.getZ();

        for (Claim claim : claims.values()) {
            if (!claim.dimension.equals(dim)) continue;
            String[] corners = claim.corners;
            if (corners.length < 2) continue;

            String[] c1 = corners[0].split(",");
            String[] c2 = corners[1].split(",");
            if (c1.length < 3 || c2.length < 3) continue;

            int x1 = Integer.parseInt(c1[0]);
            int z1 = Integer.parseInt(c1[2]);
            int x2 = Integer.parseInt(c2[0]);
            int z2 = Integer.parseInt(c2[2]);

            int minX = Math.min(x1, x2);
            int maxX = Math.max(x1, x2);
            int minZ = Math.min(z1, z2);
            int maxZ = Math.max(z1, z2);

            if (px >= minX && px <= maxX && pz >= minZ && pz <= maxZ) {
                return claim;
            }
        }
        return null;
    }

    public static boolean checkPermission(ServerPlayer player, BlockPos pos, Level world, String type) {
        Claim claim = getClaimAt(pos, world);
        if (claim == null) return true; // Unclaimed

        String username = player.getName().getString();
        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
        if (claim.owner.equalsIgnoreCase(username) || isOp) return true; // Owner or OP bypass

        // Check public flags
        if ("containers".equalsIgnoreCase(type) && claim.public_containers) {
            return true;
        }
        if ("interact".equalsIgnoreCase(type) && claim.public_interact) {
            return true;
        }

        List<String> allowed = null;
        if ("build".equalsIgnoreCase(type)) {
            allowed = claim.permissions.build;
        } else if ("break".equalsIgnoreCase(type)) {
            allowed = claim.permissions.breakBlocks;
        } else if ("containers".equalsIgnoreCase(type)) {
            allowed = claim.permissions.containers;
        } else if ("interact".equalsIgnoreCase(type)) {
            allowed = claim.permissions.interact;
        }

        return allowed != null && (allowed.contains(username) || allowed.contains("*"));
    }

    public static boolean checkEntryPermission(ServerPlayer player, BlockPos pos, Level world) {
        Claim claim = getClaimAt(pos, world);
        if (claim == null) return true;

        String username = player.getName().getString();
        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
        if (claim.owner.equalsIgnoreCase(username) || isOp) return true;

        // Check if explicitly banned
        if (claim.banned_players != null) {
            for (String b : claim.banned_players) {
                if (b.equalsIgnoreCase(username)) return false;
            }
        }

        // If public_entry is false, must be in member lists
        if (!claim.public_entry) {
            boolean isMember = (claim.permissions.build != null && claim.permissions.build.contains(username))
                    || (claim.permissions.breakBlocks != null && claim.permissions.breakBlocks.contains(username))
                    || (claim.permissions.containers != null && claim.permissions.containers.contains(username))
                    || (claim.permissions.interact != null && claim.permissions.interact.contains(username));
            if (!isMember) return false;
        }

        return true;
    }

    private static final Map<String, Long> lastEntryWarningTime = new ConcurrentHashMap<>();

    public static void registerEvents() {
        ServerTickEvents.END_SERVER_TICK.register(server -> {
            long now = System.currentTimeMillis();
            for (ServerPlayer player : server.getPlayerList().getPlayers()) {
                BlockPos pos = player.blockPosition();
                Level world = player.level();
                if (!checkEntryPermission(player, pos, world)) {
                    Claim claim = getClaimAt(pos, world);
                    String claimName = claim != null ? (claim.name != null ? claim.name : claim.id) : "此領地";
                    String username = player.getName().getString();

                    // Push player back
                    Vec3 motion = player.getDeltaMovement();
                    player.setDeltaMovement(new Vec3(-motion.x * 1.5, 0.35, -motion.z * 1.5));
                    player.hurtMarked = true;

                    // Alert player once per 3 seconds
                    Long lastAlert = lastEntryWarningTime.get(username);
                    if (lastAlert == null || (now - lastAlert) > 3000) {
                        lastEntryWarningTime.put(username, now);
                        player.sendSystemMessage(Component.literal("§c[領地系統] 🚫 你已被禁止進入 [" + claimName + "]！"));
                        player.connection.send(new ClientboundSetTitleTextPacket(Component.literal("§c§l🚫 禁止進入！")));
                        player.connection.send(new ClientboundSetSubtitleTextPacket(Component.literal("§e你已被禁止進入領地 [" + claimName + "]")));
                    }
                }
            }
        });
    }
}
