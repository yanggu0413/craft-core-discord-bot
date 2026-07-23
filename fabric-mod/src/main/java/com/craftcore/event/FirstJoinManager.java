package com.craftcore.event;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class FirstJoinManager {
    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Set<String> claimedPlayers = ConcurrentHashMap.newKeySet();

    static {
        try {
            configPath = FabricLoader.getInstance().getConfigDir()
                    .resolve("craft-core-shop").resolve("first_join_claimed.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "first_join_claimed.json");
        }
        load();
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Set<String> loaded = GSON.fromJson(reader, new TypeToken<Set<String>>(){}.getType());
                if (loaded != null) {
                    claimedPlayers.clear();
                    claimedPlayers.addAll(loaded);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load first_join_claimed: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            try {
                Files.createDirectories(configPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                    GSON.toJson(claimedPlayers, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save first_join_claimed: " + e.getMessage());
            }
        }
    }

    public static synchronized void checkAndHandleFirstJoin(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();

        if (claimedPlayers.contains(username.toLowerCase())) {
            return; // Already claimed starter kit
        }

        // Mark as claimed and save
        claimedPlayers.add(username.toLowerCase());
        save();

        // 1. Give $1,000 Starter Money & Starter Kit: Stone Pickaxe x1, Stone Axe x1, Stone Sword x1, Bread x20
        com.craftcore.economy.EconomyManager.addMoney(username, 1000.0);
        giveItemOrDrop(player, new ItemStack(Items.STONE_PICKAXE, 1));
        giveItemOrDrop(player, new ItemStack(Items.STONE_AXE, 1));
        giveItemOrDrop(player, new ItemStack(Items.STONE_SWORD, 1));
        giveItemOrDrop(player, new ItemStack(Items.BREAD, 20));

        // 2. Send Guidance Card Component (Personalized welcome card)
        player.sendSystemMessage(Component.literal("§6🎉================== 歡迎來到 Craft-Core 伺服器！ ==================🎉"));
        player.sendSystemMessage(Component.literal("§f親愛的 §e" + username + "§f 您好！歡迎您首次加入伺服器！已獲得新手起步金 §a$1,000 元§f！"));
        player.sendSystemMessage(Component.literal("§f首塊保護領地劃設完全免費（手持木鋤劃設後輸入 §a/claim§f 即可建立）！"));
        player.sendSystemMessage(Component.literal(""));

        // Clickable docs link
        String docsUrl = "https://docs.craft-core.xyz";
        Component docsLink = Component.literal("§f📖 新手入門教學文件：§b§n" + docsUrl)
                .withStyle(style -> style
                        .withClickEvent(new ClickEvent.OpenUrl(URI.create(docsUrl)))
                        .withHoverEvent(new HoverEvent.ShowText(Component.literal("點擊在此開啟教學文件網頁")))
                );
        player.sendSystemMessage(docsLink);

        // Clickable bind command
        Component bindCmd = Component.literal("§f🔗 帳號綁定獲得白名單與禮包：§e[點此發送 /discord link 進行綁定]")
                .withStyle(style -> style
                        .withClickEvent(new ClickEvent.RunCommand("/discord link"))
                        .withHoverEvent(new HoverEvent.ShowText(Component.literal("點擊自動於聊天欄輸入 /discord link")))
                );
        player.sendSystemMessage(bindCmd);

        player.sendSystemMessage(Component.literal(""));
        player.sendSystemMessage(Component.literal("§a🎁 系統已自動將新手裝備禮包（石鎬、石斧、石劍與 20 個麵包）發送至您的背包！"));
        player.sendSystemMessage(Component.literal("§6========================================================================"));
    }

    private static void giveItemOrDrop(ServerPlayer player, ItemStack stack) {
        if (!player.getInventory().add(stack)) {
            player.drop(stack, false);
        }
    }
}
