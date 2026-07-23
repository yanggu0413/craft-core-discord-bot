package com.craftcore.task;

import com.craftcore.CraftCoreMod;
import com.craftcore.economy.EconomyManager;
import com.craftcore.websocket.Packet;
import com.craftcore.websocket.CraftCoreWSClient;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundSetSubtitleTextPacket;
import net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket;
import net.minecraft.world.level.Level;
import net.minecraft.world.entity.player.Player;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.entity.BlockEntity;

public class DailyTaskManager {

    public static class SeededRandom {
        private long seed;

        public SeededRandom(long seed) {
            this.seed = seed;
        }

        public int nextInt(int bound) {
            seed = (seed * 1103515245L + 12345L) & 0x7fffffffL;
            return (int) (seed % bound);
        }
    }

    public static class DailyTaskDef {
        public int type; // 1 = Slay, 2 = Mine
        public String target; // "Zombie", "Coal Ore", etc.
        public int count;
        public double reward;

        public DailyTaskDef(int type, String target, int count, double reward) {
            this.type = type;
            this.target = target;
            this.count = count;
            this.reward = reward;
        }
    }

    public static final DailyTaskDef[] SLAY_POOL = {
        new DailyTaskDef(1, "Zombie", 15, 250.0),
        new DailyTaskDef(1, "Skeleton", 10, 300.0),
        new DailyTaskDef(1, "Creeper", 5, 400.0)
    };

    public static final DailyTaskDef[] MINE_POOL = {
        new DailyTaskDef(2, "Coal Ore", 20, 200.0),
        new DailyTaskDef(2, "Iron Ore", 10, 300.0),
        new DailyTaskDef(2, "Diamond Ore", 3, 1000.0)
    };

    public static String getTaipeiDate() {
        return EconomyManager.getTaipeiDate();
    }

    public static DailyTaskDef[] getDailyTasks(String dateStr) {
        long seed = (long) dateStr.hashCode() & 0xffffffffL;
        SeededRandom rand = new SeededRandom(seed);
        int slayIdx = rand.nextInt(SLAY_POOL.length);
        int mineIdx = rand.nextInt(MINE_POOL.length);
        return new DailyTaskDef[] {
            SLAY_POOL[slayIdx],
            MINE_POOL[mineIdx]
        };
    }

    public static boolean matchesSlayTarget(String entityId, String target) {
        String cleanEntity = entityId.replace("minecraft:", "").toLowerCase();
        String cleanTarget = target.toLowerCase();
        return cleanEntity.equals(cleanTarget);
    }

    public static boolean matchesMineTarget(String blockId, String target) {
        String cleanBlock = blockId.replace("minecraft:", "").toLowerCase();
        String cleanTarget = target.toLowerCase();
        if (cleanTarget.equals("coal ore")) {
            return cleanBlock.equals("coal_ore") || cleanBlock.equals("deepslate_coal_ore");
        } else if (cleanTarget.equals("iron ore")) {
            return cleanBlock.equals("iron_ore") || cleanBlock.equals("deepslate_iron_ore");
        } else if (cleanTarget.equals("diamond ore")) {
            return cleanBlock.equals("diamond_ore") || cleanBlock.equals("deepslate_diamond_ore");
        }
        return false;
    }

    public static void handleEntityKill(LivingEntity entity, DamageSource damageSource) {
        Entity attacker = damageSource.getEntity();
        if (attacker instanceof ServerPlayer killer) {
            String username = killer.getName().getString();
            String dateStr = getTaipeiDate();
            DailyTaskDef[] dailyTasks = getDailyTasks(dateStr);
            DailyTaskDef slayTask = dailyTasks[0];

            String entityId = net.minecraft.core.registries.BuiltInRegistries.ENTITY_TYPE.getKey(entity.getType()).toString();
            if (matchesSlayTarget(entityId, slayTask.target)) {
                int oldProgress = EconomyManager.getDailyTaskSlayProgress(username);
                if (oldProgress < slayTask.count) {
                    EconomyManager.incrementDailyTaskSlayProgress(username, 1);
                    int newProgress = oldProgress + 1;
                    killer.sendSystemMessage(Component.literal("§b[Craft-Core] §f每日任務進度：擊殺 " + slayTask.target + " (" + newProgress + "/" + slayTask.count + ")"));
                    if (newProgress == slayTask.count) {
                        EconomyManager.addMoney(username, slayTask.reward);
                        killer.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
                        killer.connection.send(new ClientboundSetTitleTextPacket(Component.literal("§a🎉 每日任務完成！")));
                        killer.connection.send(new ClientboundSetSubtitleTextPacket(Component.literal("§f已自動獲得獎金 §e$" + (int)slayTask.reward + "§f 元")));
                        killer.sendSystemMessage(Component.literal("§b[Craft-Core] §a恭喜完成每日任務【擊殺 " + slayTask.target + "】，已自動撥款 §e$" + (int)slayTask.reward + "§a 元至您的帳戶！"));
                    }
                }
            }
        }
    }

    private static final java.util.Set<String> processedBlocksThisTick = java.util.Collections.newSetFromMap(new java.util.concurrent.ConcurrentHashMap<>());
    private static long lastClearedTick = -1;

    public static void registerEvents() {
        net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents.AFTER.register((world, player, pos, state, blockEntity) -> {
            handleBlockBreak(world, player, pos, state, blockEntity);
        });
    }

    public static void handleBlockBreak(Level world, Player player, BlockPos pos, BlockState state, BlockEntity blockEntity) {
        if (world == null || world.isClientSide() || !(player instanceof ServerPlayer serverPlayer) || pos == null || state == null) {
            return;
        }

        long currentGameTime = world.getGameTime();
        if (currentGameTime != lastClearedTick) {
            processedBlocksThisTick.clear();
            lastClearedTick = currentGameTime;
        }

        String key = world.dimension().identifier().toString() + ":" + pos.getX() + "," + pos.getY() + "," + pos.getZ();
        if (!processedBlocksThisTick.add(key)) {
            return; // Already counted this block break in this tick!
        }

        String username = serverPlayer.getName().getString();
        String dateStr = getTaipeiDate();
        DailyTaskDef[] dailyTasks = getDailyTasks(dateStr);
        DailyTaskDef mineTask = dailyTasks[1];

        String blockId = net.minecraft.core.registries.BuiltInRegistries.BLOCK.getKey(state.getBlock()).toString();
        if (matchesMineTarget(blockId, mineTask.target)) {
            int oldProgress = EconomyManager.getDailyTaskGatherProgress(username);
            if (oldProgress < mineTask.count) {
                EconomyManager.incrementDailyTaskGatherProgress(username, 1);
                int newProgress = oldProgress + 1;
                serverPlayer.sendSystemMessage(Component.literal("§b[Craft-Core] §f每日任務進度：挖掘 " + mineTask.target + " (" + newProgress + "/" + mineTask.count + ")"));
                if (newProgress == mineTask.count) {
                    EconomyManager.addMoney(username, mineTask.reward);
                    serverPlayer.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
                    serverPlayer.connection.send(new ClientboundSetTitleTextPacket(Component.literal("§a🎉 每日任務完成！")));
                    serverPlayer.connection.send(new ClientboundSetSubtitleTextPacket(Component.literal("§f已自動獲得獎金 §e$" + (int)mineTask.reward + "§f 元")));
                    serverPlayer.sendSystemMessage(Component.literal("§b[Craft-Core] §a恭喜完成每日任務【挖掘 " + mineTask.target + "】，已自動撥款 §e$" + (int)mineTask.reward + "§a 元至您的帳戶！"));
                }
            }
        }
    }

    public static void completeTask(ServerPlayer player, DailyTaskDef task) {
        String username = player.getName().getString();
        
        // Award the money reward
        EconomyManager.addMoney(username, task.reward);

        // Sound level up
        player.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);

        // Subtitle/title screens
        player.connection.send(new ClientboundSetTitleTextPacket(Component.literal("§a任務完成！")));
        player.connection.send(new ClientboundSetSubtitleTextPacket(Component.literal("§f獲得獎金 §e$" + (int)task.reward + "§f 元")));

        // Completion chat message
        player.sendSystemMessage(Component.literal("§b[Craft-Core] §f恭喜完成每日任務【" + (task.type == 1 ? "擊殺" : "挖掘") + " " + task.target + "】，獲得獎金 §e$" + (int)task.reward + "§f 元！"));

        // Send daily_task_complete packet over WebSocket
        CraftCoreWSClient client = CraftCoreMod.getWSClient();
        if (client != null && client.isAuthenticated()) {
            client.send(new Packet("daily_task_complete", new DailyTaskCompletePayload(username, task.type, task.target, task.reward)));
        }
    }

    public static void displayGreetingCard(ServerPlayer player, boolean hasCheckedIn, int pendingMailCount) {
        String username = player.getName().getString();
        String dateStr = getTaipeiDate();
        DailyTaskDef[] dailyTasks = getDailyTasks(dateStr);
        DailyTaskDef slayTask = dailyTasks[0];
        DailyTaskDef mineTask = dailyTasks[1];

        int slayProgress = EconomyManager.getDailyTaskSlayProgress(username);
        int mineProgress = EconomyManager.getDailyTaskGatherProgress(username);
        boolean slayClaimed = EconomyManager.getDailyTaskSlayClaimed(username);
        boolean mineClaimed = EconomyManager.getDailyTaskGatherClaimed(username);

        player.sendSystemMessage(Component.literal("§6=================== 歡迎回來 ==================="));
        player.sendSystemMessage(Component.literal("§a歡迎玩家 §e" + username + " §a登入伺服器！"));
        player.sendSystemMessage(Component.literal("§e★ 今日每日任務 (" + dateStr + ")："));

        String slayStatus = (slayProgress >= slayTask.count) ? (slayClaimed ? "§a[已領取]" : "§e[待領取]") : "§7[未完成]";
        player.sendSystemMessage(Component.literal("§f- 擊殺 " + slayTask.target + ": §e" + slayProgress + "§f/§e" + slayTask.count + " §f(獎金 §e$" + (int)slayTask.reward + "§f) " + slayStatus));

        String mineStatusStr = (mineProgress >= mineTask.count) ? (mineClaimed ? "§a[已領取]" : "§e[待領取]") : "§7[未完成]";
        player.sendSystemMessage(Component.literal("§f- 挖掘 " + mineTask.target + ": §e" + mineProgress + "§f/§e" + mineTask.count + " §f(獎金 §e$" + (int)mineTask.reward + "§f) " + mineStatusStr));

        if (hasCheckedIn) {
            player.sendSystemMessage(Component.literal("§a★ 簽到狀態: 今日已完成簽到！"));
        } else {
            player.sendSystemMessage(Component.literal("§c★ 簽到狀態: 今日尚未簽到！可輸入 /checkin 或於 Discord 簽到以獲取抽獎鑰匙！"));
        }
        player.sendSystemMessage(Component.literal("§e★ 幸運抽獎: 遊戲內輸入 /luckydraw 可消耗鑰匙進行物資抽獎！"));
        if (pendingMailCount > 0) {
            player.sendSystemMessage(Component.literal("§e★ 郵政快遞: 您的信箱有 §c" + pendingMailCount + " §e封未領取快遞，請盡速領取！"));
        }
        player.sendSystemMessage(Component.literal("§6============================================="));
    }

    public static void register() {
    }

    public static class DailyTaskCompletePayload {
        public String username;
        public int task_type;
        public String target;
        public double reward;

        public DailyTaskCompletePayload(String username, int taskType, String target, double reward) {
            this.username = username;
            this.task_type = taskType;
            this.target = target;
            this.reward = reward;
        }
    }
}
