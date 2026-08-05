package com.craftcore.fish;

import com.craftcore.economy.EconomyManager;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.ItemLore;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class FishSellManager {

    private static final Pattern LENGTH_PATTERN = Pattern.compile("魚類尺寸:\\s*§e([0-9.]+)\\s*cm");
    private static final Pattern WEIGHT_PATTERN = Pattern.compile("魚類重量:\\s*§b([0-9.]+)\\s*kg");

    public static double calculateFishPrice(ItemStack stack) {
        if (stack == null || stack.isEmpty()) return 0.0;
        if (!stack.has(DataComponents.CUSTOM_NAME)) return 0.0;

        String customName = stack.get(DataComponents.CUSTOM_NAME).getString();
        if (!customName.startsWith("§6★ ")) return 0.0;

        double lengthCm = 50.0;
        double weightKg = 20.0;

        if (stack.has(DataComponents.LORE)) {
            ItemLore lore = stack.get(DataComponents.LORE);
            if (lore != null) {
                for (Component comp : lore.lines()) {
                    String text = comp.getString();
                    Matcher lm = LENGTH_PATTERN.matcher(text);
                    if (lm.find()) {
                        try { lengthCm = Double.parseDouble(lm.group(1)); } catch (Exception ignored) {}
                    }
                    Matcher wm = WEIGHT_PATTERN.matcher(text);
                    if (wm.find()) {
                        try { weightKg = Double.parseDouble(wm.group(1)); } catch (Exception ignored) {}
                    }
                }
            }
        }

        // Base $20.0 + (lengthCm * 0.3) + (weightKg * 0.4), capped at $300.0 max per fish
        double rawPrice = 20.0 + (lengthCm * 0.3) + (weightKg * 0.4);
        return Math.min(300.0, Math.max(20.0, rawPrice));
    }

    public static boolean sellHandheldFish(ServerPlayer player) {
        if (player == null) return false;
        ItemStack hand = player.getMainHandItem();
        double price = calculateFishPrice(hand);

        if (price <= 0) {
            player.sendSystemMessage(Component.literal("§c[售魚商店] 請主手拿著在 craftcore:fishing 釣到的奇幻 NBT 魚類！"));
            return false;
        }

        String username = player.getName().getString();
        String fishName = hand.get(DataComponents.CUSTOM_NAME).getString().replace("§6★ ", "");

        hand.shrink(1);
        EconomyManager.addMoney(username, price);

        player.sendSystemMessage(Component.literal(String.format("§a💰 [售魚成功] 成功售出【%s】，獲得金幣 §e$%.1f 元§a！", fishName, price)));
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.EXPERIENCE_ORB_PICKUP, SoundSource.PLAYERS, 1.0f, 1.2f);
        return true;
    }

    public static void sellAllInventoryFish(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();

        double totalRevenue = 0.0;
        int count = 0;

        for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
            ItemStack stack = player.getInventory().getItem(i);
            double price = calculateFishPrice(stack);
            if (price > 0) {
                int qty = stack.getCount();
                totalRevenue += (price * qty);
                count += qty;
                player.getInventory().setItem(i, ItemStack.EMPTY);
            }
        }

        if (count > 0) {
            EconomyManager.addMoney(username, totalRevenue);
            player.sendSystemMessage(Component.literal(String.format("§a💰 [一鍵全售] 成功售出背包內 §e%d 條§a 奇幻魚類，總共獲取金幣 §e$%.1f 元§a！", count, totalRevenue)));
            player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 1.0f, 1.5f);
        } else {
            player.sendSystemMessage(Component.literal("§c[售魚商店] 背包內沒有可出售的奇幻 NBT 魚類！"));
        }
    }
}
