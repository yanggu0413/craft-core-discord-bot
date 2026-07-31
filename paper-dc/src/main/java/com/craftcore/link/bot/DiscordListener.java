package com.craftcore.link.bot;

import com.craftcore.link.CraftCoreLink;
import com.craftcore.link.binding.BindingManager;
import net.dv8tion.jda.api.entities.Role;
import net.dv8tion.jda.api.entities.channel.ChannelType;
import net.dv8tion.jda.api.events.guild.member.GuildMemberRoleAddEvent;
import net.dv8tion.jda.api.events.guild.member.GuildMemberRoleRemoveEvent;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import org.bukkit.Bukkit;

import java.util.UUID;

public class DiscordListener extends ListenerAdapter {

    private final CraftCoreLink plugin;

    public DiscordListener(CraftCoreLink plugin) {
        this.plugin = plugin;
    }

    @Override
    public void onSlashCommandInteraction(SlashCommandInteractionEvent event) {
        if (event.getName().equals("mc-title")) {
            String title = event.getOption("title") != null ? event.getOption("title").getAsString() : "";
            String subtitle = event.getOption("subtitle") != null ? event.getOption("subtitle").getAsString() : "";

            plugin.getDiscordBotManager().broadcastTitle(title, subtitle);
            event.reply("✅ 已成功在遊戲內向所有玩家發送 Title 廣播！").setEphemeral(true).queue();
        }
    }

    @Override
    public void onMessageReceived(MessageReceivedEvent event) {
        if (event.getAuthor().isBot()) return;

        // 1. Direct Message Binding Handler
        if (event.isFromType(ChannelType.PRIVATE)) {
            handlePrivateMessage(event);
            return;
        }

        // 2. Channel Chat Sync (Discord -> MC)
        if (event.isFromGuild() && event.getChannel().getId().equals(plugin.getConfigManager().getChatSyncChannelId())) {
            String sender = event.getAuthor().getEffectiveName();
            String message = event.getMessage().getContentDisplay();
            if (message.trim().isEmpty()) return;

            String template = plugin.getConfigManager().getMessage("in-game.discord-chat-format");
            String formattedMsg = template.replace("{sender}", sender).replace("{message}", message);

            // Broadcast on Minecraft main thread
            Bukkit.getScheduler().runTask(plugin, () -> {
                Bukkit.broadcastMessage(formattedMsg);
            });
        }
    }

    private void handlePrivateMessage(MessageReceivedEvent event) {
        String content = event.getMessage().getContentRaw().trim();
        String discordId = event.getAuthor().getId();
        BindingManager bindingManager = plugin.getBindingManager();

        boolean isSixDigit = content.matches("^\\d{6}$");

        if (isSixDigit) {
            // Check if already bound
            BindingManager.UserBinding existing = bindingManager.getBindingByDiscordId(discordId);
            if (existing != null) {
                String msg = plugin.getConfigManager().getMessage("discord.dm.already-bound")
                        .replace("{username}", existing.getMcUsername());
                event.getChannel().sendMessage(msg).queue();
                return;
            }

            // Rate limit check
            BindingManager.DmRateLimit limit = bindingManager.getRateLimit(discordId);
            if (System.currentTimeMillis() < limit.getCooldownUntil()) {
                long remaining = Math.max(1, (limit.getCooldownUntil() - System.currentTimeMillis()) / 1000);
                String msg = plugin.getConfigManager().getMessage("discord.dm.cooldown")
                        .replace("{seconds}", String.valueOf(remaining));
                event.getChannel().sendMessage(msg).queue();
                return;
            }

            BindingManager.TempCode tempCode = bindingManager.getTempCode(content);
            if (tempCode == null || tempCode.isExpired()) {
                limit.increment();
                if (limit.getCount() >= 5) {
                    limit.setCooldown(System.currentTimeMillis() + 60 * 1000L);
                    limit.reset();
                    String msg = plugin.getConfigManager().getMessage("discord.dm.locked");
                    event.getChannel().sendMessage(msg).queue();
                } else {
                    String msg = tempCode == null
                            ? plugin.getConfigManager().getMessage("discord.dm.invalid-code")
                            : plugin.getConfigManager().getMessage("discord.dm.expired-code");
                    event.getChannel().sendMessage(msg).queue();
                }
                return;
            }

            // Bind user
            BindingManager.UserBinding newBinding = bindingManager.bindUser(discordId, tempCode.getMcUuid(), tempCode.getMcUsername());
            bindingManager.removeTempCode(content);
            bindingManager.removeRateLimit(discordId);

            // Grant verified role & remove unverified role
            String verifiedRoleId = plugin.getConfigManager().getVerifiedRoleId();
            plugin.getDiscordBotManager().addRoleToUser(discordId, verifiedRoleId);

            String unverifiedRoleId = plugin.getConfigManager().getUnverifiedRoleId();
            plugin.getDiscordBotManager().removeRoleFromUser(discordId, unverifiedRoleId);

            // Sync LuckPerms VIP if player already has VIP group on MC
            if (plugin.getLuckPermsSyncManager().isEnabled()) {
                UUID uuid = UUID.fromString(newBinding.getMcUuid());
                plugin.getLuckPermsSyncManager().syncMcToDiscord(uuid, newBinding.getMcUsername());
            }

            // Reply success
            String msg = plugin.getConfigManager().getMessage("discord.dm.success")
                    .replace("{username}", newBinding.getMcUsername());
            event.getChannel().sendMessage(msg).queue();

        } else {
            BindingManager.UserBinding existing = bindingManager.getBindingByDiscordId(discordId);
            if (existing == null) {
                String msg = plugin.getConfigManager().getMessage("discord.dm.help");
                event.getChannel().sendMessage(msg).queue();
            }
        }
    }

    @Override
    public void onGuildMemberRoleAdd(GuildMemberRoleAddEvent event) {
        String vipRoleId = plugin.getConfigManager().getVipRoleId();
        if (vipRoleId.isEmpty()) return;

        for (Role role : event.getRoles()) {
            if (role.getId().equals(vipRoleId)) {
                String discordId = event.getUser().getId();
                plugin.getLuckPermsSyncManager().syncDiscordToMc(discordId, true);
                break;
            }
        }
    }

    @Override
    public void onGuildMemberRoleRemove(GuildMemberRoleRemoveEvent event) {
        String vipRoleId = plugin.getConfigManager().getVipRoleId();
        if (vipRoleId.isEmpty()) return;

        for (Role role : event.getRoles()) {
            if (role.getId().equals(vipRoleId)) {
                String discordId = event.getUser().getId();
                plugin.getLuckPermsSyncManager().syncDiscordToMc(discordId, false);
                break;
            }
        }
    }
}
