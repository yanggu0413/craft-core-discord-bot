package com.craftcore.fish;

import com.craftcore.title.TitleManager;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerBossEvent;
import net.minecraft.server.level.ServerLevel;
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
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.phys.Vec3;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class FishingContestManager {

    public static final ResourceKey<Level> FISHING_DIMENSION_KEY = ResourceKey.create(Registries.DIMENSION, Identifier.parse("craftcore:fishing"));

    public static class CaughtFish {
        public String fisherman;
        public String fishName;
        public double lengthCm;
        public double weightKg;
        public String caughtTime;

        public CaughtFish(String fisherman, String fishName, double lengthCm, double weightKg, String caughtTime) {
            this.fisherman = fisherman;
            this.fishName = fishName;
            this.lengthCm = lengthCm;
            this.weightKg = weightKg;
            this.caughtTime = caughtTime;
        }
    }

    public static class PartyMatch {
        public String hostName;
        public UUID hostUuid;
        public List<UUID> members = new ArrayList<>();
        public Map<UUID, Double> scores = new HashMap<>();
        public boolean active = false;
        public int durationMinutes = 10;
        public long endTime = 0L;
        public ServerBossEvent bossBar;

        public PartyMatch(ServerPlayer host, int durationMinutes) {
            this.hostName = host.getName().getString();
            this.hostUuid = host.getUUID();
            this.durationMinutes = durationMinutes;
            this.members.add(host.getUUID());
            this.scores.put(host.getUUID(), 0.0);
            this.bossBar = new ServerBossEvent(UUID.randomUUID(), Component.literal("§b[釣魚比賽] " + hostName + " 的房間比賽準備中..."), BossEvent.BossBarColor.BLUE, BossEvent.BossBarOverlay.PROGRESS);
            this.bossBar.addPlayer(host);
        }

        public boolean isSolo() {
            return members.size() <= 1;
        }
    }

    private static boolean active = false;
    private static int secondsRemaining = 0;
    private static ScheduledExecutorService scheduler = null;

    private static final Map<UUID, Double> serverScores = new ConcurrentHashMap<>();
    private static final List<CaughtFish> hallOfFame = Collections.synchronizedList(new ArrayList<>());
    private static ServerBossEvent bossBar = null;

    private static final Map<UUID, Long> speedBuffExpirationMap = new ConcurrentHashMap<>();
    private static final Map<UUID, Long> giantFishBuffExpirationMap = new ConcurrentHashMap<>();
    private static final Map<UUID, PartyMatch> partyMatches = new ConcurrentHashMap<>();
    private static final Set<UUID> playersInFishingDimension = ConcurrentHashMap.newKeySet();
    private static final Set<UUID> soloPlayers = ConcurrentHashMap.newKeySet();
    private static final Map<UUID, Double> soloBestScores = new ConcurrentHashMap<>();
    private static final Map<UUID, Integer> soloFishCounts = new ConcurrentHashMap<>();
    private static final Map<UUID, ServerBossEvent> soloBossBars = new ConcurrentHashMap<>();

    public static void tickPlayerBuffs(ServerPlayer player) {
        if (player == null) return;
        UUID uuid = player.getUUID();
        boolean inFishingDim = player.level().dimension().equals(FISHING_DIMENSION_KEY);

        if (inFishingDim) {
            if (player.getY() < -10.0) {
                ServerLevel fishingLevel = (ServerLevel) player.level();
                player.teleportTo(fishingLevel, 0.5, 65.0, 0.5, Set.of(), player.getYRot(), player.getXRot(), false);
                player.playSound(SoundEvents.ENDERMAN_TELEPORT, 1.0f, 1.0f);
                player.sendSystemMessage(Component.literal("§e🕳️ [虛空救援] 意外跌落虛空！已為您安全傳送回釣魚重生平台。"));
            }

            if (!playersInFishingDimension.contains(uuid)) {
                playersInFishingDimension.add(uuid);
                // Apply infinite duration (level 255) status effects ONCE upon entering dimension
                player.addEffect(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.world.effect.MobEffects.REGENERATION, net.minecraft.world.effect.MobEffectInstance.INFINITE_DURATION, 255, false, false, true));
                player.addEffect(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.world.effect.MobEffects.RESISTANCE, net.minecraft.world.effect.MobEffectInstance.INFINITE_DURATION, 255, false, false, true));
                player.addEffect(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.world.effect.MobEffects.FIRE_RESISTANCE, net.minecraft.world.effect.MobEffectInstance.INFINITE_DURATION, 255, false, false, true));
                player.addEffect(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.world.effect.MobEffects.SATURATION, net.minecraft.world.effect.MobEffectInstance.INFINITE_DURATION, 255, false, false, true));
                player.sendSystemMessage(Component.literal("§a✨ [釣魚維度保護] 已進入釣魚專屬維度！自動獲得無限時效 (等級 255) 回復、抗性、抗火與飽食 BUFF！"));
                checkAndGiveStarterRod(player);

                if (soloPlayers.contains(uuid)) {
                    ServerBossEvent soloBar = soloBossBars.get(uuid);
                    if (soloBar != null && !soloBar.getPlayers().contains(player)) {
                        soloBar.addPlayer(player);
                    }
                } else if (active && bossBar != null && !bossBar.getPlayers().contains(player)) {
                    bossBar.addPlayer(player);
                }
            }
        } else {
            if (playersInFishingDimension.contains(uuid)) {
                playersInFishingDimension.remove(uuid);
                // Clear the 4 dimension status effects when leaving
                player.removeEffect(net.minecraft.world.effect.MobEffects.REGENERATION);
                player.removeEffect(net.minecraft.world.effect.MobEffects.RESISTANCE);
                player.removeEffect(net.minecraft.world.effect.MobEffects.FIRE_RESISTANCE);
                player.removeEffect(net.minecraft.world.effect.MobEffects.SATURATION);
                player.sendSystemMessage(Component.literal("§e[釣魚維度保護] 已離開釣魚維度，自動清除維度專屬 BUFF。"));

                // AUTOMATICALLY REMOVE PLAYER FROM ALL BOSSBARS WHEN LEAVING DIMENSION
                if (bossBar != null) {
                    bossBar.removePlayer(player);
                }
                for (PartyMatch match : partyMatches.values()) {
                    if (match.bossBar != null) {
                        match.bossBar.removePlayer(player);
                    }
                }
                ServerBossEvent soloBar = soloBossBars.get(uuid);
                if (soloBar != null) {
                    soloBar.removePlayer(player);
                }
            }
        }
    }

    public static void checkAndGiveStarterRod(ServerPlayer player) {
        if (player == null) return;
        boolean hasRod = false;
        for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
            ItemStack stack = player.getInventory().getItem(i);
            if (!stack.isEmpty() && stack.is(Items.FISHING_ROD)) {
                hasRod = true;
                break;
            }
        }

        if (!hasRod) {
            ItemStack rod = new ItemStack(Items.FISHING_ROD);
            rod.set(DataComponents.CUSTOM_NAME, Component.literal("§b🎣 釣魚大都會 - 幸運釣竿"));
            rod.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
            rod.set(DataComponents.LORE, new ItemLore(List.of(
                    Component.literal("§7系統免費贈送的新手專用釣竿"),
                    Component.literal("§7於 craftcore:fishing 專屬釣魚維度垂釣"),
                    Component.literal(""),
                    Component.literal("§a[幸運釣手專屬裝備]")
            )));

            player.getInventory().add(rod);
            player.sendSystemMessage(Component.literal("§a🎁 [釣魚好禮] 歡迎來到釣魚維度！檢測到您未攜帶釣竿，系統已自動為您發放【🎣 幸運釣竿】！"));
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 1.0f, 1.2f);
        }
    }

    public static boolean isContestActive() {
        return active;
    }

    public static boolean isActive() {
        return active;
    }

    public static int getSecondsRemaining() {
        return secondsRemaining;
    }

    public static Map<UUID, Double> getCurrentContestBestMap() {
        return serverScores;
    }

    public static List<Map.Entry<UUID, Double>> getCurrentTopFishList() {
        return serverScores.entrySet().stream()
                .sorted(Map.Entry.<UUID, Double>comparingByValue().reversed())
                .toList();
    }

    public static List<CaughtFish> getHallOfFame() {
        return hallOfFame;
    }

    public static ResourceKey<Level> getFishingDimensionKey() {
        return FISHING_DIMENSION_KEY;
    }

    // Teleport to craftcore:fishing dimension
    public static void teleportToFishingDimension(ServerPlayer player) {
        if (player == null) return;
        MinecraftServer server = player.level().getServer();
        if (server == null) return;

        ServerLevel fishingLevel = server.getLevel(FISHING_DIMENSION_KEY);
        if (fishingLevel == null) {
            for (ServerLevel sl : server.getAllLevels()) {
                if (sl.dimension().identifier().toString().equals("craftcore:fishing")) {
                    fishingLevel = sl;
                    break;
                }
            }
        }

        if (fishingLevel == null) {
            player.sendSystemMessage(Component.literal("§c[釣魚系統] 釣魚維度 craftcore:fishing 正在加載中，請稍後再試！"));
            return;
        }

        // Ensure safe spawn platform at (0, 64, 0)
        net.minecraft.core.BlockPos center = new net.minecraft.core.BlockPos(0, 64, 0);
        if (fishingLevel.getBlockState(center).isAir()) {
            for (int x = -2; x <= 2; x++) {
                for (int z = -2; z <= 2; z++) {
                    fishingLevel.setBlock(new net.minecraft.core.BlockPos(x, 64, z), Blocks.SMOOTH_QUARTZ.defaultBlockState(), 3);
                }
            }
            // Add water pool for fishing testing around platform
            for (int x = -5; x <= 5; x++) {
                for (int z = 3; z <= 8; z++) {
                    fishingLevel.setBlock(new net.minecraft.core.BlockPos(x, 64, z), Blocks.WATER.defaultBlockState(), 3);
                    fishingLevel.setBlock(new net.minecraft.core.BlockPos(x, 63, z), Blocks.PRISMARINE.defaultBlockState(), 3);
                }
            }
        }

        player.teleportTo(fishingLevel, 0.5, 65.0, 0.5, Set.of(), player.getYRot(), player.getXRot(), false);
        player.playSound(SoundEvents.ENDERMAN_TELEPORT, 1.0f, 1.0f);
        player.sendSystemMessage(Component.literal("§a🌊 [釣魚大廳] 成功傳送至專屬釣魚虛空維度 (craftcore:fishing)！"));
    }

    public static void startLoop(MinecraftServer server) {
        if (scheduler != null && !scheduler.isShutdown()) return;
        scheduler = Executors.newSingleThreadScheduledExecutor();

        bossBar = new ServerBossEvent(UUID.randomUUID(), Component.literal("§b[釣魚大賽] 準備中..."), BossEvent.BossBarColor.BLUE, BossEvent.BossBarOverlay.PROGRESS);

        scheduler.scheduleAtFixedRate(() -> {
            try {
                ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Taipei"));
                if (now.getHour() == 20 && now.getMinute() == 0 && now.getSecond() < 5 && !active) {
                    if (server != null) {
                        server.execute(() -> startContest(server, 20));
                    }
                }
            } catch (Throwable t) {
                System.err.println("[CraftCore] Error in FishingContest timer loop: " + t.getMessage());
            }
        }, 0, 5, TimeUnit.SECONDS);

        scheduler.scheduleAtFixedRate(() -> {
            try {
                if (active && secondsRemaining > 0) {
                    secondsRemaining--;
                    if (server != null) {
                        server.execute(() -> updateBossBar(server));
                    }
                    if (secondsRemaining <= 0) {
                        if (server != null) {
                            server.execute(() -> stopContest(server));
                        }
                    }
                }

                // Tick party matches
                for (PartyMatch match : partyMatches.values()) {
                    if (match.active) {
                        long left = (match.endTime - System.currentTimeMillis()) / 1000;
                        if (left <= 0) {
                            endPartyMatch(match, server);
                        } else {
                            updatePartyBossBar(match, server, (int) left);
                        }
                    }
                }
            } catch (Throwable t) {
                System.err.println("[CraftCore] Error in FishingContest countdown loop: " + t.getMessage());
            }
        }, 1, 1, TimeUnit.SECONDS);
    }

    public static synchronized void startContest(MinecraftServer server, int minutes) {
        active = true;
        secondsRemaining = minutes * 60;
        serverScores.clear();

        bossBar.setName(Component.literal("§b🎣 [全服釣魚大賽] 進行中！倒數: " + minutes + " 分鐘 | 等待第一條巨魚上鉤！"));
        bossBar.setProgress(1.0f);
        bossBar.setVisible(true);

        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            bossBar.addPlayer(player);
        }

        String broadcastMsg = String.format("§b🎉 [全服通告] 每日 20:00 全服釣魚大賽正式開始！限時 %d 分鐘！請輸入 /fish tp 前往釣魚維度挑戰釣起全服最大巨魚！", minutes);
        server.getPlayerList().broadcastSystemMessage(Component.literal(broadcastMsg), false);
    }

    public static synchronized void stopContest(MinecraftServer server) {
        if (!active) return;
        active = false;
        secondsRemaining = 0;

        if (bossBar != null) {
            bossBar.setVisible(false);
            bossBar.removeAllPlayers();
        }

        server.getPlayerList().broadcastSystemMessage(Component.literal("§b🏁 [釣魚大賽] 比賽時間結束！正在結算全服排名..."), false);
        settleRewards(server);
    }

    private static void updateBossBar(MinecraftServer server) {
        if (bossBar == null || !active) return;

        int min = secondsRemaining / 60;
        int sec = secondsRemaining % 60;

        String leaderStr = "尚無紀錄";
        if (!serverScores.isEmpty()) {
            Map.Entry<UUID, Double> top = serverScores.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .orElse(null);
            if (top != null) {
                ServerPlayer topPlayer = server.getPlayerList().getPlayer(top.getKey());
                String name = (topPlayer != null) ? topPlayer.getName().getString() : "未知選手";
                leaderStr = String.format("%s (%.1f cm)", name, top.getValue());
            }
        }

        bossBar.setName(Component.literal(String.format("§b🎣 [釣魚大賽] 倒數: %02d:%02d | 👑 當前第一: §e%s", min, sec, leaderStr)));
        bossBar.setProgress((float) secondsRemaining / 1200.0f);
    }

    // Party Match methods
    public static PartyMatch getPartyMatch(UUID playerUuid) {
        return partyMatches.get(playerUuid);
    }

    public static PartyMatch createPartyMatch(ServerPlayer host, int durationMinutes) {
        PartyMatch match = new PartyMatch(host, durationMinutes);
        partyMatches.put(host.getUUID(), match);
        host.sendSystemMessage(Component.literal("§a[釣魚組隊] 已成功創建房間！人數: 1 人。輸入 /fish party start 即可隨時開始比賽！"));
        return match;
    }

    public static boolean joinPartyMatch(ServerPlayer player, String hostName) {
        for (PartyMatch match : partyMatches.values()) {
            if (match.hostName.equalsIgnoreCase(hostName)) {
                if (!match.members.contains(player.getUUID())) {
                    match.members.add(player.getUUID());
                    match.scores.put(player.getUUID(), 0.0);
                    partyMatches.put(player.getUUID(), match);
                    if (match.bossBar != null) match.bossBar.addPlayer(player);
                    player.sendSystemMessage(Component.literal("§a[釣魚組隊] 成功加入 " + hostName + " 的比賽房間！"));
                    return true;
                }
            }
        }
        player.sendSystemMessage(Component.literal("§c[釣魚組隊] 找不到玩家 " + hostName + " 創建的比賽房間！"));
        return false;
    }

    public static void startPartyMatch(ServerPlayer host) {
        PartyMatch match = partyMatches.get(host.getUUID());
        if (match == null || !match.hostUuid.equals(host.getUUID())) {
            host.sendSystemMessage(Component.literal("§c[釣魚組隊] 您不是房主，無法開啟比賽！"));
            return;
        }
        match.active = true;
        match.endTime = System.currentTimeMillis() + (match.durationMinutes * 60 * 1000L);
        for (UUID memberUuid : match.members) {
            ServerPlayer p = host.level().getServer().getPlayerList().getPlayer(memberUuid);
            if (p != null) {
                p.sendSystemMessage(Component.literal("§b🎉 [釣魚比賽] 房間比賽正式開始！限時 " + match.durationMinutes + " 分鐘！衝刺最大巨魚長度！"));
                p.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.2f);
            }
        }
    }

    private static void updatePartyBossBar(PartyMatch match, MinecraftServer server, int secondsLeft) {
        if (match.bossBar == null) return;
        int min = secondsLeft / 60;
        int sec = secondsLeft % 60;

        String leaderStr = "尚無紀錄";
        if (!match.scores.isEmpty()) {
            Map.Entry<UUID, Double> top = match.scores.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .orElse(null);
            if (top != null && top.getValue() > 0) {
                ServerPlayer topPlayer = server.getPlayerList().getPlayer(top.getKey());
                String name = (topPlayer != null) ? topPlayer.getName().getString() : "未知選手";
                leaderStr = String.format("%s (%.1f cm)", name, top.getValue());
            }
        }

        match.bossBar.setName(Component.literal(String.format("§b🎮 [房間釣魚賽] 剩餘: %02d:%02d | 👑 當前第一: §e%s", min, sec, leaderStr)));
    }

    private static void endPartyMatch(PartyMatch match, MinecraftServer server) {
        match.active = false;
        if (match.bossBar != null) {
            match.bossBar.setVisible(false);
            match.bossBar.removeAllPlayers();
        }

        List<Map.Entry<UUID, Double>> sorted = match.scores.entrySet().stream()
                .filter(e -> e.getValue() > 0)
                .sorted(Map.Entry.<UUID, Double>comparingByValue().reversed())
                .toList();

        for (UUID memberUuid : match.members) {
            partyMatches.remove(memberUuid);
            ServerPlayer p = server.getPlayerList().getPlayer(memberUuid);
            if (p != null) {
                p.sendSystemMessage(Component.literal("§b🏁 [釣魚比賽] 房間比賽時間到！已完美結算！"));
                if (!sorted.isEmpty()) {
                    ServerPlayer winner = server.getPlayerList().getPlayer(sorted.get(0).getKey());
                    String winnerName = winner != null ? winner.getName().getString() : "冠軍";
                    p.sendSystemMessage(Component.literal(String.format("§6🏆 [比賽結果] 冠軍: §e%s §6(%.1f cm)！", winnerName, sorted.get(0).getValue())));
                }
            }
        }
    }

    public static boolean hasSpeedBuff(UUID uuid) {
        Long expire = speedBuffExpirationMap.get(uuid);
        if (expire == null) return false;
        if (System.currentTimeMillis() > expire) {
            speedBuffExpirationMap.remove(uuid);
            return false;
        }
        return true;
    }

    public static boolean applySpeedBuff(ServerPlayer player) {
        if (player == null) return false;
        UUID uuid = player.getUUID();
        if (hasGiantFishBuff(uuid)) {
            player.sendSystemMessage(Component.literal("§c[釣魚大賽] 您目前已擁有【巨魚引力 BUFF】，無法同時疊加多個大賽 BUFF！請等當前 BUFF 結束後再使用。"));
            return false;
        }
        speedBuffExpirationMap.put(uuid, System.currentTimeMillis() + (3 * 60 * 1000));
        player.sendSystemMessage(Component.literal("§a⚡ [釣魚大賽] 您已啟動【急速垂釣 BUFF】！未來 3 分鐘上鉤速度提升 50%！"));
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0f, 1.5f);
        return true;
    }

    public static boolean hasGiantFishBuff(UUID uuid) {
        Long expire = giantFishBuffExpirationMap.get(uuid);
        if (expire == null) return false;
        if (System.currentTimeMillis() > expire) {
            giantFishBuffExpirationMap.remove(uuid);
            return false;
        }
        return true;
    }

    public static boolean applyGiantFishBuff(ServerPlayer player) {
        if (player == null) return false;
        UUID uuid = player.getUUID();
        if (hasSpeedBuff(uuid)) {
            player.sendSystemMessage(Component.literal("§c[釣魚大賽] 您目前已擁有【急速垂釣 BUFF】，無法同時疊加多個大賽 BUFF！請等當前 BUFF 結束後再使用。"));
            return false;
        }
        giantFishBuffExpirationMap.put(uuid, System.currentTimeMillis() + (3 * 60 * 1000));
        player.sendSystemMessage(Component.literal("§6🧲 [釣魚大賽] 您已啟動【巨魚引力 BUFF】！未來 3 分鐘釣起的魚類尺寸增幅 30%~60%！"));
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0f, 1.8f);
        return true;
    }

    public static ItemStack onPlayerCatchFish(ServerPlayer player, ItemStack originalCatch) {
        if (player == null) return originalCatch;
        boolean inFishingDim = player.level().dimension().equals(FISHING_DIMENSION_KEY);

        // User requested: "20:00 大賽期間只有位於 craftcore:fishing 釣魚維度內的玩家才會計分"
        if (!inFishingDim && !active) {
            return originalCatch; // Overworld normal catch
        }

        String username = player.getName().getString();
        PartyMatch match = partyMatches.get(player.getUUID());
        boolean isSoloMode = (match == null || match.isSolo());

        // Tactical item drop chance (20% total chance inside fishing dimension or contest)
        if (Math.random() < 0.20) {
            double itemRoll = Math.random();
            if (itemRoll < 0.35) { // 7% Speed Booster
                ItemStack booster = new ItemStack(Items.PRISMARINE_CRYSTALS);
                booster.set(DataComponents.CUSTOM_NAME, Component.literal("§a⚡ 釣魚大賽加速器"));
                booster.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
                booster.set(DataComponents.LORE, new ItemLore(List.of(
                        Component.literal("§7手持右鍵使用，啟動 3 分鐘【急速垂釣 BUFF】"),
                        Component.literal("§7期間釣魚上鉤等待時間減少 50%！"),
                        Component.literal(""),
                        Component.literal("§e[手持右鍵開啟 BUFF]")
                )));
                player.sendSystemMessage(Component.literal("§6🎉 [釣魚大賽] 幸運釣獲戰術道具：【⚡ 釣魚大賽加速器】！手持右鍵即可使用！"));
                player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 1.0f, 1.2f);
                return booster;
            } else if (itemRoll < 0.60) { // 5% Giant Fish Magnet
                ItemStack magnet = new ItemStack(Items.HEART_OF_THE_SEA);
                magnet.set(DataComponents.CUSTOM_NAME, Component.literal("§6🧲 釣魚大賽巨魚磁鐵"));
                magnet.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
                magnet.set(DataComponents.LORE, new ItemLore(List.of(
                        Component.literal("§7手持右鍵使用，啟動 3 分鐘【巨魚引力 BUFF】"),
                        Component.literal("§7期間釣起的魚類尺寸額外增加 +30%~60%！"),
                        Component.literal(""),
                        Component.literal("§e[手持右鍵開啟 BUFF]")
                )));
                player.sendSystemMessage(Component.literal("§6🎉 [釣魚大賽] 幸運釣獲戰術道具：【🧲 釣魚大賽巨魚磁鐵】！手持右鍵即可使用！"));
                player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 1.0f, 1.2f);
                return magnet;
            } else if (!isSoloMode && itemRoll < 0.75) { // 3% Length Thief (Only in multiplayer mode)
                ItemStack trident = new ItemStack(Items.TRIDENT);
                trident.set(DataComponents.CUSTOM_NAME, Component.literal("§b🗡 釣魚大賽長度偷取器"));
                trident.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
                trident.set(DataComponents.LORE, new ItemLore(List.of(
                        Component.literal("§7手持右鍵開啟玩家選單，選擇對手偷取長度！"),
                        Component.literal("§7隨機強奪目標當前最高長度的 1% ~ 30% 併入自己！"),
                        Component.literal(""),
                        Component.literal("§e[手持右鍵選擇打擊對手]")
                )));
                player.sendSystemMessage(Component.literal("§6🎉 [釣魚大賽] 幸運釣獲戰術道具：【🗡 釣魚大賽長度偷取器】！"));
                player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 1.0f, 1.2f);
                return trident;
            } else if (!isSoloMode && itemRoll < 0.85) { // 2% Length Swapper (Only in multiplayer mode)
                ItemStack star = new ItemStack(Items.NETHER_STAR);
                star.set(DataComponents.CUSTOM_NAME, Component.literal("§d🔄 釣魚大賽長度交換器"));
                star.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
                star.set(DataComponents.LORE, new ItemLore(List.of(
                        Component.literal("§7手持右鍵開啟玩家選單，選擇對手交換長度！"),
                        Component.literal("§7直接與指定對手強制對調目前的最高紀錄長度！"),
                        Component.literal(""),
                        Component.literal("§e[手持右鍵選擇交換目標]")
                )));
                player.sendSystemMessage(Component.literal("§6🎉 [釣魚大賽] 幸運釣獲戰術道具：【🔄 釣魚大賽長度交換器】！"));
                player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 1.0f, 1.2f);
                return star;
            } else { // Trap Bomb
                player.sendSystemMessage(Component.literal("§c💥 [釣魚陷阱！] 糟糕！您鉤中了【💣 詛咒陷阱彈】！爆破扣除您當前最高紀錄長度 5%~15%！"));
                player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.GENERIC_EXPLODE, SoundSource.PLAYERS, 1.0f, 1.0f);
                applyTrapPenalty(player);
                return new ItemStack(Items.TNT);
            }
        }

        // Generate Fantasy NBT Fish
        int index = (int) (Math.random() * 20);
        String fishName;
        Item itemType;
        double lengthCm;
        double weightKg;

        switch (index) {
            case 0 -> { fishName = "遠古巨齒鯊幼崽"; itemType = Items.TROPICAL_FISH; lengthCm = 150.0 + Math.random() * 100.0; weightKg = 80.0 + Math.random() * 70.0; }
            case 1 -> { fishName = "深淵紫焰海龍"; itemType = Items.PUFFERFISH; lengthCm = 120.0 + Math.random() * 90.0; weightKg = 50.0 + Math.random() * 60.0; }
            case 2 -> { fishName = "炫彩幻光水母"; itemType = Items.SALMON; lengthCm = 80.0 + Math.random() * 70.0; weightKg = 20.0 + Math.random() * 30.0; }
            case 3 -> { fishName = "黃金璀璨大旗魚"; itemType = Items.COD; lengthCm = 140.0 + Math.random() * 110.0; weightKg = 70.0 + Math.random() * 80.0; }
            case 4 -> { fishName = "翡翠毒刺河豚"; itemType = Items.PUFFERFISH; lengthCm = 40.0 + Math.random() * 45.0; weightKg = 10.0 + Math.random() * 15.0; }
            case 5 -> { fishName = "烈焰熔岩翻車魚"; itemType = Items.COOKED_SALMON; lengthCm = 130.0 + Math.random() * 90.0; weightKg = 90.0 + Math.random() * 110.0; }
            case 6 -> { fishName = "雷霆電擊大鯰魚"; itemType = Items.COOKED_COD; lengthCm = 110.0 + Math.random() * 70.0; weightKg = 40.0 + Math.random() * 50.0; }
            case 7 -> { fishName = "冰霜晶鑽珍珠魚"; itemType = Items.TROPICAL_FISH; lengthCm = 60.0 + Math.random() * 50.0; weightKg = 15.0 + Math.random() * 20.0; }
            case 8 -> { fishName = "幽靈鬼魅赤魟"; itemType = Items.SALMON; lengthCm = 95.0 + Math.random() * 65.0; weightKg = 30.0 + Math.random() * 40.0; }
            case 9 -> { fishName = "泰坦霸王海怪幼體"; itemType = Items.COD; lengthCm = 180.0 + Math.random() * 120.0; weightKg = 120.0 + Math.random() * 130.0; }
            case 10 -> { fishName = "翡翠珍珠龍吐珠"; itemType = Items.TROPICAL_FISH; lengthCm = 70.0 + Math.random() * 40.0; weightKg = 18.0 + Math.random() * 15.0; }
            case 11 -> { fishName = "暗黑吞噬大王烏賊"; itemType = Items.PUFFERFISH; lengthCm = 160.0 + Math.random() * 100.0; weightKg = 100.0 + Math.random() * 90.0; }
            case 12 -> { fishName = "星空幻影蝶魚"; itemType = Items.TROPICAL_FISH; lengthCm = 50.0 + Math.random() * 35.0; weightKg = 8.0 + Math.random() * 12.0; }
            case 13 -> { fishName = "王者金鱗大錦鯉"; itemType = Items.COD; lengthCm = 90.0 + Math.random() * 60.0; weightKg = 25.0 + Math.random() * 35.0; }
            case 14 -> { fishName = "寒冰藍霜大馬哈魚"; itemType = Items.SALMON; lengthCm = 105.0 + Math.random() * 55.0; weightKg = 35.0 + Math.random() * 45.0; }
            case 15 -> { fishName = "紫晶幻夢海馬"; itemType = Items.TROPICAL_FISH; lengthCm = 35.0 + Math.random() * 30.0; weightKg = 5.0 + Math.random() * 8.0; }
            case 16 -> { fishName = "熔岩巨甲龜幼崽"; itemType = Items.PUFFERFISH; lengthCm = 115.0 + Math.random() * 75.0; weightKg = 85.0 + Math.random() * 95.0; }
            case 17 -> { fishName = "鑽石光華飛魚"; itemType = Items.TROPICAL_FISH; lengthCm = 65.0 + Math.random() * 45.0; weightKg = 12.0 + Math.random() * 18.0; }
            case 18 -> { fishName = "狂暴赤紅霸王鮭"; itemType = Items.SALMON; lengthCm = 135.0 + Math.random() * 85.0; weightKg = 65.0 + Math.random() * 75.0; }
            default -> { fishName = "虛空黑洞旗魚"; itemType = Items.NETHER_STAR; lengthCm = 160.0 + Math.random() * 160.0; weightKg = 60.0 + Math.random() * 120.0; }
        }

        // Apply Giant Fish Magnet Buff (+30% ~ +60% length)
        if (hasGiantFishBuff(player.getUUID())) {
            double mult = 1.30 + Math.random() * 0.30;
            lengthCm *= mult;
            player.sendSystemMessage(Component.literal(String.format("§6🧲 [巨魚引力增幅] 磁鐵生效！本條魚長度增幅 +%.0f%% 放大至 %.1f cm！", (mult - 1.0) * 100, lengthCm)));
        }

        String timeStr = ZonedDateTime.now(ZoneId.of("Asia/Taipei")).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        CaughtFish fish = new CaughtFish(username, fishName, lengthCm, weightKg, timeStr);

        // Update server contest score if active
        if (active && inFishingDim) {
            double currentBest = serverScores.getOrDefault(player.getUUID(), 0.0);
            if (lengthCm > currentBest) {
                serverScores.put(player.getUUID(), lengthCm);
                player.sendSystemMessage(Component.literal(String.format("§b🎉 [全服大賽] 刷新個人最高紀錄！新長度: §e%.1f cm §b(原: %.1f cm)", lengthCm, currentBest)));
            }
        }

        // Update party match score if in party match
        if (match != null && match.active) {
            double currentBest = match.scores.getOrDefault(player.getUUID(), 0.0);
            if (lengthCm > currentBest) {
                match.scores.put(player.getUUID(), lengthCm);
                player.sendSystemMessage(Component.literal(String.format("§b🎉 [房間比賽] 刷新房間最高紀錄！新長度: §e%.1f cm §b(原: %.1f cm)", lengthCm, currentBest)));
            }
        }

        // Update solo mode score if in solo mode
        if (soloPlayers.contains(player.getUUID())) {
            UUID uuid = player.getUUID();
            double currentBest = soloBestScores.getOrDefault(uuid, 0.0);
            if (lengthCm > currentBest) {
                soloBestScores.put(uuid, lengthCm);
                player.sendSystemMessage(Component.literal(String.format("§a🌿 [單人悠閒釣魚] 刷新個人單次紀錄！新長度: §e%.1f cm §a(原: %.1f cm)", lengthCm, currentBest)));
            }
            int count = soloFishCounts.getOrDefault(uuid, 0) + 1;
            soloFishCounts.put(uuid, count);

            ServerBossEvent soloBar = soloBossBars.get(uuid);
            if (soloBar != null) {
                soloBar.setName(Component.literal(String.format("§a🌿 [單人悠閒釣魚] 👑 個人最高: §e%.1f cm §a| 🎣 總捕獲: §e%d 條",
                        soloBestScores.getOrDefault(uuid, 0.0), count)));
            }
        }

        updateHallOfFame(fish);
        FishCodexManager.onCatchFish(player, fishName, lengthCm);

        ItemStack customFish = new ItemStack(itemType);
        customFish.set(DataComponents.CUSTOM_NAME, Component.literal("§6★ " + fishName));
        customFish.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
        customFish.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal(String.format("§7釣魚勇士: §f%s", username)),
                Component.literal(String.format("§7魚類尺寸: §e%.1f cm", lengthCm)),
                Component.literal(String.format("§7魚類重量: §b%.1f kg", weightKg)),
                Component.literal(String.format("§7垂釣時間: §8%s", timeStr)),
                Component.literal(""),
                Component.literal("§e[來自 craftcore:fishing 專屬釣魚維度]")
        )));

        player.sendSystemMessage(Component.literal(String.format("§a🎣 [釣魚成功] 釣獲戰利品：§6【%s】§a(尺寸: §e%.1f cm§a, 重量: §b%.1f kg§a)！", fishName, lengthCm, weightKg)));
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.FISHING_BOBBER_RETRIEVE, SoundSource.PLAYERS, 1.0f, 1.2f);
        return customFish;
    }

    private static void applyTrapPenalty(ServerPlayer player) {
        if (player == null) return;
        Double curServer = serverScores.get(player.getUUID());
        if (curServer != null && curServer > 0) {
            double penalty = 0.05 + Math.random() * 0.10;
            double newScore = Math.max(0, curServer * (1.0 - penalty));
            serverScores.put(player.getUUID(), newScore);
            player.sendSystemMessage(Component.literal(String.format("§c💥 陷阱爆炸！您的全服大賽最高長度已被扣除 %.0f%%，剩餘: %.1f cm", penalty * 100, newScore)));
        }

        PartyMatch match = partyMatches.get(player.getUUID());
        if (match != null && match.active) {
            Double curParty = match.scores.get(player.getUUID());
            if (curParty != null && curParty > 0) {
                double penalty = 0.05 + Math.random() * 0.10;
                double newScore = Math.max(0, curParty * (1.0 - penalty));
                match.scores.put(player.getUUID(), newScore);
                player.sendSystemMessage(Component.literal(String.format("§c💥 陷阱爆炸！您的房間比賽最高長度已被扣除 %.0f%%，剩餘: %.1f cm", penalty * 100, newScore)));
            }
        }
    }

    public static void toggleSoloMode(ServerPlayer player) {
        if (player == null) return;
        UUID uuid = player.getUUID();
        if (soloPlayers.contains(uuid)) {
            soloPlayers.remove(uuid);
            ServerBossEvent soloBar = soloBossBars.remove(uuid);
            if (soloBar != null) {
                soloBar.removePlayer(player);
                soloBar.setVisible(false);
            }
            player.sendSystemMessage(Component.literal("§e🌿 [單人悠閒釣魚] 已關閉單人模式，恢復參加全服/房間大賽。"));
            if (active && bossBar != null && player.level().dimension().equals(FISHING_DIMENSION_KEY)) {
                bossBar.addPlayer(player);
            }
        } else {
            soloPlayers.add(uuid);
            if (bossBar != null) {
                bossBar.removePlayer(player);
            }
            for (PartyMatch m : partyMatches.values()) {
                if (m.bossBar != null) m.bossBar.removePlayer(player);
            }
            ServerBossEvent soloBar = new ServerBossEvent(UUID.randomUUID(),
                    Component.literal(String.format("§a🌿 [單人悠閒釣魚] 👑 個人最高: §e%.1f cm §a| 🎣 總捕獲: §e%d 條",
                            soloBestScores.getOrDefault(uuid, 0.0), soloFishCounts.getOrDefault(uuid, 0))),
                    BossEvent.BossBarColor.GREEN, BossEvent.BossBarOverlay.PROGRESS);
            soloBar.setProgress(1.0f);
            soloBar.setVisible(true);
            soloBar.addPlayer(player);
            soloBossBars.put(uuid, soloBar);
            player.sendSystemMessage(Component.literal("§a🌿 [單人悠閒釣魚] 已為您開啟單人悠閒釣魚模式！無時間限制，免疫長度偷取與交換干擾！"));
        }
    }

    public static void applyThief(ServerPlayer thiefPlayer, ServerPlayer targetPlayer) {
        if (thiefPlayer == null || targetPlayer == null) return;
        UUID tUuid = thiefPlayer.getUUID();
        UUID vUuid = targetPlayer.getUUID();

        if (soloPlayers.contains(tUuid) || soloPlayers.contains(vUuid)) {
            thiefPlayer.sendSystemMessage(Component.literal("§c[單人保護] 單人悠閒模式下的玩家不允許使用或受影響於長度偷取與交換道具！"));
            return;
        }

        Double vScore = serverScores.get(vUuid);
        if (vScore != null && vScore > 0) {
            double stealPct = 0.01 + Math.random() * 0.29; // 1% ~ 30%
            double stolenAmt = vScore * stealPct;
            serverScores.put(vUuid, vScore - stolenAmt);
            serverScores.put(tUuid, serverScores.getOrDefault(tUuid, 0.0) + stolenAmt);

            thiefPlayer.sendSystemMessage(Component.literal(String.format("§a🗡 [長度偷取] 成功從玩家 %s 偷取 %.1f cm (%.0f%%) 長度！", targetPlayer.getName().getString(), stolenAmt, stealPct * 100)));
            targetPlayer.sendSystemMessage(Component.literal(String.format("§c🗡 [長度偷取警告] 糟糕！玩家 %s 使用長度偷取器偷走了您 %.1f cm 的長度紀錄！", thiefPlayer.getName().getString(), stolenAmt)));
            thiefPlayer.level().playSound(null, thiefPlayer.getX(), thiefPlayer.getY(), thiefPlayer.getZ(), SoundEvents.WITCH_CELEBRATE, SoundSource.PLAYERS, 1.0f, 1.2f);
        }
    }

    public static void applySwap(ServerPlayer p1, ServerPlayer p2) {
        if (p1 == null || p2 == null) return;
        UUID u1 = p1.getUUID();
        UUID u2 = p2.getUUID();

        if (soloPlayers.contains(u1) || soloPlayers.contains(u2)) {
            p1.sendSystemMessage(Component.literal("§c[單人保護] 單人悠閒模式下的玩家不允許使用或受影響於長度偷取與交換道具！"));
            return;
        }

        double score1 = serverScores.getOrDefault(u1, 0.0);
        double score2 = serverScores.getOrDefault(u2, 0.0);

        serverScores.put(u1, score2);
        serverScores.put(u2, score1);

        p1.sendSystemMessage(Component.literal(String.format("§d🔄 [長度交換] 成功與玩家 %s 強制交換最高長度！您當前長度變更為: %.1f cm", p2.getName().getString(), score2)));
        p2.sendSystemMessage(Component.literal(String.format("§d🔄 [長度交換警告] 玩家 %s 對您使用了長度交換器！您當前長度變更為: %.1f cm", p1.getName().getString(), score1)));
        p1.level().playSound(null, p1.getX(), p1.getY(), p1.getZ(), SoundEvents.PLAYER_TELEPORT, SoundSource.PLAYERS, 1.0f, 1.2f);
    }

    private static synchronized void updateHallOfFame(CaughtFish fish) {
        hallOfFame.add(fish);
        hallOfFame.sort((f1, f2) -> Double.compare(f2.lengthCm, f1.lengthCm));
        if (hallOfFame.size() > 50) {
            hallOfFame.remove(hallOfFame.size() - 1);
        }
    }

    private static void settleRewards(MinecraftServer server) {
        if (serverScores.isEmpty()) {
            server.getPlayerList().broadcastSystemMessage(Component.literal("§b[釣魚大賽] 本次大賽無玩家鉤中巨魚。下次加油！"), false);
            return;
        }

        List<Map.Entry<UUID, Double>> sorted = serverScores.entrySet().stream()
                .sorted(Map.Entry.<UUID, Double>comparingByValue().reversed())
                .toList();

        server.getPlayerList().broadcastSystemMessage(Component.literal("§6🏆 ===== 20:00 全服釣魚大賽最終排行榜 ===== 🏆"), false);

        for (int i = 0; i < sorted.size(); i++) {
            Map.Entry<UUID, Double> entry = sorted.get(i);
            ServerPlayer player = server.getPlayerList().getPlayer(entry.getKey());
            String name = (player != null) ? player.getName().getString() : "離線選手";
            double score = entry.getValue();

            int rank = i + 1;
            if (rank == 1) {
                server.getPlayerList().broadcastSystemMessage(Component.literal(String.format("§e🥇 第一名: §f%s §e(%.1f cm) ➔ 獎勵: $3,000 元 + 5 把鑰匙 + 稱號 [釣聖]", name, score)), false);
                if (player != null) {
                    com.craftcore.economy.EconomyManager.addMoney(name, 3000.0);
                    int k = com.craftcore.economy.EconomyManager.getLotteryKeys(name);
                    com.craftcore.economy.EconomyManager.setLotteryKeys(name, k + 5);
                    TitleManager.unlockTitle(name, "§b[釣聖]");
                }
            } else if (rank == 2) {
                server.getPlayerList().broadcastSystemMessage(Component.literal(String.format("§f🥈 第二名: §f%s §f(%.1f cm) ➔ 獎勵: $1,500 元 + 3 把鑰匙 + 稱號 [釣魚高手]", name, score)), false);
                if (player != null) {
                    com.craftcore.economy.EconomyManager.addMoney(name, 1500.0);
                    int k = com.craftcore.economy.EconomyManager.getLotteryKeys(name);
                    com.craftcore.economy.EconomyManager.setLotteryKeys(name, k + 3);
                    TitleManager.unlockTitle(name, "§e[釣魚高手]");
                }
            } else if (rank == 3) {
                server.getPlayerList().broadcastSystemMessage(Component.literal(String.format("§6🥉 第三名: §f%s §6(%.1f cm) ➔ 獎勵: $800 元 + 2 把鑰匙", name, score)), false);
                if (player != null) {
                    com.craftcore.economy.EconomyManager.addMoney(name, 800.0);
                    int k = com.craftcore.economy.EconomyManager.getLotteryKeys(name);
                    com.craftcore.economy.EconomyManager.setLotteryKeys(name, k + 2);
                }
            } else {
                if (player != null) {
                    com.craftcore.economy.EconomyManager.addMoney(name, 200.0);
                    int k = com.craftcore.economy.EconomyManager.getLotteryKeys(name);
                    com.craftcore.economy.EconomyManager.setLotteryKeys(name, k + 1);
                    player.sendSystemMessage(Component.literal(String.format("§a[釣魚大賽] 感謝參與！第 %d 名 (%.1f cm) 獲得參與獎: $200 元 + 1 把鑰匙！", rank, score)));
                }
            }
        }
    }

    private static abstract class ReadOnlyFishMenuHandler extends ChestMenu {
        public ReadOnlyFishMenuHandler(MenuType<ChestMenu> type, int syncId, net.minecraft.world.entity.player.Inventory playerInventory, SimpleContainer container, int rows) {
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

    public static void openFishGui(ServerPlayer player) {
        if (player == null) return;
        SimpleContainer container = new SimpleContainer(27);

        ItemStack border = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < 27; i++) {
            container.setItem(i, border);
        }

        // Slot 10: Teleport to craftcore:fishing dimension
        container.setItem(10, createGuiItem(Items.ENDER_PEARL, "§a🚀 傳送至專屬釣魚虛空維度", List.of(
                "§7維度 ID: §ecraftcore:fishing",
                "§7全虛空背景、釣起 100% 奇幻 NBT 魚類",
                "",
                "§a[點擊立即傳送至釣魚維度]"
        )));

        // Slot 12: Party Match Lobby
        PartyMatch match = partyMatches.get(player.getUUID());
        String partyInfo = (match != null) ? "§a[已加入/房主: " + match.hostName + "]" : "§7[未加入/點擊開房]";
        container.setItem(12, createGuiItem(Items.FISHING_ROD, "§b🎮 自由組隊/單人比賽大廳", List.of(
                "§7狀態: " + partyInfo,
                "§7組隊模式: 允許使用偷取器與交換器",
                "§7單人模式: 僅爆個人加速/磁鐵 BUFF",
                "",
                "§e[點擊開啟組隊/房間比賽 GUI]"
        )));

        // Slot 14: Hall of Fame
        container.setItem(14, createGuiItem(Items.GOLD_BLOCK, "§6🏆 歷史釣王名人堂榜單", List.of(
                "§7記錄全服有史以來釣起的最高巨魚排行榜",
                "",
                "§e[點擊查看歷史 Top 50 名人堂]"
        )));

        // Slot 16: Fish Sell Shop
        container.setItem(16, createGuiItem(Items.GOLD_NUGGET, "§a💰 奇幻售魚商店 (/fish sell)", List.of(
                "§7底價 $20 + 長度 $0.3/cm + 重量 $0.4/kg",
                "§7單條最高封頂可售出 $300 元金幣",
                "",
                "§e[左鍵點擊: 出售手持魚類]",
                "§a[右鍵點擊: 一鍵全售背包內魚類]"
        )));

        // Slot 18: Fish Codex
        int unlocked = FishCodexManager.getUnlockedCount(player.getUUID());
        container.setItem(18, createGuiItem(Items.BOOK, "§b📖 奇幻魚類圖鑑冊 (/fish codex)", List.of(
                "§7記錄 20 種奇幻魚類解鎖狀態與個人最大紀錄",
                "§7當前進度: §e" + unlocked + " / 20",
                "§7解鎖 100% 全圖鑑獲得稱號: §b[海王]",
                "",
                "§e[點擊開啟圖鑑冊]"
        )));

        // Slot 20: BossBar Toggle
        boolean bossBarVis = (bossBar != null && bossBar.getPlayers().contains(player));
        container.setItem(20, createGuiItem(Items.COMPASS, "§e📊 BossBar 抬頭資訊 " + (bossBarVis ? "§a[已顯示]" : "§c[已隱藏]"), List.of(
                "§7切換頂部大賽狀態與倒數 BossBar",
                "",
                "§e[點擊切換 BossBar 顯示]"
        )));

        // Slot 22: Back to menu
        container.setItem(22, createGuiItem(Items.ARROW, "§a⬅ 返回 /menu 大廳", List.of("§7點擊返回主選單")));

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
                new ReadOnlyFishMenuHandler(MenuType.GENERIC_9x3, syncId, inv, container, 3) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 10) { sp.closeContainer(); teleportToFishingDimension(sp); return; }
                            if (slotId == 12) { openPartyGui(sp); return; }
                            if (slotId == 14) { openHallOfFameGui(sp); return; }
                            if (slotId == 16) {
                                if (button == 1) { // Right click
                                    FishSellManager.sellAllInventoryFish(sp);
                                } else { // Left click
                                    FishSellManager.sellHandheldFish(sp);
                                }
                                openFishGui(sp);
                                return;
                            }
                            if (slotId == 18) { FishCodexManager.openCodexGui(sp); return; }
                            if (slotId == 20) {
                                if (bossBar != null) {
                                    if (bossBar.getPlayers().contains(sp)) bossBar.removePlayer(sp);
                                    else bossBar.addPlayer(sp);
                                }
                                openFishGui(sp);
                                return;
                            }
                            if (slotId == 22) { com.craftcore.menu.MenuGuiManager.openMainMenu(sp); return; }
                        }
                    }
                }, Component.literal("§8❖ 🎣 釣魚大都會與專屬維度 ❖")));
    }

    public static void openPartyGui(ServerPlayer player) {
        if (player == null) return;
        SimpleContainer container = new SimpleContainer(27);

        ItemStack border = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < 27; i++) {
            container.setItem(i, border);
        }

        PartyMatch match = partyMatches.get(player.getUUID());

        if (match == null) {
            container.setItem(11, createGuiItem(Items.NETHER_STAR, "§a➕ 創建全新比賽房間 (單人/多人)", List.of(
                    "§7點擊創建預設 10 分鐘比賽房間",
                    "§7可自己一人單人刷榜，或邀請好友加入競賽！",
                    "",
                    "§a[點擊創建比賽房間]"
            )));
            container.setItem(15, createGuiItem(Items.PAPER, "§b✉️ 加入好友房間指令", List.of(
                    "§7請在聊天欄輸入指令: §e/fish party join <房主名稱>",
                    "§7加入好友房間一起組隊釣魚競賽！"
            )));
        } else {
            boolean isHost = match.hostUuid.equals(player.getUUID());
            container.setItem(11, createGuiItem(Items.PLAYER_HEAD, "§6🎮 房間狀態: " + (match.active ? "§a[比賽中]" : "§e[等待中]"), List.of(
                    "§7房主: §f" + match.hostName,
                    "§7當前人數: §f" + match.members.size() + " 人 " + (match.isSolo() ? "§7(單人保護模式)" : "§b(多人戰術模式)"),
                    "§7比賽時長: §f" + match.durationMinutes + " 分鐘"
            )));

            if (isHost && !match.active) {
                container.setItem(13, createGuiItem(Items.EMERALD_BLOCK, "§a▶️ 開啟房間比賽！", List.of("§7點擊立即啟動倒數並開始計分", "", "§a[點擊開始比賽]")));
            }

            container.setItem(15, createGuiItem(Items.BARRIER, "§c🚪 退出目前房間", List.of("§7退出目前比賽房間", "", "§c[點擊退出房間]")));
        }

        container.setItem(22, createGuiItem(Items.ARROW, "§a⬅ 返回釣魚大廳", List.of("§7返回上一頁")));

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
                new ReadOnlyFishMenuHandler(MenuType.GENERIC_9x3, syncId, inv, container, 3) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (match == null) {
                                if (slotId == 11) {
                                    createPartyMatch(sp, 10);
                                    openPartyGui(sp);
                                    return;
                                }
                            } else {
                                if (slotId == 13 && match.hostUuid.equals(sp.getUUID()) && !match.active) {
                                    startPartyMatch(sp);
                                    sp.closeContainer();
                                    return;
                                }
                                if (slotId == 15) {
                                    partyMatches.remove(sp.getUUID());
                                    if (match.bossBar != null) match.bossBar.removePlayer(sp);
                                    sp.sendSystemMessage(Component.literal("§c[釣魚組隊] 已退出目前比賽房間。"));
                                    openPartyGui(sp);
                                    return;
                                }
                            }
                            if (slotId == 22) { openFishGui(sp); return; }
                        }
                    }
                }, Component.literal("§8❖ 🎮 組隊/房間比賽大廳 ❖")));
    }

    public static void openHallOfFameGui(ServerPlayer player) {
        if (player == null) return;
        SimpleContainer container = new SimpleContainer(54);

        ItemStack border = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < 54; i++) {
            container.setItem(i, border);
        }

        synchronized (hallOfFame) {
            int slot = 0;
            for (CaughtFish fish : hallOfFame) {
                if (slot >= 45) break;
                container.setItem(slot++, createGuiItem(Items.TROPICAL_FISH, "§6★ " + fish.fishName, List.of(
                        "§7垂釣勇士: §f" + fish.fisherman,
                        String.format("§7魚類尺寸: §e%.1f cm", fish.lengthCm),
                        String.format("§7魚類重量: §b%.1f kg", fish.weightKg),
                        "§7紀錄時間: §8" + fish.caughtTime
                )));
            }
        }

        container.setItem(49, createGuiItem(Items.ARROW, "§a⬅ 返回釣魚主頁", List.of("§7返回上一頁")));

        player.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
                new ReadOnlyFishMenuHandler(MenuType.GENERIC_9x6, syncId, inv, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 49) { openFishGui(sp); return; }
                        }
                    }
                }, Component.literal("§8❖ 🏆 歷史釣王 Top 50 名人堂 ❖")));
    }

    public static void openTargetSelectorGui(ServerPlayer attacker, String itemType) {
        if (attacker == null) return;
        MinecraftServer server = attacker.level().getServer();
        if (server == null) return;

        SimpleContainer container = new SimpleContainer(54);
        ItemStack border = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < 54; i++) {
            container.setItem(i, border);
        }

        List<ServerPlayer> targets = server.getPlayerList().getPlayers().stream()
                .filter(p -> !p.getUUID().equals(attacker.getUUID()))
                .toList();

        int slot = 0;
        for (ServerPlayer target : targets) {
            if (slot >= 45) break;
            String tName = target.getName().getString();
            double tScore = serverScores.getOrDefault(target.getUUID(), 0.0);
            container.setItem(slot++, createGuiItem(Items.PLAYER_HEAD, "§e🎯 對手: " + tName, List.of(
                    String.format("§7當前最高長度: §e%.1f cm", tScore),
                    "",
                    "§e[點擊對此玩家使用 " + (itemType.equals("THIEF") ? "長度偷取器" : "長度交換器") + "]"
            )));
        }

        attacker.openMenu(new SimpleMenuProvider((syncId, inv, p) ->
                new ReadOnlyFishMenuHandler(MenuType.GENERIC_9x6, syncId, inv, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            ItemStack clicked = container.getItem(slotId);
                            if (clicked != null && clicked.has(DataComponents.CUSTOM_NAME)) {
                                String name = clicked.get(DataComponents.CUSTOM_NAME).getString();
                                if (name.startsWith("§e🎯 對手: ")) {
                                    String targetName = name.replace("§e🎯 對手: ", "").trim();
                                    ServerPlayer targetPlayer = server.getPlayerList().getPlayerByName(targetName);
                                    if (targetPlayer != null) {
                                        sp.closeContainer();
                                        if (itemType.equals("THIEF")) {
                                            sp.getMainHandItem().shrink(1);
                                            applyThief(sp, targetPlayer);
                                        } else if (itemType.equals("SWAPPER")) {
                                            sp.getMainHandItem().shrink(1);
                                            applySwap(sp, targetPlayer);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }, Component.literal("§8❖ 🎯 選擇打擊對手 ❖")));
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
