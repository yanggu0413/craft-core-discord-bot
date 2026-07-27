package com.craftcore.link.luckperms;

import com.craftcore.link.CraftCoreLink;
import com.craftcore.link.binding.BindingManager;
import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.event.EventBus;
import net.luckperms.api.event.node.NodeAddEvent;
import net.luckperms.api.event.node.NodeRemoveEvent;
import net.luckperms.api.event.user.UserDataRecalculateEvent;
import net.luckperms.api.model.user.User;
import net.luckperms.api.node.Node;
import net.luckperms.api.node.NodeType;
import net.luckperms.api.node.types.InheritanceNode;
import org.bukkit.Bukkit;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;

public class LuckPermsSyncManager {

    private final CraftCoreLink plugin;
    private LuckPerms luckPerms;
    private boolean enabled = false;

    public LuckPermsSyncManager(CraftCoreLink plugin) {
        this.plugin = plugin;
    }

    public void initialize() {
        if (!Bukkit.getPluginManager().isPluginEnabled("LuckPerms")) {
            plugin.getLogger().warning("LuckPerms plugin not found. LuckPerms VIP sync is disabled.");
            return;
        }

        try {
            this.luckPerms = LuckPermsProvider.get();
            this.enabled = true;
            registerListeners();
            plugin.getLogger().info("Successfully hooked into LuckPerms API!");
        } catch (Exception e) {
            plugin.getLogger().severe("Failed to hook into LuckPerms API: " + e.getMessage());
        }
    }

    private void registerListeners() {
        if (!enabled || luckPerms == null) return;

        EventBus eventBus = luckPerms.getEventBus();

        eventBus.subscribe(plugin, NodeAddEvent.class, this::onNodeAdd);
        eventBus.subscribe(plugin, NodeRemoveEvent.class, this::onNodeRemove);
        eventBus.subscribe(plugin, UserDataRecalculateEvent.class, this::onUserDataRecalculate);
    }

    private void onNodeAdd(NodeAddEvent event) {
        if (!event.isUser()) return;
        Node node = event.getNode();
        if (node.getType() == NodeType.INHERITANCE) {
            InheritanceNode inheritanceNode = (InheritanceNode) node;
            String groupName = plugin.getConfigManager().getVipGroupName();
            if (inheritanceNode.getGroupName().equalsIgnoreCase(groupName)) {
                User user = (User) event.getTarget();
                syncMcToDiscord(user.getUniqueId(), user.getUsername());
            }
        }
    }

    private void onNodeRemove(NodeRemoveEvent event) {
        if (!event.isUser()) return;
        Node node = event.getNode();
        if (node.getType() == NodeType.INHERITANCE) {
            InheritanceNode inheritanceNode = (InheritanceNode) node;
            String groupName = plugin.getConfigManager().getVipGroupName();
            if (inheritanceNode.getGroupName().equalsIgnoreCase(groupName)) {
                User user = (User) event.getTarget();
                syncMcToDiscord(user.getUniqueId(), user.getUsername());
            }
        }
    }

    private void onUserDataRecalculate(UserDataRecalculateEvent event) {
        User user = event.getUser();
        syncMcToDiscord(user.getUniqueId(), user.getUsername());
    }

    public boolean hasVipGroup(UUID uuid) {
        if (!enabled || luckPerms == null) return false;
        User user = luckPerms.getUserManager().getUser(uuid);
        if (user == null) {
            user = luckPerms.getUserManager().loadUser(uuid).join();
        }
        if (user == null) return false;

        String vipGroup = plugin.getConfigManager().getVipGroupName();
        return user.getNodes(NodeType.INHERITANCE).stream()
                .anyMatch(node -> node.getGroupName().equalsIgnoreCase(vipGroup));
    }

    public void syncMcToDiscord(UUID uuid, String username) {
        if (!enabled) return;
        BindingManager.UserBinding binding = plugin.getBindingManager().getBindingByMcUuid(uuid.toString());
        if (binding == null) return;

        boolean hasVip = hasVipGroup(uuid);
        String discordId = binding.getDiscordId();
        String vipRoleId = plugin.getConfigManager().getVipRoleId();

        if (hasVip) {
            plugin.getDiscordBotManager().addRoleToUser(discordId, vipRoleId);
        } else {
            plugin.getDiscordBotManager().removeRoleFromUser(discordId, vipRoleId);
        }
    }

    public void syncDiscordToMc(String discordId, boolean addVip) {
        if (!enabled || luckPerms == null) return;
        BindingManager.UserBinding binding = plugin.getBindingManager().getBindingByDiscordId(discordId);
        if (binding == null) return;

        UUID uuid = UUID.fromString(binding.getMcUuid());
        String vipGroup = plugin.getConfigManager().getVipGroupName();

        luckPerms.getUserManager().modifyUser(uuid, user -> {
            InheritanceNode node = InheritanceNode.builder(vipGroup).build();
            if (addVip) {
                user.data().add(node);
                plugin.getLogger().info("Granted LuckPerms group '" + vipGroup + "' to " + binding.getMcUsername() + " via Discord VIP role.");
            } else {
                user.data().remove(node);
                plugin.getLogger().info("Removed LuckPerms group '" + vipGroup + "' from " + binding.getMcUsername() + " via Discord VIP role.");
            }
        });
    }

    public boolean isEnabled() {
        return enabled;
    }
}
