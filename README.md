# ⚔️ Craft-Core 生態系統 (Minecraft Server Ecosystem)

<p alias="center">
  <img src="https://img.shields.io/badge/Minecraft-1.21.4%20%2F%2026.2-brightgreen.svg" alt="Minecraft Version">
  <img src="https://img.shields.io/badge/Platform-Fabric%20Loader-orange.svg" alt="Platform">
  <img src="https://img.shields.io/badge/Java-25-blue.svg" alt="Java Version">
  <img src="https://img.shields.io/badge/Backend-Node.js%20%2F%20SQLite-darkgreen.svg" alt="Backend">
  <img src="https://img.shields.io/badge/License-MIT-purple.svg" alt="License">
</p>

`Craft-Core` 是一套專為 **Minecraft 原味生存伺服器** 設計的純服務端（Pure Server-Side）核心生態系統。

玩家不需要在客户端安裝任何 Mod 或資源包，即可享受包含 **4x4 大廳箱子選單 GUI (`/menu`)**、**全服箱子商店與遙控市場 (`/shop`)**、**🎰 9x3 幸運轉盤抽獎**、**🏆 即時排行榜**、**📦 跨服離線虛擬快遞箱 (`/express`)**、**🛡️ 極致防爆防破壞領地與密碼箱 (`/padlock`)**、**🗺️ 定向羅盤尋寶雷達 (`/treasure`)**、**🤝 聊天欄一鍵確認轉帳與傳送 (`/pay`, `/tpa`)**、**⚔️ PvP 雙向防護切換 (`/pvp`)**、**🤖 假人全功能控制台 (`/bot`)** 與 **💬 Discord 6 位數綁定與雙向皮膚頭像聊天中樞**。

---

## 📌 三大核心架構子項目 (Architecture Overview)

```
craft-core-shop/
├── fabric-mod/            # [1] Minecraft Fabric 伺服器模組 (主伺服器核心中樞)
├── paper-dc/              # [2] Minecraft Paper 插件 (次要 Paper 伺服器連動插件)
└── discord-bot/           # [3] Node.js Discord 機器人 & WebSocket/SQLite 中樞
```

### 1. 👑 `fabric-mod/` — Fabric 伺服器核心模組
- **環境版本**: Java 25 / Fabric Loader (Minecraft 1.21.4 / 26.2)。
- **核心定位**: 服主主要營運之主伺服器核心模組，原生包辦所有遊戲內箱子 GUI 與生存經濟防護。
- **目標實例**: `/opt/mcsmanager/daemon/data/InstanceData/e73c05307a6b4259bd052b88706757df/mods/`

### 2. 📄 `paper-dc/` — Paper 伺服器連動插件 (`CraftCoreLink`)
- **環境版本**: Java 21 / Paper API 1.21.1。
- **核心定位**: 次要 Paper 伺服器插件，處理跨服帳號綁定、LuckPerms VIP 權限雙向同步與 Discord 訊息轉發。

### 3. 🤖 `discord-bot/` — Discord 機器人與 WebSocket/SQLite 中樞
- **環境版本**: Node.js / discord.js / PM2 (`craft-core-bot`)。
- **核心定位**: Port 8080 WebSocket 伺服器 + SQLite `database.db` 資料庫。負責即時同步簽到鑰匙、離線包裹、客服單、統計資料與 Discord 皮膚頭像 Webhook 聊天。

---

## ✨ 核心系統特色功能 (System Features)

### 📜 1. 4x4 完美分類主選單大廳 (`/menu`)
- **對稱清爽美學**：採用 4x4 完美分類整齊網格（每列 4 個精確對齊，間隔灰色玻璃），絕不擠在一起。
- **一鍵直達功能**：
  - 🏪 商店管理系統 | 🧭 傳送與家園 | 🛡 領地與密碼箱 | 📦 虛擬快遞箱
  - 🤝 玩家傳送請求 | 💸 玩家安全轉帳 | ⚔️ PvP 戰鬥切換 | 💬 Discord 社群
  - 🎰 福利中心 | ⚔ 任務與懸賞 | 🏆 全服排行榜 | 🏭 機器認證與免領地費
  - 🤖 假人控制台 | 🛠️ 管理員 OP 控制台 | 🗑️ 隨身垃圾桶

### 🏪 2. 箱子商店市場與店主遙控 (`/shop`)
- **全服市場搜尋**：玩家可於 GUI 中瀏覽全服所有公開箱子商店，點擊即可傳送至商店現場。
- **店主遙控台**：店主可在 GUI 中查看個人名下商店清單、累積營業額並一鍵提領營收益。
- **告示牌與懸浮物**：商店建立時自動貼上發光高亮告示牌與 `0.5x` 物品懸浮實體（Item Display）。

### 🎰 3. 福利中心與 9x3 幸運轉盤抽獎 (`/checkin`, `/luckydraw`)
- **每日簽到**：每日點擊領取獎勵，自動累計連續簽到天數。
- **遊戲時數兌換**：每在線累積 5 小時可自動兌換 1 把幸運抽獎鑰匙。
- **9x3 滾動轉盤動畫**：消耗鑰匙開啟 9x3 動態滾動動畫，隨機獲得金幣、珍稀道具與炫彩頭頂稱號。

### 🏆 4. 全服即時排行榜 (Leaderboards)
- **多維度榜單**：提供 **💰 財富 Top 10**、**🔑 鑰匙 Top 10** 與 **📅 連續簽到 Top 10**。
- **玩家皮膚頭像**：使用點擊玩家的皮膚頭像渲染榜單，顯示精確排名與 Lore 數值。

### 📦 5. 跨服虛擬快遞箱系統 (`/express`)
- **離線寄件**：玩家可將背包物資放入 9x6 虛擬箱子，指定線上或離線玩家完成物品寄送。
- **離線收件箱**：收件人隨時開箱領取包裹，紀錄永久同步至 SQLite 資料庫。

### 🛡️ 6. 極致防爆防破壞領地與密碼鎖 (`/claim`, `/padlock`)
- **100% 爆炸免疫**：徹底阻擋外部 TNT、苦力怕 (Creeper)、凋零 (Wither)、風珠 (Wind Charge) 等所有來源之爆炸傷及領地內方塊。
- **完整物理防護**：阻擋終界使者搬移方塊、活塞推拉、外側流體侵入，以及非 Trust 玩家對展示框、盔甲架與容器的存取。
- **密碼鎖保險箱 (`/padlock`)**：箱子選單中可一鍵設定密碼鎖，提供安全自訂密碼解鎖與信任成員授權。

### 🗺️ 7. 定向羅盤尋寶雷達 (`/treasure`)
- **精確網格 (100x100)**：寶藏刷新於 Overworld 100x100 區域，天空升起密集金色粒子光柱。
- **定向雷達感應**：執行 `/treasure` 可即時獲取方位角與距離（如 `寶箱在您的 ↗ 東北 方向，距離約 120 公尺`），靠近 35 公尺內觸發強烈熱感應。

### 🤝 8. 安全金流與傳送機制 (`/pay`, `/tpa`)
- **/pay 轉帳確認**：點擊頭顱選擇玩家後，於聊天框輸入金額，系統彈出 `[✔ 點擊確認轉帳]` 按鈕，防止誤轉。
- **/tpa 點擊響應**：受請求玩家可在聊天欄直接點擊 `[✔ 點擊接受]` 或 `[❌ 點擊拒絕]`。

### ⚔️ 9. PvP 雙向防護狀態切換 (`/pvp`)
- **和平保護模式**：預設關閉 PvP，受系統保護免受其他玩家傷害，亦無法攻擊他人。
- **戰鬥模式**：雙方皆開啟 `/pvp` 時始可互相戰鬥。

### 🤖 10. 假人助手全功能控制台 (`/bot`)
- **一鍵管理**：召喚、解散假人、一鍵傳送至身邊。
- **動作與背包**：切換掛機打怪/連續點擊/挖掘動作，並支援 `/invsee` 查看與管理假人背包與末影箱。

### 💬 11. Discord 帳號綁定與雙向皮膚頭像聊天
- **6 位數驗證碼**：玩家於 `/menu -> Discord` 執行 `/discord link` 生成驗證碼，Discord 私訊機器人完成雙向綁定。
- **玩家頭像 Webhook 聊天**：Minecraft 玩家聊天訊息會透過 Webhook 發送帶有該玩家 Minecraft 皮膚頭像的訊息至 Discord。

---

## 🛠️ 開發與建置說明 (Build & Development)

### 1. 編譯 Fabric 模組 (`fabric-mod`)
```bash
cd fabric-mod
./gradlew assemble
```
產出檔案位於：`fabric-mod/build/libs/craft-core-mod-2.5.0.jar`

### 2. 編譯 Paper 插件 (`paper-dc`)
```bash
cd paper-dc
./gradlew shadowJar
```
產出檔案位於：`paper-dc/build/libs/CraftCoreLink-1.1.0.jar`

---

## 🚀 服務啟動與營運 (Production Operations)

專案內建 PM2 一鍵管理腳本，自動維護 Discord Bot 與 WebSocket / SQLite 服務：

### Linux 正式環境
```bash
# 啟動 PM2 服務 (craft-core-bot)
./start_all.sh

# 查看運作狀態與日誌
pm2 status
pm2 logs craft-core-bot
```

### Windows 開發/測試環境
```cmd
start_all.bat
```

---

## 📜 授權協議 (License)

本專案採用 **[MIT License](LICENSE)** 開源授權。
