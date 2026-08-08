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
            if (player != null && com.craftcore.fakeplayer.FakePlayerManager.isFakePlayer(player)) {
                return; // Block fake players from getting achievements or rewards
            }
            PlayerAdvancements tracker = (PlayerAdvancements) (Object) this;
            AdvancementProgress progress = tracker.getOrStartProgress(advancement);
            if (progress.isDone()) {
                String advId = advancement.id().toString();
                String username = player.getName().getString();

                if (advId.startsWith("craftcore:")) {
                    handleCraftCoreReward(username, advId);
                }

                advancement.value().display().ifPresent(display -> {
                    if (display.shouldAnnounceChat()) {
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

    private void handleCraftCoreReward(String username, String advId) {
        switch (advId) {
            case "craftcore:diamond_1000" -> {
                com.craftcore.economy.EconomyManager.addMoney(username, 5000);
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已獲得 $5,000 元金幣！"));
            }
            case "craftcore:mace_pig_fall" -> {
                com.craftcore.economy.EconomyManager.addMoney(username, 1500);
                com.craftcore.title.TitleManager.unlockTitle(username, "§c[重鎚大師]");
                com.craftcore.title.TitleManager.setActiveTitle(username, "§c[重鎚大師]");
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已獲得 $1,500 元金幣，並解鎖且自動佩戴稱號 §c[重鎚大師]§a！"));
            }
            case "craftcore:mine_10000" -> {
                com.craftcore.economy.EconomyManager.addMoney(username, 3000);
                com.craftcore.title.TitleManager.unlockTitle(username, "§e[挖掘機]");
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已獲得 $3,000 元金幣，並解鎖稱號 §e[挖掘機]§a！"));
            }
            case "craftcore:breed_30" -> {
                com.craftcore.economy.EconomyManager.addMoney(username, 800);
                com.craftcore.title.TitleManager.unlockTitle(username, "§a[繁殖高手]");
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已獲得 $800 元金幣，並解鎖稱號 §a[繁殖高手]§a！"));
            }
            case "craftcore:eat_100_spider_eyes" -> {
                com.craftcore.economy.EconomyManager.addMoney(username, 1200);
                com.craftcore.title.TitleManager.unlockTitle(username, "§d[蜘蛛人]");
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已獲得 $1,200 元金幣，並解鎖稱號 §d[蜘蛛人]§a！"));
            }
            case "craftcore:play_100_days" -> {
                com.craftcore.economy.EconomyManager.addMoney(username, 15000);
                com.craftcore.title.TitleManager.unlockTitle(username, "§6[老玩家]");
                com.craftcore.title.TitleManager.setActiveTitle(username, "§6[老玩家]");
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已獲得 $15,000 元金幣，並解鎖且自動佩戴稱號 §6[老玩家]§a！"));
            }
            case "craftcore:jump_10000" -> {
                com.craftcore.economy.EconomyManager.addMoney(username, 888);
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已獲得 $888 元金幣！"));
            }
            case "craftcore:elytra_10000" -> {
                com.craftcore.economy.EconomyManager.addMoney(username, 1200);
                com.craftcore.title.TitleManager.unlockTitle(username, "§b[一隻鳥]");
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已獲得 $1,200 元金幣，並解鎖稱號 §b[一隻鳥]§a！"));
            }
            case "craftcore:hit_bedrock" -> {
                com.craftcore.economy.EconomyManager.addMoney(username, 100);
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已獲得 $100 元金幣！"));
            }
            case "craftcore:look_down_10m" -> {
                com.craftcore.economy.EconomyManager.addMoney(username, 300);
                com.craftcore.title.TitleManager.unlockTitle(username, "§8[低頭族]");
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已獲得 $300 元金幣，並解鎖稱號 §8[低頭族]§a！"));
            }
            case "craftcore:express_30" -> {
                com.craftcore.title.TitleManager.unlockTitle(username, "§e[黑貓宅急便]");
                com.craftcore.title.TitleManager.setActiveTitle(username, "§e[黑貓宅急便]");
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已解鎖且自動佩戴稱號 §e[黑貓宅急便]§a！"));
            }
            case "craftcore:checkin_30_days" -> {
                com.craftcore.economy.EconomyManager.addMoney(username, 1500);
                com.craftcore.title.TitleManager.unlockTitle(username, "§e[我愛簽到]");
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已獲得 $1,500 元金幣，並解鎖稱號 §e[我愛簽到]§a！"));
            }
            case "craftcore:millionaire" -> {
                com.craftcore.title.TitleManager.unlockTitle(username, "§6[百萬富翁]");
                com.craftcore.title.TitleManager.setActiveTitle(username, "§6[百萬富翁]");
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：已解鎖且自動佩戴稱號 §6[百萬富翁]§a！"));
            }
            case "craftcore:end_370k" -> {
                com.craftcore.economy.EconomyManager.addMoney(username, 10000);
                player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§b[Craft-Core] §a成就獎勵：成功抵達終界 370,000 格極限！已獲得 $10,000 元金幣！"));
            }
        }
    }
}
