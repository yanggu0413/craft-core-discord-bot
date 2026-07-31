package com.craftcore.link.listener;

import com.craftcore.link.CraftCoreLink;
import com.craftcore.link.binding.BindingManager;
import com.craftcore.link.util.DeathTranslationUtil;

import io.papermc.paper.advancement.AdvancementDisplay;
import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerAdvancementDoneEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.ItemStack;

import java.util.UUID;

public class MinecraftEventListener implements Listener {

    private final CraftCoreLink plugin;

    public MinecraftEventListener(CraftCoreLink plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onAsyncChat(AsyncChatEvent event) {
        Player player = event.getPlayer();
        String senderName = player.getName();
        String uuid = player.getUniqueId().toString();
        String message = PlainTextComponentSerializer.plainText().serialize(event.message());

        plugin.getDiscordBotManager().sendChat(senderName, uuid, message);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        String username = player.getName();
        UUID uuid = player.getUniqueId();

        // 1. Send Join Embed to Discord
        plugin.getDiscordBotManager().sendJoinEmbed(username, uuid.toString());

        // 2. Sync LuckPerms VIP status to Discord if bound
        if (plugin.getLuckPermsSyncManager().isEnabled()) {
            plugin.getLuckPermsSyncManager().syncMcToDiscord(uuid, username);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        String username = player.getName();
        String uuid = player.getUniqueId().toString();

        // Send Leave Embed to Discord
        plugin.getDiscordBotManager().sendLeaveEmbed(username, uuid);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerDeath(PlayerDeathEvent event) {
        Player player = event.getEntity();
        String username = player.getName();
        String uuid = player.getUniqueId().toString();

        Component deathComp = event.deathMessage();
        String rawDeathMsg = deathComp != null
                ? PlainTextComponentSerializer.plainText().serialize(deathComp)
                : username + " died";

        String translatedMsg = DeathTranslationUtil.translate(rawDeathMsg, username);
        plugin.getDiscordBotManager().sendDeathEmbed(username, uuid, translatedMsg);

        // Send Death DM with coordinates if player bound and enabled
        BindingManager.UserBinding binding = plugin.getBindingManager().getBindingByMcUuid(uuid);
        if (binding != null && binding.isDmDeathEnabled()) {
            Location loc = player.getLocation();
            String worldRaw = loc.getWorld() != null ? loc.getWorld().getName() : "world";
            String worldDisplayName;
            if (worldRaw.endsWith("_nether") || worldRaw.equals("world_nether")) {
                worldDisplayName = "地底界 (下界)";
            } else if (worldRaw.endsWith("_the_end") || worldRaw.equals("world_the_end")) {
                worldDisplayName = "終界";
            } else if (worldRaw.equals("world") || worldRaw.contains("overworld")) {
                worldDisplayName = "主世界";
            } else {
                worldDisplayName = worldRaw;
            }

            plugin.getDiscordBotManager().sendDeathDm(
                    binding.getDiscordId(),
                    username,
                    uuid,
                    worldDisplayName,
                    loc.getBlockX(),
                    loc.getBlockY(),
                    loc.getBlockZ(),
                    translatedMsg
            );
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerAdvancementDone(PlayerAdvancementDoneEvent event) {
        Player player = event.getPlayer();
        AdvancementDisplay display = event.getAdvancement().getDisplay();

        if (display == null || !display.doesAnnounceToChat()) {
            return;
        }

        String username = player.getName();
        String uuid = player.getUniqueId().toString();

        String title = PlainTextComponentSerializer.plainText().serialize(display.title());
        String description = PlainTextComponentSerializer.plainText().serialize(display.description());

        ItemStack iconItem = display.icon();
        String itemId = iconItem != null ? iconItem.getType().getKey().getKey() : "";

        plugin.getDiscordBotManager().sendAdvancementEmbed(username, uuid, title, description, itemId);
    }
}
