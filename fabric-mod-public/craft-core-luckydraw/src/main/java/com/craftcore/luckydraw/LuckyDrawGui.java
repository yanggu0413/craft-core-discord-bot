package com.craftcore.luckydraw;

import com.craftcore.gui.BaseChestGui;
import com.craftcore.util.ItemUtil;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

import java.util.List;

public class LuckyDrawGui extends BaseChestGui {

    public LuckyDrawGui() {
        super(3, "§8❖ 🎰 幸運大抽獎 ❖");
    }

    @Override
    protected void build(ServerPlayer player) {
        fillBackground(ItemUtil.createGuiItem(ItemUtil.getItem("minecraft:gray_stained_glass_pane"), " ", null));

        String username = player.getName().getString();
        int keys = LuckyDrawManager.getKeys(username);

        // Indicator markers
        setItem(4, ItemUtil.createGuiItem(ItemUtil.getItem("minecraft:red_stained_glass_pane"), "§e▼ 得獎位置 ▼", null), null);
        setItem(22, ItemUtil.createGuiItem(ItemUtil.getItem("minecraft:red_stained_glass_pane"), "§e▲ 得獎位置 ▲", null), null);

        // Initial conveyor display slots 9..17
        for (int s = 9; s <= 17; s++) {
            LuckyDrawManager.PrizeEntry prize = LuckyDrawManager.rollRandomPrize();
            setItem(s, ItemUtil.createGuiItem(prize.item, prize.displayName + " §f(x" + prize.amount + ")", null), null);
        }

        // Batch Draw Buttons
        setItem(18, ItemUtil.createGuiItem(Items.NETHER_STAR, "§a🎰 1 抽 (消耗 1 把鑰匙)", List.of(
                "§7目前擁有鑰匙: §e" + keys + " 把",
                "",
                "§e[點擊啟動單次轉盤抽獎]"
        )), (p, click) -> {
            if (LuckyDrawManager.getKeys(username) < 1) {
                p.sendSystemMessage(net.minecraft.network.chat.Component.literal("§c[Craft-Core] 鑰匙不足！無法進行抽獎。"));
                return;
            }
            LuckyDrawManager.removeKeys(username, 1);
            LuckyDrawManager.PrizeEntry prize = LuckyDrawManager.rollRandomPrize();
            LuckyDrawManager.givePrizeToPlayer(p, prize);
            p.sendSystemMessage(net.minecraft.network.chat.Component.literal("§a🎉 [幸運抽獎] 恭喜獲得 " + prize.displayName + " §e(x" + prize.amount + ")§a！"));
            open(p);
        });

        setItem(19, ItemUtil.createGuiItem(Items.GOLD_INGOT, "§e🎰 5 連抽 (消耗 5 把鑰匙)", List.of(
                "§7一次進行 5 次抽獎並彙整發放獎勵",
                "§7目前擁有鑰匙: §e" + keys + " 把",
                "",
                "§e[點擊執行 5 連抽]"
        )), (p, click) -> {
            LuckyDrawManager.performBatchDraw(p, 5);
            open(p);
        });

        setItem(20, ItemUtil.createGuiItem(Items.DIAMOND, "§6🎰 10 連抽 (消耗 10 把鑰匙)", List.of(
                "§7一次進行 10 次抽獎並彙整發放獎勵",
                "§7目前擁有鑰匙: §e" + keys + " 把",
                "",
                "§e[點擊執行 10 連抽]"
        )), (p, click) -> {
            LuckyDrawManager.performBatchDraw(p, 10);
            open(p);
        });

        setItem(21, ItemUtil.createGuiItem(Items.NETHERITE_INGOT, "§d🎰 全部連抽 (消耗所有鑰匙)", List.of(
                "§7一次消耗您擁有的全部鑰匙並結算",
                "§7目前擁有鑰匙: §e" + keys + " 把",
                "",
                "§d[點擊執行全部連抽]"
        )), (p, click) -> {
            LuckyDrawManager.performBatchDraw(p, keys);
            open(p);
        });

        // Navigation
        setItem(25, ItemUtil.createGuiItem(Items.ARROW, "§a⬅ 關閉選單", List.of("§7點擊關閉")), (p, click) -> p.closeContainer());
        setItem(26, ItemUtil.createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")), (p, click) -> p.closeContainer());
    }
}
