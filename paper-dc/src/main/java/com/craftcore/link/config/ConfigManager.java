package com.craftcore.link.config;

import com.craftcore.link.CraftCoreLink;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

public class ConfigManager {

    private final CraftCoreLink plugin;
    private File configFile;
    private FileConfiguration config;

    private File messagesFile;
    private FileConfiguration messages;

    public ConfigManager(CraftCoreLink plugin) {
        this.plugin = plugin;
    }

    public void loadConfigs() {
        if (!plugin.getDataFolder().exists()) {
            plugin.getDataFolder().mkdirs();
        }

        // Load config.yml
        configFile = new File(plugin.getDataFolder(), "config.yml");
        if (!configFile.exists()) {
            plugin.saveResource("config.yml", false);
        }
        config = YamlConfiguration.loadConfiguration(configFile);

        // Load messages.yml
        messagesFile = new File(plugin.getDataFolder(), "messages.yml");
        if (!messagesFile.exists()) {
            plugin.saveResource("messages.yml", false);
        }
        messages = YamlConfiguration.loadConfiguration(messagesFile);

        // Merge defaults if needed
        InputStream defaultMessagesStream = plugin.getResource("messages.yml");
        if (defaultMessagesStream != null) {
            YamlConfiguration defaultMessages = YamlConfiguration.loadConfiguration(new InputStreamReader(defaultMessagesStream, StandardCharsets.UTF_8));
            messages.setDefaults(defaultMessages);
        }
    }

    public FileConfiguration getConfig() {
        return config;
    }

    public FileConfiguration getMessages() {
        return messages;
    }

    private String getRawString(String path, String def) {
        Object val = config.get(path);
        if (val == null) return def;
        if (val instanceof Number) {
            return new BigDecimal(val.toString()).toPlainString().trim();
        }
        return val.toString().trim();
    }

    public String getMessage(String path) {
        String msg = messages.getString(path, "");
        return msg.replace("&", "§");
    }

    public String getBotToken() {
        return getRawString("discord.bot-token", "");
    }

    public String getGuildId() {
        return getRawString("discord.guild-id", "");
    }

    public String getChatSyncChannelId() {
        return getRawString("discord.channels.chat-sync", "");
    }

    public String getChatWebhookUrl() {
        return getRawString("discord.chat-webhook-url", "");
    }

    public String getInviteUrl() {
        return getRawString("discord.invite-url", "https://discord.gg");
    }

    public String getVerifiedRoleId() {
        return getRawString("roles.verified-role-id", "1521767183326249100");
    }

    public String getVipRoleId() {
        return getRawString("roles.vip-role-id", "1521773153448099980");
    }

    public String getVipGroupName() {
        return getRawString("luckperms.vip-group-name", "vip");
    }

    public String getAvatarUrl(String uuid) {
        String template = getRawString("minecraft.avatar-provider", "https://mc-heads.net/avatar/{uuid}");
        return template.replace("{uuid}", uuid);
    }

    public boolean isRtpEnabled() {
        return config.getBoolean("rtp.enabled", true);
    }

    public int getRtpCooldownSeconds() {
        return config.getInt("rtp.cooldown-seconds", 60);
    }

    public int getRtpMinRadius() {
        return config.getInt("rtp.min-radius", 500);
    }

    public int getRtpMaxRadius() {
        return config.getInt("rtp.max-radius", 3000);
    }

    public int getRtpMaxAttempts() {
        return config.getInt("rtp.max-attempts", 20);
    }
}
