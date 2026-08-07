package com.craftcore.express;

import com.craftcore.gui.MenuRegistry;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.item.ItemStack;

public class CraftCoreExpressMod implements ModInitializer {

    @Override
    public void onInitialize() {
        System.out.println("[CraftCore-Express] Initializing Offline Parcel Express Delivery Sub-Module v2.5.8...");

        ExpressManager.load();

        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            ExpressCommand.register(dispatcher);
        });

        MenuRegistry.registerAction("express_main", (player, arg) -> ExpressGuiManager.openExpressMainMenu(player));
        MenuRegistry.registerAction("express:open", (player, arg) -> ExpressGuiManager.openExpressMainMenu(player));
        MenuRegistry.registerAction("express:inbox", (player, arg) -> ExpressGuiManager.openInboxGui(player));
        MenuRegistry.registerAction("express:send", (player, arg) -> ExpressGuiManager.openSendParcelContainer(player, arg != null && !arg.isBlank() ? arg : null));
        MenuRegistry.registerAction("express:history", (player, arg) -> ExpressGuiManager.openHistoryGui(player));

        ServerMessageEvents.ALLOW_CHAT_MESSAGE.register((message, sender, params) -> {
            if (sender == null) return true;
            String username = sender.getName().getString();
            ExpressManager.PendingSendSession pendingSession = ExpressManager.getPendingSend(username);
            if (pendingSession != null) {
                String text = message.signedContent().trim();
                if ("取消".equalsIgnoreCase(text) || "cancel".equalsIgnoreCase(text)) {
                    ExpressManager.removePendingSend(username);
                    for (ItemStack stack : pendingSession.items) {
                        if (stack != null && !stack.isEmpty()) {
                            sender.getInventory().placeItemBackInInventory(stack);
                        }
                    }
                    sender.sendSystemMessage(Component.literal("§c[Craft-Core] 已取消快遞寄送，物品已歸還至您的背包。"));
                    return false;
                }

                String recipient = text;
                ExpressManager.removePendingSend(username);
                ExpressManager.sendParcel(username, recipient, pendingSession.items, sender.level() != null ? sender.level().registryAccess() : null);
                sender.sendSystemMessage(Component.literal("§b[Craft-Core] §a★ 包裹成功寄出！★"));
                sender.sendSystemMessage(Component.literal("§f- 收件人: §e" + recipient));
                sender.sendSystemMessage(Component.literal("§f- 物品數量: §a" + pendingSession.items.size() + " §f種"));
                sender.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
                return false;
            }
            return true;
        });
    }
}
