package com.craftcore.link;

import com.craftcore.link.binding.BindingManager;
import com.craftcore.link.bot.DiscordBotManager;
import com.craftcore.link.command.DiscordCommand;
import com.craftcore.link.command.RtpCommand;
import com.craftcore.link.config.ConfigManager;
import com.craftcore.link.listener.MinecraftEventListener;
import com.craftcore.link.luckperms.LuckPermsSyncManager;
import org.bukkit.plugin.java.JavaPlugin;

public class CraftCoreLink extends JavaPlugin {

    private static CraftCoreLink instance;
    private ConfigManager configManager;
    private BindingManager bindingManager;
    private LuckPermsSyncManager luckPermsSyncManager;
    private DiscordBotManager discordBotManager;

    @Override
    public void onEnable() {
        instance = this;
        getLogger().info("Enabling Craft-Core Link v" + getDescription().getVersion() + "...");

        // 1. Initialize Configuration
        configManager = new ConfigManager(this);
        configManager.loadConfigs();

        // 2. Initialize Binding Manager
        bindingManager = new BindingManager(this);

        // 3. Initialize Discord Bot Manager
        discordBotManager = new DiscordBotManager(this);
        discordBotManager.start();

        // 4. Initialize LuckPerms Sync Manager
        luckPermsSyncManager = new LuckPermsSyncManager(this);
        luckPermsSyncManager.initialize();

        // 5. Register Events
        getServer().getPluginManager().registerEvents(new MinecraftEventListener(this), this);

        // 6. Register Commands
        DiscordCommand discordCommand = new DiscordCommand(this);
        if (getCommand("discord") != null) {
            getCommand("discord").setExecutor(discordCommand);
            getCommand("discord").setTabCompleter(discordCommand);
        }

        RtpCommand rtpCommand = new RtpCommand(this);
        if (getCommand("rtp") != null) {
            getCommand("rtp").setExecutor(rtpCommand);
            getCommand("rtp").setTabCompleter(rtpCommand);
        }

        getLogger().info("Craft-Core Link has been successfully enabled!");
    }

    @Override
    public void onDisable() {
        getLogger().info("Disabling Craft-Core Link...");

        if (discordBotManager != null) {
            discordBotManager.stop();
        }

        if (bindingManager != null) {
            bindingManager.saveBindings();
        }

        getLogger().info("Craft-Core Link disabled.");
    }

    public static CraftCoreLink getInstance() {
        return instance;
    }

    public ConfigManager getConfigManager() {
        return configManager;
    }

    public BindingManager getBindingManager() {
        return bindingManager;
    }

    public LuckPermsSyncManager getLuckPermsSyncManager() {
        return luckPermsSyncManager;
    }

    public DiscordBotManager getDiscordBotManager() {
        return discordBotManager;
    }
}
