# Craft-Core 生態系統 (Minecraft Server Ecosystem)

<p align="center">
  <img src="https://img.shields.io/badge/Minecraft-Fabric%2026.2%20%7C%20Paper%201.21.11-brightgreen.svg" alt="Minecraft Version">
  <img src="https://img.shields.io/badge/Platform-Fabric%20Loader-orange.svg" alt="Platform">
  <img src="https://img.shields.io/badge/Java-25-blue.svg" alt="Java Version">
  <img src="https://img.shields.io/badge/Backend-Node.js%20%2F%20SQLite-darkgreen.svg" alt="Backend">
  <img src="https://img.shields.io/badge/License-MIT-purple.svg" alt="License">
</p>

`Craft-Core` 是一套專為 **Minecraft 原味生存伺服器** 設計的純服務端（Pure Server-Side）核心生態系統。

玩家不需要在客戶端安裝任何 Mod 或資源包，即可在遊戲內體驗包含 4x4 選單大廳 (`/menu`)、全服箱子商店與遙控市場 (`/shop`)、幸運轉盤抽獎 (`/luckydraw`)、即時排行榜、離線虛擬快遞箱 (`/express`)、領地極致防爆與密碼箱 (`/padlock`)、定向羅盤尋寶雷達 (`/treasure`)、一鍵確認轉帳與傳送 (`/pay`, `/tpa`)、PvP 雙向防護切換 (`/pvp`)、假人控制台 (`/bot`) 與 Discord 6 位數帳號綁定。

---

## 1. 專案架構 (Architecture Overview)

```
craft-core-shop/
├── fabric-mod/            # [1] Minecraft Fabric 伺服器模組 (主伺服器核心中樞)
├── paper-dc/              # [2] Minecraft Paper 插件 (次要 Paper 伺服器連動插件)
└── discord-bot/           # [3] Node.js Discord 機器人 & WebSocket/SQLite 中樞
```

### fabric-mod (Fabric 伺服器核心模組)
- **環境與語言**: Java 25 / Fabric Loader (Minecraft 26.2)。
- **核心定位**: 主伺服器核心模組，原生包辦所有遊戲內箱子 GUI 選單、經濟系統與領地防護。

### paper-dc (Paper 伺服器連動插件 `CraftCoreLink`)
- **環境與語言**: Java 21 / Paper API 1.21.11。
- **核心定位**: 次要 Paper 伺服器插件，處理跨服帳號綁定、LuckPerms VIP 權限雙向同步與 Discord 訊息轉發。

### discord-bot (Discord 機器人與 WebSocket/SQLite 中樞)
- **環境與語言**: Node.js / discord.js / PM2 (`craft-core-bot`)。
- **核心定位**: Port 8080 WebSocket 伺服器與 SQLite `database.db` 資料庫，負責即時同步簽到鑰匙、離線包裹、客服單、統計資料與 Discord 皮膚頭像 Webhook 聊天。

---

## 2. 核心系統特色 (Key Features)

### 4x4 主選單大廳 (`/menu`)
- **清爽矩陣網格**：採用 4x4 對稱整齊網格（間隔灰色玻璃），絕不擁擠。
- **一鍵直達入口**：
  - 商店管理系統 | 傳送與家園 | 領地與密碼箱 | 虛擬快遞箱
  - 玩家傳送請求 | 玩家安全轉帳 | PvP 戰鬥切換 | Discord 社群
  - 福利中心 | 任務與懸賞 | 全服排行榜 | 機器認證與免領地費
  - 假人控制台 | 管理員 OP 控制台 | 隨身垃圾桶

### 箱子商店與市場遙控 (`/shop`)
- **全服市場搜尋**：玩家可於 GUI 搜尋全服公開箱子商店，點擊即可傳送至商店現場。
- **店主遙控台**：店主可瀏覽個人商店清單、查看累積營業額並一鍵提領收益。
- **發光告示牌與懸浮物**：自動建立發光高亮告示牌與 `0.5x` 物品懸浮實體（Item Display）。

### 福利中心與轉盤抽獎 (`/checkin`, `/luckydraw`)
- **每日簽到**：每日點擊領取簽到獎勵，自動累計連續簽到天數。
- **時數兌換**：在線每累積 5 小時自動兌換 1 把幸運抽獎鑰匙。
- **9x3 轉盤動畫**：消耗鑰匙開啟 9x3 滾動動畫，隨機獲得金幣、道具與炫彩頭頂稱號。

### 全服即時排行榜
- **多維度榜單**：提供財富 Top 10、鑰匙 Top 10 與連續簽到 Top 10。
- **玩家皮膚頭像**：使用玩家皮膚頭像渲染榜單，顯示精確排名與 Lore 數據。

### 虛擬快遞箱系統 (`/express`)
- **離線寄件**：將物資放入 9x6 虛擬箱子，可指定線上或離線玩家完成包裹寄送。
- **離線收件箱**：收件人隨時開箱領取包裹，資料永久同步至 SQLite 資料庫。

### 防爆領地與密碼鎖保險箱 (`/claim`, `/padlock`)
- **爆炸免疫**：100% 阻擋 TNT、苦力怕、凋零、風珠等所有爆炸傷及領地內方塊。
- **完整物理防護**：阻擋終界使者搬移方塊、活塞推拉、外側流體侵入，以及非 Trust 玩家對展示框、盔甲架與容器的存取。
- **密碼鎖保險箱 (`/padlock`)**：可在箱子選單設定密碼鎖，提供安全密碼解鎖與信任成員管理。

### 定向羅盤尋寶雷達 (`/treasure`)
- **100x100 精確網格**：寶藏刷新於 Overworld 100x100 區域，天空升起金色粒子光柱。
- **定向雷達感應**：執行 `/treasure` 即時獲取方位角與距離，靠近 35 公尺內觸發強烈熱感應。

### 安全金流與傳送機制 (`/pay`, `/tpa`)
- **轉帳點擊確認 (`/pay`)**：選取玩家並輸入金額後，聊天欄彈出 `[✔ 點擊確認轉帳]` 按鈕才扣款。
- **傳送一鍵響應 (`/tpa`)**：受請求玩家可在聊天欄直接點擊 `[✔ 點擊接受]` 或 `[❌ 點擊拒絕]`。

### PvP 防護切換 (`/pvp`)
- **和平保護**：預設關閉 PvP，受系統保護免受其他玩家傷害，亦無法攻擊他人。
- **戰鬥模式**：雙方皆開啟 `/pvp` 時始可互相攻擊。

### 假人控制台 (`/bot`)
- **一鍵管理**：召喚、解散假人與傳送至身邊。
- **動作與背包**：切換掛機打怪、連續點擊、挖掘動作，並支援 `/invsee` 查看假人背包與末影箱。

### Discord 帳號綁定與頭像聊天
- **6 位數驗證碼**：於 `/menu -> Discord` 執行 `/discord link` 生成驗證碼，Discord 私訊機器人完成綁定。
- **頭像 Webhook 聊天**：Minecraft 聊天訊息透過 Webhook 發送帶有該玩家皮膚頭像的訊息至 Discord。

---

## 3. 開發與建置 (Build & Development)

### 編譯 Fabric 模組 (`fabric-mod`)
```bash
cd fabric-mod
./gradlew assemble
```
產出檔案：`fabric-mod/build/libs/craft-core-mod-2.5.0.jar`

### 編譯 Paper 插件 (`paper-dc`)
```bash
cd paper-dc
./gradlew shadowJar
```
產出檔案：`paper-dc/build/libs/CraftCoreLink-1.1.0.jar`

---

## 4. 服務啟動 (Production Operations)

### Linux 正式環境
```bash
# 啟動 PM2 服務 (craft-core-bot)
./start_all.sh

# 查看運作狀態與日誌
pm2 status
pm2 logs craft-core-bot
```

### Windows 開發環境
```cmd
start_all.bat
```

---

## 5. 授權協議 (License)

本專案採用 **[MIT License](LICENSE)** 開源授權。
