package com.craftcore.checkin;

import com.craftcore.gui.BaseChestGui;
import com.craftcore.util.ItemUtil;
import com.craftcore.util.TextUtil;
import net.minecraft.core.component.DataComponents;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

public class CheckInGui extends BaseChestGui {

    public CheckInGui() {
        super(6, "§8❖ 📅 30 天奇幻每日簽到月曆 ❖");
    }

    @Override
    protected void build(ServerPlayer player) {
        fillBackground(ItemUtil.createGuiItem(ItemUtil.getItem("minecraft:gray_stained_glass_pane"), " ", null));

        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Taipei"));
        int currentDay = now.getDayOfMonth();
        int daysInMonth = now.toLocalDate().lengthOfMonth();

        String username = player.getName().getString();
        CheckInManager.CheckInRecord record = CheckInManager.getRecord(username);

        // Header Slot 4
        ItemStack header = ItemUtil.createGuiItem(Items.BOOK, "§6📅 30 天奇幻每日簽到月曆", List.of(
                "§7當月份天數: §f" + daysInMonth + " 天",
                "§7連續簽到天數: §a" + record.consecutiveStreak + " 天",
                "§7累計簽到天數: §b" + record.totalCheckIns + " 天",
                "§7每日簽到獎勵: §d$150 元 + 1 把抽獎鑰匙"
        ));
        setItem(4, header, null);

        // Grid Slots 9..38 (30 days)
        int slotStart = 9;
        for (int day = 1; day <= 30; day++) {
            int slot = slotStart + (day - 1);
            if (slot >= 45) break;

            final int dayNum = day;
            if (day <= daysInMonth) {
                if (day < currentDay) {
                    ItemStack item = ItemUtil.createGuiItem(ItemUtil.getItem("minecraft:lime_stained_glass_pane"), "§a✔ 第 " + day + " 天 (已完成簽到)", List.of(
                            "§7狀態: §a[已簽到]",
                            "§7獎勵: $150 元 + 1 把鑰匙"
                    ));
                    setItem(slot, item, null);
                } else if (day == currentDay) {
                    boolean already = CheckInManager.hasCheckedInToday(username);
                    if (already) {
                        ItemStack done = ItemUtil.createGuiItem(ItemUtil.getItem("minecraft:lime_stained_glass_pane"), "§a✔ 第 " + day + " 天 (今日已簽到)", List.of(
                                "§7狀態: §a[今日簽到已完成]",
                                "§7獎勵已領取！明天再來簽到吧～"
                        ));
                        setItem(slot, done, null);
                    } else {
                        ItemStack todayItem = ItemUtil.createGuiItem(Items.NETHER_STAR, "§e🌟 第 " + day + " 天 (今日可簽到！)", List.of(
                                "§7狀態: §e[點擊完成今日簽到]",
                                "§7立即領取: §d$150 元金幣 + 1 把抽獎鑰匙",
                                "",
                                "§a[點擊立即簽到]"
                        ));
                        todayItem.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
                        setItem(slot, todayItem, (p, click) -> {
                            CheckInManager.performCheckIn(p);
                            open(p);
                        });
                    }
                } else {
                    boolean isMilestone = (day == 7 || day == 14 || day == 21 || day == 30);
                    if (isMilestone) {
                        ItemStack ms = ItemUtil.createGuiItem(Items.CHEST, "§6🎁 第 " + day + " 天 (里程碑加碼禮包)", List.of(
                                "§7狀態: §7[未來日期]",
                                day == 7 ? "§e加碼獎勵: 抽獎鑰匙 +3 把" :
                                day == 14 ? "§e加碼獎勵: 抽獎鑰匙 +3 把" :
                                day == 21 ? "§e加碼獎勵: $1,000 元 + 鑰匙 +3 把" :
                                "§6全滿勤解鎖: [我愛簽到] 稱號 + $1,500 元 + 鑰匙 +5 把"
                        ));
                        setItem(slot, ms, null);
                    } else {
                        ItemStack future = ItemUtil.createGuiItem(ItemUtil.getItem("minecraft:gray_stained_glass_pane"), "§7第 " + day + " 天 (未解鎖)", List.of(
                                "§7狀態: §7[未來日期]"
                        ));
                        setItem(slot, future, null);
                    }
                }
            }
        }

        // Bottom Bar
        setItem(45, ItemUtil.createGuiItem(Items.ARROW, "§a⬅ 關閉選單", List.of("§7點擊關閉")), (p, click) -> p.closeContainer());

        boolean checkedInToday = CheckInManager.hasCheckedInToday(username);
        ItemStack claimBtn;
        if (checkedInToday) {
            claimBtn = ItemUtil.createGuiItem(ItemUtil.getItem("minecraft:green_concrete"), "§a✔ 今日已簽到", List.of("§7您今日已經完成簽到！"));
        } else {
            claimBtn = ItemUtil.createGuiItem(Items.EMERALD_BLOCK, "§a▶️ 一鍵完成今日簽到 (/checkin)", List.of(
                    "§7點擊直接完成簽到與領取獎勵",
                    "",
                    "§a[點擊簽到]"
            ));
        }

        setItem(49, claimBtn, (p, click) -> {
            CheckInManager.performCheckIn(p);
            open(p);
        });

        setItem(53, ItemUtil.createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")), (p, click) -> p.closeContainer());
    }
}
