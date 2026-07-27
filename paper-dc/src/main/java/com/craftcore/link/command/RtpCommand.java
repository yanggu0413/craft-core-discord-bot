package com.craftcore.link.command;

import com.craftcore.link.CraftCoreLink;
import org.bukkit.Location;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class RtpCommand implements CommandExecutor, TabCompleter {

    private final CraftCoreLink plugin;
    private final Map<UUID, Long> cooldowns = new ConcurrentHashMap<>();
    private final Random random = new Random();

    public RtpCommand(CraftCoreLink plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(plugin.getConfigManager().getMessage("in-game.only-player"));
            return true;
        }

        if (!plugin.getConfigManager().isRtpEnabled()) {
            player.sendMessage(plugin.getConfigManager().getMessage("in-game.rtp-disabled"));
            return true;
        }

        UUID uuid = player.getUniqueId();
        long now = System.currentTimeMillis();
        int cooldownSeconds = plugin.getConfigManager().getRtpCooldownSeconds();

        // Check cooldown unless player has bypass permission
        if (!player.hasPermission("craftcorelink.rtp.bypass") && cooldowns.containsKey(uuid)) {
            long lastUsed = cooldowns.get(uuid);
            long elapsedSeconds = (now - lastUsed) / 1000;
            if (elapsedSeconds < cooldownSeconds) {
                long remaining = cooldownSeconds - elapsedSeconds;
                String msg = plugin.getConfigManager().getMessage("in-game.rtp-cooldown")
                        .replace("{seconds}", String.valueOf(remaining));
                player.sendMessage(msg);
                return true;
            }
        }

        player.sendMessage(plugin.getConfigManager().getMessage("in-game.rtp-searching"));

        World world = player.getWorld();
        int minRadius = plugin.getConfigManager().getRtpMinRadius();
        int maxRadius = plugin.getConfigManager().getRtpMaxRadius();
        int maxAttempts = plugin.getConfigManager().getRtpMaxAttempts();

        boolean isNether = world.getEnvironment() == World.Environment.NETHER;

        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            double angle = random.nextDouble() * 2 * Math.PI;
            double distance = minRadius + (random.nextDouble() * (maxRadius - minRadius));

            int blockX = (int) Math.round(player.getLocation().getX() + distance * Math.cos(angle));
            int blockZ = (int) Math.round(player.getLocation().getZ() + distance * Math.sin(angle));

            int startY = isNether ? 120 : 310;
            int minY = isNether ? 10 : -60;

            int safeY = -999;

            for (int y = startY; y >= minY; y--) {
                Block ground = world.getBlockAt(blockX, y, blockZ);
                Block above1 = world.getBlockAt(blockX, y + 1, blockZ);
                Block above2 = world.getBlockAt(blockX, y + 2, blockZ);

                if (!ground.isEmpty() && !ground.isLiquid() && above1.isPassable() && above2.isPassable()) {
                    String typeName = ground.getType().name().toLowerCase();
                    if (!typeName.contains("lava") && !typeName.contains("water") && !typeName.contains("magma")
                            && !typeName.contains("fire") && !typeName.contains("void") && !typeName.contains("air")
                            && !typeName.contains("bedrock")) {
                        safeY = y + 1;
                        break;
                    }
                }
            }

            if (safeY != -999) {
                final int finalSafeY = safeY;
                final int finalX = blockX;
                final int finalZ = blockZ;
                Location targetLoc = new Location(world, finalX + 0.5, finalSafeY, finalZ + 0.5, player.getLocation().getYaw(), player.getLocation().getPitch());

                player.teleportAsync(targetLoc).thenAccept(success -> {
                    if (success) {
                        player.playSound(targetLoc, Sound.ENTITY_ENDERMAN_TELEPORT, 1.0f, 1.0f);
                        cooldowns.put(uuid, System.currentTimeMillis());

                        String msg = plugin.getConfigManager().getMessage("in-game.rtp-success")
                                .replace("{x}", String.valueOf(finalX))
                                .replace("{y}", String.valueOf(finalSafeY))
                                .replace("{z}", String.valueOf(finalZ));
                        player.sendMessage(msg);
                    } else {
                        player.sendMessage(plugin.getConfigManager().getMessage("in-game.rtp-failed"));
                    }
                });
                return true;
            }
        }

        player.sendMessage(plugin.getConfigManager().getMessage("in-game.rtp-failed"));
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        return Collections.emptyList();
    }
}
