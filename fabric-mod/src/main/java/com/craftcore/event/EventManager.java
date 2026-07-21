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
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

public class EventManager {
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    private static final Gson GSON = new Gson();
    private static final String API_URL = "http://localhost:3000/api/events/active";

    public static void checkAndNotifyEvents(ServerPlayer player) {
        if (player == null) return;

        CompletableFuture.runAsync(() -> {
            try {
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(API_URL))
                        .timeout(Duration.ofSeconds(3))
                        .GET()
                        .build();

                HttpResponse<String> resp = HTTP_CLIENT.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() == 200) {
                    JsonObject obj = GSON.fromJson(resp.body(), JsonObject.class);
                    if (obj != null && obj.has("events") && obj.get("events").isJsonArray()) {
                        JsonArray events = obj.getAsJsonArray("events");
                        if (events.size() > 0) {
                            sendEventBroadcast(player, events);
                        }
                    }
                }
            } catch (Exception e) {
                // Ignore if web dashboard backend is offline
            }
        });
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
