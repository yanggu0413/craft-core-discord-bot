# Minecraft 伺服器迎賓小提示系統 (Welcome Tips System)

## 📌 功能概述
當玩家登入伺服器時，系統會在玩家連線完成 1 秒後，從小提示池中隨機抽樣 1 條發送至玩家的聊天欄中，幫助玩家快速了解與熟悉伺服器的特色指令與系統功能。

---

## 💡 提示池對照表 (Tips Pool)

1. **領地與箱子鎖**: `🔒 害怕箱子與領地被偷嗎？快來試試 /padlock 鎖箱功能吧！`
2. **每日任務系統**: `📋 玩膩了？輸入 /tasks 看看今日的每日擊殺與採礦任務吧！`
3. **箱子商店交易**: `🏪 想當首富嗎？拿著箱子與告示牌輸入 /shop 建立自己的商店吧！`
4. **Carpet 假人掛機**: `🤖 需要幫忙自動掛機嗎？輸入 /fp <名稱> 召喚專屬假人替你工作！`
5. **Discord 官方社群**: `🤝 想邀請朋友一起遊玩嗎？輸入 /discord 獲取官方 Discord 邀請連結！`
6. **個人家園點設定**: `🏠 找不到回家的路嗎？使用 /sethome <名稱> 建立家園，隨時輸入 /home 返回！`
7. **公共地標地圖**: `🚩 想探索熱門地標或公共設施嗎？輸入 /warp 看看伺服器有哪些地標傳送點！`
8. **返回點與死亡點**: `💀 剛才不幸意外死亡或傳送錯地方了？輸入 /back 即可瞬間返回上次地點或死亡點！`
9. **每日簽到抽獎**: `🎁 每天登入別忘了輸入 /checkin 進行簽到，領取連續簽到獎勵與抽獎券！`
10. **安全金幣轉帳**: `💸 想給好朋友金幣嗎？輸入 /pay <玩家> <金額> 進行安全轉帳！`

---

## 🛠️ 技術實作細節
- **元件位置**: [WelcomeTipManager.java](file:///c:/Users/Yanggu/Documents/craft-core-shop/fabric-mod/src/main/java/com/craftcore/event/WelcomeTipManager.java)
- **觸發時機**: 註冊於 `ServerPlayConnectionEvents.JOIN`，延遲 1000ms 於 Server 主線程安全調用發送 Component。
