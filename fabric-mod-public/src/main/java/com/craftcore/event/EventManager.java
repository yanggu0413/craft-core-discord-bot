package com.craftcore.event;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.server.level.ServerPlayer;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;

public class EventManager {
    private static final Gson GSON = new Gson();

    public static void checkAndNotifyEvents(ServerPlayer player) {
        checkAndNotifyEvents(player, false);
    }

    public static void checkAndNotifyEvents(ServerPlayer player, boolean isManualCommand) {
        if (player == null) return;

        boolean foundEvents = false;
        try {
            Path eventsPath = com.craftcore.util.FabricPathUtil.getShopConfigDir().resolve("events.json");
            if (!Files.exists(eventsPath)) {
                Path altPath = Path.of("config", "craft-core", "data", "events.json");
                if (Files.exists(altPath)) {
                    eventsPath = altPath;
                }
            }

            if (Files.exists(eventsPath)) {
                String json = Files.readString(eventsPath);
                JsonObject obj = GSON.fromJson(json, JsonObject.class);
                if (obj != null && obj.has("events") && obj.get("events").isJsonArray()) {
                    JsonArray events = obj.getAsJsonArray("events");
                    if (events.size() > 0) {
                        sendEventBroadcast(player, events);
                        foundEvents = true;
                    }
                }
            }
        } catch (Exception ignored) {}

        if (!foundEvents && isManualCommand) {
            player.sendSystemMessage(Component.literal("§e[Craft-Core] 目前尚無舉辦中的活動，請關注官方 Discord 與網頁公告！"));
        }
    }

    public static void sendEventBroadcast(ServerPlayer player, JsonArray events) {
        player.sendSystemMessage(Component.literal("§e🎪================== 伺服器限時熱門活動進行中 ==================🎪"));
        
        for (JsonElement elem : events) {
            if (!elem.isJsonObject()) continue;
            JsonObject ev = elem.getAsJsonObject();
            String title = ev.has("title") ? ev.get("title").getAsString() : "熱門活動";
            String reward = ev.has("reward_info") ? ev.get("reward_info").getAsString() : "";
            
            player.sendSystemMessage(Component.literal("§f🔥 活動主題：§6" + title));
            if (!reward.isEmpty()) {
                player.sendSystemMessage(Component.literal("§f🎁 限時獎勵：§a" + reward));
            }
        }

        Component linkComp = Component.literal("§f👉 查看完整活動與詳情說明：§b§n[點此開啟網頁活動面板]")
                .withStyle(style -> style
                        .withClickEvent(new ClickEvent.OpenUrl(URI.create("https://docs.craft-core.xyz")))
                        .withHoverEvent(new HoverEvent.ShowText(Component.literal("開啟瀏覽器查看更多活動")))
                );
        player.sendSystemMessage(linkComp);
        player.sendSystemMessage(Component.literal("§e🎪========================================================================🎪"));
    }
}
