package com.craftcore.task;
 
import com.craftcore.economy.EconomyManager;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundSetDisplayObjectivePacket;
import net.minecraft.network.chat.numbers.BlankFormat;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.scores.DisplaySlot;
import net.minecraft.world.scores.Objective;
import net.minecraft.world.scores.Scoreboard;
import net.minecraft.world.scores.criteria.ObjectiveCriteria;
 
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
 
public class SidebarManager {
 
    private static final Map<UUID, List<String>> previousLines = new ConcurrentHashMap<>();
    private static int tickCounter = 0;
 
    public static void register() {
        // Update sidebar every second (20 ticks)
        ServerTickEvents.END_SERVER_TICK.register(server -> {
            tickCounter++;
            if (tickCounter % 20 == 0) {
                updateAllSidebars(server);
            }
        });
 
        // Clean up when a player leaves
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            ServerPlayer player = handler.getPlayer();
            if (player != null) {
                cleanupSidebar(server, player);
            }
        });
    }
 
    private static void updateAllSidebars(MinecraftServer server) {
        double mspt = server.getAverageTickTimeNanos() / 1_000_000.0;
        double tps = Math.min(20.0, 1000.0 / mspt);
 
        Scoreboard scoreboard = server.getScoreboard();
        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            try {
                updatePlayerSidebar(player, scoreboard, tps);
            } catch (Exception e) {
                System.err.println("[CraftCore] Failed to update sidebar for " + player.getName().getString() + ": " + e.getMessage());
            }
        }
    }
 
    private static void updatePlayerSidebar(ServerPlayer player, Scoreboard scoreboard, double tps) {
        String username = player.getName().getString();
        UUID uuid = player.getUUID();
        String objectiveName = "sb_" + username.toLowerCase();
 
        // 1. Get or create objective
        Objective objective = scoreboard.getObjective(objectiveName);
        if (objective == null) {
            objective = scoreboard.addObjective(
                objectiveName,
                ObjectiveCriteria.DUMMY,
                Component.literal("  §e§l✦ CRAFT-CORE ✦  "),
                ObjectiveCriteria.RenderType.INTEGER,
                true,
                BlankFormat.INSTANCE
            );
        }
 
        // 2. Clear old lines to prevent leaks
        List<String> oldLines = previousLines.get(uuid);
        if (oldLines != null) {
            for (String oldLine : oldLines) {
                scoreboard.resetSinglePlayerScore(() -> oldLine, objective);
            }
        }
 
        // 3. Prepare new lines with premium styling
        List<String> newLines = new ArrayList<>();
        newLines.add("§7§m----------------");
        newLines.add("§7• §f玩家: §e" + username);
        newLines.add("§7• §f座標: §a" + player.getBlockX() + ", " + player.getBlockY() + ", " + player.getBlockZ());
        newLines.add("§7• §f餘額: §a$" + String.format("%,d", (int)EconomyManager.getBalance(username)) + " 元");
        newLines.add("§7• §f鑰匙: §b🔑 " + EconomyManager.getLotteryKeys(username) + " 把");
        newLines.add("§7• §f效能: §d" + String.format("%.1f", tps) + " TPS");
        newLines.add("§7§m---------------- "); // Space at the end to make it distinct from first line
 
        // 4. Set scores in descending order
        for (int i = 0; i < newLines.size(); i++) {
            String lineText = newLines.get(i);
            int scoreValue = newLines.size() - i;
            scoreboard.getOrCreatePlayerScore(() -> lineText, objective).set(scoreValue);
        }
 
        // 5. Save previous lines
        previousLines.put(uuid, newLines);
 
        // 6. Force client display slot update to sidebar
        player.connection.send(new ClientboundSetDisplayObjectivePacket(DisplaySlot.SIDEBAR, objective));
    }
 
    private static void cleanupSidebar(MinecraftServer server, ServerPlayer player) {
        UUID uuid = player.getUUID();
        previousLines.remove(uuid);
 
        Scoreboard scoreboard = server.getScoreboard();
        String objectiveName = "sb_" + player.getName().getString().toLowerCase();
        Objective objective = scoreboard.getObjective(objectiveName);
        if (objective != null) {
            scoreboard.removeObjective(objective);
        }
    }
}

