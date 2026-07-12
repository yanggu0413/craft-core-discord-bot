package com.craftcore.mixin;

import com.craftcore.CraftCoreMod;
import com.craftcore.websocket.Packet;
import com.craftcore.websocket.CraftCoreWSClient;
import net.minecraft.advancements.AdvancementHolder;
import net.minecraft.advancements.AdvancementProgress;
import net.minecraft.server.PlayerAdvancements;
import net.minecraft.server.level.ServerPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(PlayerAdvancements.class)
public class PlayerAdvancementTrackerMixin {

    @Shadow
    private ServerPlayer player;

    @Inject(method = "award", at = @At("RETURN"))
    private void onAward(AdvancementHolder advancement, String criterionName, CallbackInfoReturnable<Boolean> cir) {
        if (cir.getReturnValue()) {
            PlayerAdvancements tracker = (PlayerAdvancements) (Object) this;
            AdvancementProgress progress = tracker.getOrStartProgress(advancement);
            if (progress.isDone()) {
                advancement.value().display().ifPresent(display -> {
                    if (display.shouldAnnounceChat()) {
                        String username = player.getName().getString();
                        String uuid = player.getStringUUID();
                        String title = display.getTitle().getString();
                        String description = display.getDescription().getString();
                        String itemId = net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(display.getIcon().item().value()).toString();
                        String details = title + "|" + description + "|" + itemId;

                        CraftCoreWSClient client = CraftCoreMod.getWSClient();
                        if (client != null && client.isAuthenticated()) {
                            client.send(new Packet("event", new Packet.EventPayload(
                                    "advancement", username, uuid, details
                             )));
                        }
                    }
                });
            }
        }
    }
}
