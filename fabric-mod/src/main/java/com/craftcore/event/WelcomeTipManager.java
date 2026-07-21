package com.craftcore.event;

import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import java.util.Random;

public class WelcomeTipManager {
    private static final Random RANDOM = new Random();

    private static final String[] TIPS = {
        "🔒 害怕箱子與領地被偷嗎？快來試試 /padlock 鎖箱功能吧！",
        "📋 玩膩了？輸入 /tasks 看看今日的每日擊殺與採礦任務吧！",
        "🏪 想當首富嗎？拿著箱子與告示牌輸入 /shop 建立自己的商店吧！",
        "🤖 需要幫忙自動掛機嗎？輸入 /fp <名稱> 召喚專屬假人替你工作！",
        "🤝 想邀請朋友一起遊玩嗎？輸入 /discord 獲取官方 Discord 邀請連結！",
        "🏠 找不到回家的路嗎？使用 /sethome <名稱> 建立家園，隨時輸入 /home 返回！",
        "🚩 想探索熱門地標或公共設施嗎？輸入 /warp 看看伺服器有哪些地標傳送點！",
        "💀 剛才不幸意外死亡或傳送錯地方了？輸入 /back 即可瞬間返回上次地點或死亡點！",
        "🎁 每天登入別忘了輸入 /checkin 進行簽到，領取連續簽到獎勵與抽獎券！",
        "💸 想給好朋友金幣嗎？輸入 /pay <玩家> <金額> 進行安全轉帳！"
    };

    public static void sendRandomTip(ServerPlayer player) {
        if (player == null) return;
        int idx = RANDOM.nextInt(TIPS.length);
        String tip = TIPS[idx];
        player.sendSystemMessage(Component.literal("§e💡 [伺服器小提示] §f" + tip));
    }
}
