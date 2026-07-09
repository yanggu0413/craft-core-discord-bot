package com.craftcore.mixin;

import com.craftcore.CraftCoreMod;
import com.craftcore.websocket.Packet;
import com.craftcore.websocket.CraftCoreWSClient;
import net.minecraft.advancement.AdvancementEntry;
import net.minecraft.advancement.AdvancementProgress;
import net.minecraft.advancement.PlayerAdvancementTracker;
import net.minecraft.server.network.ServerPlayerEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(PlayerAdvancementTracker.class)
public class PlayerAdvancementTrackerMixin {

    @Shadow
    private ServerPlayerEntity owner;

    @Inject(method = "grantCriterion", at = @At("RETURN"))
    private void onGrantCriterion(AdvancementEntry advancement, String criterionName, CallbackInfoReturnable<Boolean> cir) {
        if (cir.getReturnValue()) {
            PlayerAdvancementTracker tracker = (PlayerAdvancementTracker) (Object) this;
            AdvancementProgress progress = tracker.getProgress(advancement);
            if (progress.isDone()) {
                advancement.value().display().ifPresent(display -> {
                    if (display.shouldAnnounceToChat()) {
                        String username = owner.getName().getString();
                        String uuid = owner.getUuidAsString();
                        String title = display.getTitle().getString();
                        String description = display.getDescription().getString();
                        String itemId = net.minecraft.registry.Registries.ITEM.getId(display.getIcon().getItem()).toString();
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
