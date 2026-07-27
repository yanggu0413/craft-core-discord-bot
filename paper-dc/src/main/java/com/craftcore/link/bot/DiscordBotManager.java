package com.craftcore.link.bot;

import com.craftcore.link.CraftCoreLink;
import com.craftcore.link.util.AdvancementTranslationUtil;
import com.google.gson.JsonObject;

import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.JDABuilder;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.Role;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.entities.channel.middleman.GuildMessageChannel;
import net.dv8tion.jda.api.requests.GatewayIntent;
import net.dv8tion.jda.api.utils.MemberCachePolicy;

import java.awt.Color;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

public class DiscordBotManager {

    private final CraftCoreLink plugin;
    private JDA jda;
    private final ExecutorService asyncExecutor = Executors.newSingleThreadExecutor();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public DiscordBotManager(CraftCoreLink plugin) {
        this.plugin = plugin;
    }

    public void start() {
        String token = plugin.getConfigManager().getBotToken();
        if (token == null || token.isEmpty() || token.contains("YOUR_DISCORD_BOT_TOKEN")) {
            plugin.getLogger().warning("Discord Bot Token is not set in config.yml. Discord integration is disabled.");
            return;
        }

        asyncExecutor.submit(() -> {
            try {
                jda = JDABuilder.createDefault(token)
                        .enableIntents(
                                GatewayIntent.GUILD_MEMBERS,
                                GatewayIntent.GUILD_MESSAGES,
                                GatewayIntent.DIRECT_MESSAGES,
                                GatewayIntent.MESSAGE_CONTENT
                        )
                        .setMemberCachePolicy(MemberCachePolicy.ALL)
                        .addEventListeners(new DiscordListener(plugin))
                        .build();

                jda.awaitReady();
                plugin.getLogger().info("Successfully logged into Discord Bot as " + jda.getSelfUser().getAsTag() + "!");

                String channelId = plugin.getConfigManager().getChatSyncChannelId();
                plugin.getLogger().info("Configured Chat Sync Channel ID: '" + channelId + "'");

                // Send server start message
                sendServerStart();

            } catch (Exception e) {
                plugin.getLogger().severe("Failed to initialize Discord Bot: " + e.getMessage());
            }
        });
    }

    public void stop() {
        if (jda != null) {
            try {
                sendServerStop();
                jda.shutdown();
            } catch (Exception ignored) {}
        }
        asyncExecutor.shutdown();
    }

    public JDA getJda() {
        return jda;
    }

    private void getGuildMessageChannel(String channelId, Consumer<GuildMessageChannel> consumer) {
        if (jda == null) return;
        if (channelId == null || channelId.trim().isEmpty() || channelId.contains("YOUR_CHAT_SYNC_CHANNEL_ID")) {
            plugin.getLogger().warning("Chat sync channel ID is not configured or invalid in config.yml!");
            return;
        }

        String cleanId = channelId.trim();

        // 1. Try JDA global channel lookup by GuildMessageChannel type (covers TextChannel & NewsChannel)
        GuildMessageChannel channel = jda.getChannelById(GuildMessageChannel.class, cleanId);

        // 2. Try Guild channel cache
        if (channel == null) {
            String guildId = plugin.getConfigManager().getGuildId();
            if (!guildId.isEmpty()) {
                Guild guild = jda.getGuildById(guildId);
                if (guild != null) {
                    channel = guild.getChannelById(GuildMessageChannel.class, cleanId);
                } else {
                    plugin.getLogger().warning("Bot is NOT in Guild ID '" + guildId + "'! Please verify guild-id in config.yml.");
                }
            }
        }

        // 3. Try TextChannel fallback
        if (channel == null) {
            channel = jda.getTextChannelById(cleanId);
        }

        if (channel != null) {
            consumer.accept(channel);
        } else {
            plugin.getLogger().warning("Could not find Discord Channel with ID '" + cleanId + "'. Please check:\n" +
                    "1. Is the Bot added to Discord Server Guild ID '" + plugin.getConfigManager().getGuildId() + "'?\n" +
                    "2. Does the Bot have 'View Channel' and 'Send Messages' permissions in channel " + cleanId + "?");
        }
    }

    public void sendChat(String sender, String uuid, String message) {
        if (jda == null) return;
        String webhookUrl = plugin.getConfigManager().getChatWebhookUrl();

        if (webhookUrl != null && !webhookUrl.trim().isEmpty() && !webhookUrl.contains("YOUR_WEBHOOK_URL")) {
            asyncExecutor.submit(() -> {
                try {
                    String avatarUrl = plugin.getConfigManager().getAvatarUrl(uuid);
                    JsonObject json = new JsonObject();
                    json.addProperty("username", sender);
                    json.addProperty("avatar_url", avatarUrl);
                    json.addProperty("content", message);

                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(webhookUrl))
                            .header("Content-Type", "application/json; charset=UTF-8")
                            .timeout(Duration.ofSeconds(5))
                            .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                            .build();

                    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                    if (response.statusCode() >= 200 && response.statusCode() < 300) {
                        return;
                    }
                    plugin.getLogger().warning("Webhook HTTP POST returned code " + response.statusCode() + ", falling back to channel chat.");
                } catch (Exception e) {
                    plugin.getLogger().warning("Failed to send webhook chat message: " + e.getMessage());
                }
                fallbackChannelChat(sender, message);
            });
        } else {
            fallbackChannelChat(sender, message);
        }
    }

    private void fallbackChannelChat(String sender, String message) {
        String channelId = plugin.getConfigManager().getChatSyncChannelId();
        asyncExecutor.submit(() -> {
            getGuildMessageChannel(channelId, channel -> {
                String template = plugin.getConfigManager().getMessage("discord.chat-fallback-format");
                String formatted = template.replace("{sender}", sender).replace("{message}", message);
                channel.sendMessage(formatted).queue(
                        v -> {},
                        err -> plugin.getLogger().warning("Failed to send chat message to Discord channel: " + err.getMessage())
                );
            });
        });
    }

    public void sendServerStart() {
        if (jda == null) return;
        String channelId = plugin.getConfigManager().getChatSyncChannelId();
        asyncExecutor.submit(() -> {
            getGuildMessageChannel(channelId, channel -> {
                String msg = plugin.getConfigManager().getMessage("discord.server-start");
                channel.sendMessage(msg).queue(
                        v -> {},
                        err -> plugin.getLogger().warning("Failed to send server-start message: " + err.getMessage())
                );
            });
        });
    }

    public void sendServerStop() {
        if (jda == null) return;
        String channelId = plugin.getConfigManager().getChatSyncChannelId();
        getGuildMessageChannel(channelId, channel -> {
            String msg = plugin.getConfigManager().getMessage("discord.server-stop");
            channel.sendMessage(msg).complete();
        });
    }

    public void sendJoinEmbed(String username, String uuid) {
        if (jda == null) return;
        String channelId = plugin.getConfigManager().getChatSyncChannelId();

        asyncExecutor.submit(() -> {
            getGuildMessageChannel(channelId, channel -> {
                String avatarUrl = plugin.getConfigManager().getAvatarUrl(uuid);
                String authorFormat = plugin.getConfigManager().getMessage("discord.embeds.join.author");
                String authorName = authorFormat.replace("{username}", username);

                EmbedBuilder embed = new EmbedBuilder()
                        .setColor(new Color(0x55, 0xFF, 0x55)) // Light green
                        .setAuthor(authorName, null, avatarUrl);

                channel.sendMessageEmbeds(embed.build()).queue(
                        v -> {},
                        err -> plugin.getLogger().warning("Failed to send join embed: " + err.getMessage())
                );
            });
        });
    }

    public void sendLeaveEmbed(String username, String uuid) {
        if (jda == null) return;
        String channelId = plugin.getConfigManager().getChatSyncChannelId();

        asyncExecutor.submit(() -> {
            getGuildMessageChannel(channelId, channel -> {
                String avatarUrl = plugin.getConfigManager().getAvatarUrl(uuid);
                String authorFormat = plugin.getConfigManager().getMessage("discord.embeds.leave.author");
                String authorName = authorFormat.replace("{username}", username);

                EmbedBuilder embed = new EmbedBuilder()
                        .setColor(new Color(0xFF, 0x55, 0x55)) // Red
                        .setAuthor(authorName, null, avatarUrl);

                channel.sendMessageEmbeds(embed.build()).queue(
                        v -> {},
                        err -> plugin.getLogger().warning("Failed to send leave embed: " + err.getMessage())
                );
            });
        });
    }

    public void sendDeathEmbed(String username, String uuid, String translatedDeathMessage) {
        if (jda == null) return;
        String channelId = plugin.getConfigManager().getChatSyncChannelId();

        asyncExecutor.submit(() -> {
            getGuildMessageChannel(channelId, channel -> {
                String avatarUrl = plugin.getConfigManager().getAvatarUrl(uuid);
                String authorFormat = plugin.getConfigManager().getMessage("discord.embeds.death.author");
                String authorName = authorFormat.replace("{username}", username);

                String descFormat = plugin.getConfigManager().getMessage("discord.embeds.death.description");
                String description = descFormat.replace("{death_message}", translatedDeathMessage);

                EmbedBuilder embed = new EmbedBuilder()
                        .setColor(new Color(0xFF, 0x55, 0x55)) // Red
                        .setAuthor(authorName, null, avatarUrl)
                        .setDescription(description);

                channel.sendMessageEmbeds(embed.build()).queue(
                        v -> {},
                        err -> plugin.getLogger().warning("Failed to send death embed: " + err.getMessage())
                );
            });
        });
    }

    public void sendAdvancementEmbed(String username, String uuid, String originalTitle, String originalDesc, String itemId) {
        if (jda == null) return;
        String channelId = plugin.getConfigManager().getChatSyncChannelId();

        asyncExecutor.submit(() -> {
            getGuildMessageChannel(channelId, channel -> {
                String avatarUrl = plugin.getConfigManager().getAvatarUrl(uuid);
                AdvancementTranslationUtil.AdvancementText trans = AdvancementTranslationUtil.translate(originalTitle, originalDesc);

                String authorFormat = plugin.getConfigManager().getMessage("discord.embeds.advancement.author");
                String authorName = authorFormat.replace("{username}", username).replace("{title}", trans.getTitle());

                String descFormat = plugin.getConfigManager().getMessage("discord.embeds.advancement.description");
                String description = descFormat.replace("{description}", trans.getDescription());

                EmbedBuilder embed = new EmbedBuilder()
                        .setColor(new Color(0xFF, 0xAA, 0x00)) // Gold / Yellow
                        .setAuthor(authorName, null, avatarUrl)
                        .setDescription(description);

                if (itemId != null && !itemId.isEmpty()) {
                    String cleanItemId = itemId.replace("minecraft:", "");
                    embed.setThumbnail("https://api.minecraftitems.xyz/api/item/" + cleanItemId + "/size=8");
                }

                channel.sendMessageEmbeds(embed.build()).queue(
                        v -> {},
                        err -> plugin.getLogger().warning("Failed to send advancement embed: " + err.getMessage())
                );
            });
        });
    }

    public void addRoleToUser(String discordId, String roleId) {
        if (jda == null || roleId == null || roleId.isEmpty()) return;
        String guildId = plugin.getConfigManager().getGuildId();
        if (guildId.isEmpty()) return;

        asyncExecutor.submit(() -> {
            try {
                Guild guild = jda.getGuildById(guildId);
                if (guild == null) {
                    plugin.getLogger().warning("Could not find Guild with ID '" + guildId + "' for role assignment.");
                    return;
                }
                Role role = guild.getRoleById(roleId);
                if (role == null) {
                    plugin.getLogger().warning("Could not find Role with ID '" + roleId + "' in Guild.");
                    return;
                }

                guild.retrieveMemberById(discordId).queue(member -> {
                    if (member != null && !member.getRoles().contains(role)) {
                        guild.addRoleToMember(member, role).queue(
                                v -> plugin.getLogger().info("Successfully added role " + role.getName() + " to Discord user " + member.getUser().getAsTag()),
                                err -> plugin.getLogger().warning("Failed to add role to user: " + err.getMessage())
                        );
                    }
                }, err -> plugin.getLogger().warning("Could not find Discord member " + discordId + ": " + err.getMessage()));
            } catch (Exception e) {
                plugin.getLogger().warning("Error adding role to user: " + e.getMessage());
            }
        });
    }

    public void removeRoleFromUser(String discordId, String roleId) {
        if (jda == null || roleId == null || roleId.isEmpty()) return;
        String guildId = plugin.getConfigManager().getGuildId();
        if (guildId.isEmpty()) return;

        asyncExecutor.submit(() -> {
            try {
                Guild guild = jda.getGuildById(guildId);
                if (guild == null) return;
                Role role = guild.getRoleById(roleId);
                if (role == null) return;

                guild.retrieveMemberById(discordId).queue(member -> {
                    if (member != null && member.getRoles().contains(role)) {
                        guild.removeRoleFromMember(member, role).queue(
                                v -> plugin.getLogger().info("Successfully removed role " + role.getName() + " from Discord user " + member.getUser().getAsTag()),
                                err -> plugin.getLogger().warning("Failed to remove role from user: " + err.getMessage())
                        );
                    }
                }, err -> plugin.getLogger().warning("Could not find Discord member " + discordId + ": " + err.getMessage()));
            } catch (Exception e) {
                plugin.getLogger().warning("Error removing role from user: " + e.getMessage());
            }
        });
    }
}
