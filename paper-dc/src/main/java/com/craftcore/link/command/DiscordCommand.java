package com.craftcore.link.command;

import com.craftcore.link.CraftCoreLink;
import com.craftcore.link.binding.BindingManager;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.List;

public class DiscordCommand implements CommandExecutor, TabCompleter {

    private final CraftCoreLink plugin;

    public DiscordCommand(CraftCoreLink plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length > 0 && args[0].equalsIgnoreCase("reload")) {
            if (!sender.hasPermission("craftcorelink.admin")) {
                sender.sendMessage("§c您沒有權限執行此指令！");
                return true;
            }
            plugin.getConfigManager().loadConfigs();
            sender.sendMessage("§a[Craft-Core Link] 設定檔 reload 成功！");
            return true;
        }

        if (args.length > 0 && (args[0].equalsIgnoreCase("link") || args[0].equalsIgnoreCase("bind"))) {
            if (!(sender instanceof Player player)) {
                sender.sendMessage(plugin.getConfigManager().getMessage("in-game.only-player"));
                return true;
            }

            BindingManager.UserBinding existing = plugin.getBindingManager().getBindingByMcUuid(player.getUniqueId().toString());
            if (existing != null) {
                String msg = plugin.getConfigManager().getMessage("in-game.already-bound")
                        .replace("{username}", player.getName());
                player.sendMessage(msg);
                return true;
            }

            player.sendMessage(plugin.getConfigManager().getMessage("in-game.requesting-code"));
            String code = plugin.getBindingManager().generateCode(player.getUniqueId().toString(), player.getName());

            String msg = plugin.getConfigManager().getMessage("in-game.code-generated")
                    .replace("{code}", code);
            player.sendMessage(msg);
            return true;
        }

        // Default: Show Invite Link
        String inviteUrl = plugin.getConfigManager().getInviteUrl();
        String linkMsg = plugin.getConfigManager().getMessage("in-game.invite-link")
                .replace("{url}", inviteUrl);
        String hoverText = plugin.getConfigManager().getMessage("in-game.invite-hover");

        Component component = LegacyComponentSerializer.legacyAmpersand().deserialize(linkMsg)
                .clickEvent(ClickEvent.openUrl(inviteUrl))
                .hoverEvent(HoverEvent.showText(Component.text(hoverText)));

        sender.sendMessage(component);
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        List<String> completions = new ArrayList<>();
        if (args.length == 1) {
            if ("link".startsWith(args[0].toLowerCase())) completions.add("link");
            if ("bind".startsWith(args[0].toLowerCase())) completions.add("bind");
            if (sender.hasPermission("craftcorelink.admin") && "reload".startsWith(args[0].toLowerCase())) {
                completions.add("reload");
            }
        }
        return completions;
    }
}
