package com.craftcore.event;

import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import java.util.Random;

public class WelcomeTipManager {
    private static final Random RANDOM = new Random();

    private static final String[] TIPS = {
        "📜 不知道指令怎麼用？輸入 /menu 一鍵開啟全新 3x3 伺服器選單大廳！",
        "🎰 每日福利別錯過！輸入 /menu 打開「福利中心」，進行每日簽到、時數換鑰匙與 9x3 幸運轉盤大抽獎！",
        "📦 想把物資送給離線的好友嗎？輸入 /express 打開虛擬快遞箱，離線寄件/收件超方便！",
        "🤖 點擊你的假人或在 /menu 中開啟「假人控制台」，支援一鍵查看背包 (/invsee) 與切換打怪/挖礦動作！",
        "🛡️ 站在領地上輸入 /menu -> 「領地管理」，自動高亮目前領地，自由設定成員權限與爆炸安全旗幟！",
        "🗺️ 野外藏寶箱每 2 小時刷新！輸入 /treasure 查詢大致座標，並抬頭尋找天空中的金色粒子光柱！",
        "🛒 輸入 /shop 開啟商店大廳！除了擺攤，還能遠端遙控個人箱子商店與瀏覽全服商品！",
        "🏆 想知道誰是全服首富與簽到王者嗎？在 /menu 中開啟「全服排行榜」查看 Top 10 名單！",
        "🗑️ 背包滿了不用的雜物？輸入 /wastebin 或 /trash 打開隨身垃圾桶，關閉 10 秒後自動銷毀！",
        "🏭 建造了自動化農場或機器？輸入 /machine apply 提交審核，通過認證即可獲得 T2/T3 免領地費優惠！",
        "🔒 害怕箱子被其他玩家搜刮？拿著鎖匙輸入 /padlock 即可為箱子設定密碼鎖！",
        "📋 沒事做嗎？輸入 /tasks 看看今天的每日擊殺與採礦任務，達標自動發放獎勵！",
        "🏠 找不到回家的路嗎？使用 /sethome <名稱> 建立家園，隨時輸入 /home 返回！",
        "🚩 想探索熱門地標或公共設施嗎？輸入 /warp 看看伺服器有哪些地標傳送點！",
        "💀 剛才不幸意外死亡或傳送錯地方了？輸入 /back 即可瞬間返回上次地點或死亡點！",
        "💸 想給好朋友金幣嗎？輸入 /pay <玩家> <金額> 進行安全轉帳！"
    };

    public static void sendRandomTip(ServerPlayer player) {
        if (player == null) return;
        int idx = RANDOM.nextInt(TIPS.length);
        String tip = TIPS[idx];
        player.sendSystemMessage(Component.literal("§e💡 [伺服器小提示] §f" + tip));
    }
}
