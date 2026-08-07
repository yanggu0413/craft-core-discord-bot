package com.craftcore.protection.listener;

import com.craftcore.protection.lockbox.LockboxManager;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionResult;

public class LockboxProtectionListener {

    public static void register() {
        UseBlockCallback.EVENT.register((player, world, hand, hitResult) -> {
            if (world.isClientSide() || !(player instanceof ServerPlayer sp)) {
                return InteractionResult.PASS;
            }
            BlockPos pos = hitResult.getBlockPos();
            if (!LockboxManager.canOpen(sp, pos, world)) {
                return InteractionResult.FAIL;
            }
            return InteractionResult.PASS;
        });

        ServerMessageEvents.ALLOW_CHAT_MESSAGE.register((message, sender, params) -> {
            String username = sender.getName().getString();
            if (LockboxManager.pendingLocks.containsKey(username.toLowerCase()) || LockboxManager.pendingLocks.containsKey(username)) {
                String chatContent = message.signedContent();
                LockboxManager.handleChatPassword(sender, chatContent);
                return false;
            }
            return true;
        });
    }
}
