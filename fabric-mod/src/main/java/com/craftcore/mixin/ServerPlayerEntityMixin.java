package com.craftcore.mixin;

import com.craftcore.CraftCoreMod;
import com.craftcore.afk.AfkManager;
import com.craftcore.teleport.BackManager;
import com.craftcore.websocket.Packet;
import com.craftcore.websocket.CraftCoreWSClient;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.server.level.ServerPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ServerPlayer.class)
public class ServerPlayerEntityMixin {
    @Inject(method = "die", at = @At("HEAD"))
    private void onPlayerDeath(DamageSource damageSource, CallbackInfo ci) {
        ServerPlayer player = (ServerPlayer) (Object) this;
        String username = player.getName().getString();
        String uuid = player.getStringUUID();
        String deathMessage = player.getCombatTracker().getDeathMessage().getString();

        // 紀錄死亡位置為返回點
        BackManager.recordLocation(player);

        CraftCoreWSClient client = CraftCoreMod.getWSClient();
        if (client != null && client.isAuthenticated()) {
            client.send(new Packet("event", new Packet.EventPayload(
                    "death", username, uuid, deathMessage
            )));
        }
    }

    @Inject(method = "getTabListDisplayName", at = @At("RETURN"), cancellable = true)
    private void onGetTabListDisplayName(CallbackInfoReturnable<Component> cir) {
        ServerPlayer player = (ServerPlayer) (Object) this;
        String username = player.getName().getString();
        boolean isOwner = "im_little_rory".equalsIgnoreCase(username);
        boolean isAfk = AfkManager.isAfk(player);

        if (isOwner || isAfk) {
            Component original = cir.getReturnValue();
            MutableComponent prefix = Component.empty();
            if (isAfk) {
                prefix.append(Component.literal("§7[AFK] "));
            }
            if (isOwner) {
                prefix.append(Component.literal("§c[服主] "));
            }

            if (original != null) {
                cir.setReturnValue(prefix.append(original));
            } else {
                cir.setReturnValue(prefix.append(player.getDisplayName()));
            }
        }
    }
}
