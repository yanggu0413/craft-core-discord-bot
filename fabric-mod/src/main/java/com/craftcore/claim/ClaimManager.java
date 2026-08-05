package com.craftcore.claim;

import com.craftcore.economy.EconomyManager;
import com.craftcore.util.AsyncSaveExecutor;
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
        public boolean explosion_protection = true;
        public boolean pvp = false;
        public boolean mob_spawn = false;
        public List<String> banned_players = new ArrayList<>();
        public Permissions permissions = new Permissions();

        public transient int minX, maxX, minZ, maxZ;
        public transient boolean boundsParsed = false;

        public void parseBoundsIfNeeded() {
            if (boundsParsed) return;
            if (corners != null && corners.length >= 2) {
                try {
                    String[] c1 = corners[0].split(",");
                    String[] c2 = corners[1].split(",");
                    if (c1.length >= 3 && c2.length >= 3) {
                        int x1 = Integer.parseInt(c1[0].trim());
                        int z1 = Integer.parseInt(c1[2].trim());
                        int x2 = Integer.parseInt(c2[0].trim());
                        int z2 = Integer.parseInt(c2[2].trim());
                        this.minX = Math.min(x1, x2);
                        this.maxX = Math.max(x1, x2);
                        this.minZ = Math.min(z1, z2);
                        this.maxZ = Math.max(z1, z2);
                        this.boundsParsed = true;
                    }
                } catch (Exception ignored) {}
            }
        }

        public String getId() {
            return id;
        }

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
    private static final Map<String, List<Claim>> chunkToClaimsMap = new ConcurrentHashMap<>();

    // Temporary player selection cache
    public static final Map<String, BlockPos> playerCornerA = new ConcurrentHashMap<>();
    public static final Map<String, BlockPos> playerCornerB = new ConcurrentHashMap<>();
    public static final Map<String, String> playerCornerADim = new ConcurrentHashMap<>();
    public static final Map<String, String> playerCornerBDim = new ConcurrentHashMap<>();

    public static class TransferRequest {
        public String fromPlayer;
        public String toPlayer;
        public String claimId;
        public String claimName;
        public long timestamp;

        public TransferRequest(String fromPlayer, String toPlayer, String claimId, String claimName) {
            this.fromPlayer = fromPlayer;
            this.toPlayer = toPlayer;
            this.claimId = claimId;
            this.claimName = claimName;
            this.timestamp = System.currentTimeMillis();
        }
    }

    private static final Map<String, TransferRequest> pendingTransfers = new ConcurrentHashMap<>();

    public static void addTransferRequest(String fromPlayer, String toPlayer, String claimId, String claimName) {
        pendingTransfers.put(toPlayer.toLowerCase(), new TransferRequest(fromPlayer, toPlayer, claimId, claimName));
    }

    public static TransferRequest getTransferRequest(String toPlayer) {
        TransferRequest req = pendingTransfers.get(toPlayer.toLowerCase());
        if (req != null && System.currentTimeMillis() - req.timestamp > 120000) {
            pendingTransfers.remove(toPlayer.toLowerCase());
            return null;
        }
        return req;
    }

    public static void removeTransferRequest(String toPlayer) {
        pendingTransfers.remove(toPlayer.toLowerCase());
    }

    public static boolean transferClaim(String claimId, String newOwner) {
        Claim claim = claims.get(claimId);
        if (claim == null) return false;
        claim.owner = newOwner;
        save();
        return true;
    }

    private static Path hudPrefsPath;
    private static final Map<UUID, Boolean> playerHudPrefs = new ConcurrentHashMap<>();
    private static int tickCounter = 0;

    static {
        try {
            configPath = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir()
                    .resolve("craft-core-shop").resolve("claims.json");
            hudPrefsPath = configPath.getParent().resolve("claim_hud.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "claims.json");
            hudPrefsPath = Path.of("config", "craft-core-shop", "claim_hud.json");
        }
        load();
        loadHudPrefs();
    }

    public static synchronized void loadHudPrefs() {
        if (hudPrefsPath != null && Files.exists(hudPrefsPath)) {
            try (BufferedReader reader = Files.newBufferedReader(hudPrefsPath)) {
                Map<String, Boolean> map = GSON.fromJson(reader, new TypeToken<Map<String, Boolean>>(){}.getType());
                if (map != null) {
                    playerHudPrefs.clear();
                    for (Map.Entry<String, Boolean> entry : map.entrySet()) {
                        try {
                            playerHudPrefs.put(UUID.fromString(entry.getKey()), entry.getValue());
                        } catch (Exception ignored) {}
                    }
                }
            } catch (Exception e) {
                System.err.println("[CraftCore] Failed to load claim_hud.json: " + e.getMessage());
            }
        }
    }

    public static synchronized void saveHudPrefs() {
        Map<String, Boolean> map = new ConcurrentHashMap<>();
        for (Map.Entry<UUID, Boolean> entry : playerHudPrefs.entrySet()) {
            map.put(entry.getKey().toString(), entry.getValue());
        }
        AsyncSaveExecutor.submit(() -> {
            if (hudPrefsPath != null) {
                try {
                    Files.createDirectories(hudPrefsPath.getParent());
                    try (BufferedWriter writer = Files.newBufferedWriter(hudPrefsPath)) {
                        GSON.toJson(map, writer);
                    }
                } catch (Exception e) {
                    System.err.println("[CraftCore] Failed to save claim_hud.json: " + e.getMessage());
                }
            }
        });
    }

    public static boolean isHudEnabled(UUID uuid) {
        return playerHudPrefs.getOrDefault(uuid, true);
    }

    public static boolean toggleHud(UUID uuid) {
        boolean next = !isHudEnabled(uuid);
        playerHudPrefs.put(uuid, next);
        saveHudPrefs();
        return next;
    }

    public static boolean isEmpty() {
        return claims.isEmpty();
    }

    public static synchronized void rebuildChunkIndex() {
        chunkToClaimsMap.clear();
        for (Claim claim : claims.values()) {
            claim.parseBoundsIfNeeded();
            if (!claim.boundsParsed) continue;
            int minChunkX = claim.minX >> 4;
            int maxChunkX = claim.maxX >> 4;
            int minChunkZ = claim.minZ >> 4;
            int maxChunkZ = claim.maxZ >> 4;

            for (int cx = minChunkX; cx <= maxChunkX; cx++) {
                for (int cz = minChunkZ; cz <= maxChunkZ; cz++) {
                    String key = claim.dimension + ":" + cx + "," + cz;
                    chunkToClaimsMap.computeIfAbsent(key, k -> new ArrayList<>()).add(claim);
                }
            }
        }
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Map<String, Claim> loaded = GSON.fromJson(reader, new TypeToken<Map<String, Claim>>(){}.getType());
                if (loaded != null) {
                    for (Claim c : loaded.values()) {
                        if (c.permissions == null) c.permissions = new Claim.Permissions();
                        if (c.banned_players == null) c.banned_players = new ArrayList<>();
                    }
                    claims.clear();
                    claims.putAll(loaded);
                    rebuildChunkIndex();
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load claims: " + e.getMessage());
            }
        }
    }

    public static void save() {
        Map<String, Claim> snapshot = new ConcurrentHashMap<>(claims);
        AsyncSaveExecutor.submit(() -> {
            if (configPath != null) {
                try {
                    Files.createDirectories(configPath.getParent());
                    try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                        GSON.toJson(snapshot, writer);
                    }
                } catch (IOException e) {
                    System.err.println("[CraftCore] Failed to save claims: " + e.getMessage());
                }
            }
        });
    }

    public static synchronized List<Claim> getClaims() {
        return new ArrayList<>(claims.values());
    }

    public static synchronized List<Claim> getPlayerClaims(String username) {
        List<Claim> list = new ArrayList<>();
        for (Claim c : claims.values()) {
            if (c.owner != null && c.owner.equalsIgnoreCase(username)) {
                list.add(c);
            }
        }
        return list;
    }

    public static synchronized Claim getClaim(String id) {
        return claims.get(id);
    }

    public static synchronized void addClaim(Claim claim) {
        claims.put(claim.id, claim);
        rebuildChunkIndex();
        save();
    }

    public static synchronized void removeClaim(String id) {
        claims.remove(id);
        rebuildChunkIndex();
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

    public static boolean doesIntersect(BlockPos a, BlockPos b, String dim, Claim existingClaim) {
        if (!existingClaim.dimension.equalsIgnoreCase(dim)) return false;
        existingClaim.parseBoundsIfNeeded();
        if (!existingClaim.boundsParsed) return false;

        int newMinX = Math.min(a.getX(), b.getX());
        int newMaxX = Math.max(a.getX(), b.getX());
        int newMinZ = Math.min(a.getZ(), b.getZ());
        int newMaxZ = Math.max(a.getZ(), b.getZ());

        boolean overlapX = newMinX <= existingClaim.maxX && newMaxX >= existingClaim.minX;
        boolean overlapZ = newMinZ <= existingClaim.maxZ && newMaxZ >= existingClaim.minZ;

        return overlapX && overlapZ;
    }

    private static void checkSelection(ServerPlayer player, String username) {
        BlockPos a = playerCornerA.get(username);
        BlockPos b = playerCornerB.get(username);
        String dimA = playerCornerADim.get(username);
        String dimB = playerCornerBDim.get(username);

        if (a != null && b != null && dimA != null && dimB != null) {
            if (!dimA.equalsIgnoreCase(dimB)) {
                player.sendSystemMessage(Component.literal("§c[Craft-Core] 劃分領地失敗：角落 A (" + dimA + ") 與角落 B (" + dimB + ") 屬於不同的維度！"));
                return;
            }
            int chunks = calculateChunks(a, b);
            boolean hasExistingClaim = claims.values().stream().anyMatch(c -> c.owner.equalsIgnoreCase(username));
            double cost = hasExistingClaim ? (chunks * 30.0) : 0.0;
            if (!hasExistingClaim) {
                player.sendSystemMessage(Component.literal(String.format("§b[Craft-Core] §f選取區域跨越了 %d 個區塊 (Chunk)。§a【新手特權】首塊初始領地免費 (上限16區塊)！§f- 請輸入 §a/claim§f 進行確認建立。", chunks)));
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

        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);

        // 0. Disable Claims in Mining & Fishing Dimensions
        if (dimA.contains("craftcore:mining") || dimA.contains("craftcore:fishing")) {
            player.sendSystemMessage(Component.literal("§c[專屬維度保護] 釣魚世界與採礦世界專供全服自由活動，禁止劃分領地！"));
            return 0;
        }

        // 1. World Spawn Protection Radius (150 blocks from 0,0 in Overworld)
        if (dimA.equalsIgnoreCase("minecraft:overworld") && !isOp) {
            int minX = Math.min(a.getX(), b.getX());
            int maxX = Math.max(a.getX(), b.getX());
            int minZ = Math.min(a.getZ(), b.getZ());
            int maxZ = Math.max(a.getZ(), b.getZ());
            if (minX <= 150 && maxX >= -150 && minZ <= 150 && maxZ >= -150) {
                player.sendSystemMessage(Component.literal("§c[Craft-Core] 劃定失敗：該區域包含伺服器重生點保護範圍 (150 格)，禁止私人圈地！"));
                return 0;
            }
        }

        int chunks = calculateChunks(a, b);
        boolean hasExistingClaim = claims.values().stream().anyMatch(c -> c.owner.equalsIgnoreCase(username));

        // 2. Chunk Limit Restrictions
        if (!hasExistingClaim && chunks > 16 && !isOp) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 劃定失敗：首塊免費初始領地最大限制為 16 個區塊 (4x4 Chunk)！請縮小選取範圍。"));
            return 0;
        }
        if (chunks > 64 && !isOp) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 劃定失敗：單個領地最大上限為 64 個區塊 (8x8 Chunk)！"));
            return 0;
        }

        // 3. Overlap Check against ALL existing claims
        for (Claim existing : claims.values()) {
            if (doesIntersect(a, b, dimA, existing)) {
                player.sendSystemMessage(Component.literal("§c[Craft-Core] 劃定失敗：選取區域與玩家 §e" + existing.owner + " §c的領地重疊！"));
                return 0;
            }
        }

        double cost = (hasExistingClaim && !isOp) ? (chunks * 30.0) : 0.0;
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
        if (claims.isEmpty() || pos == null || world == null) return null;
        String dim = world.dimension().identifier().toString();
        int px = pos.getX();
        int pz = pos.getZ();
        int cx = px >> 4;
        int cz = pz >> 4;

        String key = dim + ":" + cx + "," + cz;
        List<Claim> list = chunkToClaimsMap.get(key);
        if (list != null && !list.isEmpty()) {
            for (Claim claim : list) {
                if (px >= claim.minX && px <= claim.maxX && pz >= claim.minZ && pz <= claim.maxZ) {
                    return claim;
                }
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
        net.fabricmc.fabric.api.event.player.AttackEntityCallback.EVENT.register((player, world, hand, entity, hitResult) -> {
            if (!world.isClientSide() && player instanceof ServerPlayer sp) {
                if (entity instanceof ServerPlayer targetPlayer) {
                    String attackerName = sp.getName().getString();
                    String victimName = targetPlayer.getName().getString();
                    if (!com.craftcore.pvp.PvpManager.isPvpEnabled(attackerName)) {
                        sp.sendSystemMessage(Component.literal("§c[PvP] 無法攻擊！你目前已關閉 PvP 模式 (/pvp)。"));
                        return net.minecraft.world.InteractionResult.FAIL;
                    }
                    if (!com.craftcore.pvp.PvpManager.isPvpEnabled(victimName)) {
                        sp.sendSystemMessage(Component.literal("§c[PvP] 無法攻擊！目標玩家 §e" + victimName + " §c已關閉 PvP 模式 (/pvp)。"));
                        return net.minecraft.world.InteractionResult.FAIL;
                    }
                }
                if (entity instanceof net.minecraft.world.entity.decoration.HangingEntity || entity instanceof net.minecraft.world.entity.decoration.ArmorStand) {
                    BlockPos pos = entity.blockPosition();
                    if (!checkPermission(sp, pos, world, "break") && !checkPermission(sp, pos, world, "interact")) {
                        sp.sendSystemMessage(Component.literal("§c[Craft-Core] 您在此領地沒有操作實體的權限！"));
                        return net.minecraft.world.InteractionResult.FAIL;
                    }
                }
            }
            return net.minecraft.world.InteractionResult.PASS;
        });

        net.fabricmc.fabric.api.event.player.UseEntityCallback.EVENT.register((player, world, hand, entity, hitResult) -> {
            if (!world.isClientSide() && player instanceof ServerPlayer sp) {
                if (entity instanceof net.minecraft.world.entity.decoration.HangingEntity || entity instanceof net.minecraft.world.entity.decoration.ArmorStand) {
                    BlockPos pos = entity.blockPosition();
                    if (!checkPermission(sp, pos, world, "interact")) {
                        sp.sendSystemMessage(Component.literal("§c[Craft-Core] 您在此領地沒有操作實體的權限！"));
                        return net.minecraft.world.InteractionResult.FAIL;
                    }
                }
            }
            return net.minecraft.world.InteractionResult.PASS;
        });

        ServerTickEvents.END_SERVER_TICK.register(server -> {
            long now = System.currentTimeMillis();
            tickCounter++;
            boolean isTick10 = (tickCounter % 10 == 0);

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

                // Render ActionBar Claim HUD (if enabled by player)
                if (isTick10 && isHudEnabled(player.getUUID())) {
                    Claim claim = getClaimAt(pos, world);
                    if (claim != null) {
                        String claimName = claim.name != null ? claim.name : claim.id;
                        String ownerStr = claim.owner != null ? claim.owner : "未知";
                        player.sendSystemMessage(
                            Component.literal("§e❖ 當前領地: §f[" + claimName + "] §7| §e領主: §f" + ownerStr + " §7(§a保護中§7)"),
                            true
                        );
                    } else {
                        player.sendSystemMessage(
                            Component.literal("§7❖ 當前地區: 荒野 §7(無領地)"),
                            true
                        );
                    }
                }
            }
        });
    }
}
