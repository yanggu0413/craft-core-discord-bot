# AGENTS.md — Craft-Core Ecosystem Architecture & Operation Guidelines

> **給所有 AI Agent 的重要提示**：本專案為 **Craft-Core Minecraft 伺服器生態系統**。在進行任何程式碼修改、伺服器操作或構建發布前，請務必完整閱讀本文件的架構指南與操作鐵則。

---

## 📌 1. 專案全貌與五大子組件架構 (Architecture Overview)

本專案由 5 個獨立子項目組成，共同構成完整的 Minecraft 遊戲伺服器、Discord 社群連動與 Web Dashboard 管理網頁：

```
craft-core-shop/
├── fabric-mod/            # [1] Minecraft Fabric 遊戲模組 (服主核心伺服器模組)
├── paper-dc/              # [2] Minecraft Paper 插件 (次要 Paper 伺服器連動插件)
├── discord-bot/           # [3] Node.js Discord 機器人 & WebSocket 通訊中樞
└── web-dashboard/         # Web 管理儀表板
    ├── backend/           # [4] Express TypeScript API 後端服務
    └── frontend/          # [5] React + Vite 靜態前端網頁
```

### [1] `fabric-mod/` — Fabric 伺服器模組 (主伺服器核心)
- **語言與環境**: Java 25 / Fabric Loader (Minecraft 1.21.4 / 26.2)。
- **建置命令**: `./gradlew build` ➔ 產出 `build/libs/craft-core-mod-2.4.1.jar`。
- **目標實例路徑**: `/opt/mcsmanager/daemon/data/InstanceData/e73c05307a6b4259bd052b88706757df/mods/`。
- **核心功能**:
  - **經濟與商店**: 箱子商店 (`shops.json`)、遊戲幣轉帳 (`economy.json`)。
  - **領地與保護**: 領地劃分 (`claims.json`)、密碼鎖保險箱 (`lockboxes.json`)。
  - **傳送與地標**: 公共地標 (`warps.json`)、個人家點 (`homes.json`)、隨機傳送 (`/rtp`)、死亡回點 (`/back`)。
  - **通訊端點**: 內建 WebSocket Client (`CraftCoreWSClient.java`)，連接 `ws://localhost:8080` (Secret: `c34fc25b90a6ea1d38e2bc79679fbc9d`)，傳送遊戲聊天、玩家進退場、死亡訊息、成就突破與執行遠端指令。

### [2] `paper-dc/` — Paper 伺服器連動插件 (CraftCoreLink)
- **語言與環境**: Java 21 / Paper API 1.21.1。
- **建置命令**: `./gradlew shadowJar` ➔ 產出 `build/libs/CraftCoreLink-1.1.0.jar`。
- **目標實例路徑**: `/opt/mcsmanager/daemon/data/InstanceData/2010082ee9374bebbdf2be4bab7fe169/plugins/`。
- **核心功能**:
  - Discord 私訊 6 位數驗證碼綁定 (`bindings.json`)。
  - LuckPerms VIP 身分組雙向同步。
  - Paper 端聊天訊息透過 Discord Webhook 轉發。

### [3] `discord-bot/` — Discord 機器人與 WebSocket 中樞
- **語言與環境**: Node.js / discord.js (PM2 進程: `craft-core-bot`)。
- **服務路徑**: `/root/craft-core/discord-bot` (Port 8080 WebSocket 伺服器)。
- **SQLite 資料庫**: `/root/craft-core/discord-bot/src/database/database.db`
  - 表格: `users` (Discord 使用者)、`bindings` (帳號綁定/鑰匙數/連續簽到)、`checkins` (簽到紀錄)、`daily_stats` (每日統計)、`player_stats` (玩家統計)。
- **核心功能**:
  - 提供 WebSocket 服務供 `fabric-mod` 與 `web-dashboard/backend` 實時通訊。
  - 管理 Discord 交互面板（鑰匙面板、管理員面板、市場面板、狀態公告板）。
  - 使用 `WebhookClient` 發送帶有玩家 Minecraft 皮膚頭像的聊天訊息。

### [4] `web-dashboard/backend/` — Web Dashboard API 後端
- **語言與環境**: Express.js / TypeScript (PM2 進程: `craft-core-backend`)。
- **服務路徑**: `/root/craft-core/web-dashboard/backend` (Port 3000)。
- **核心 API 路由**:
  - `GET /api/stats`: 伺服器實時統計（線上人數、TPS、總發行量、商店總數）。
  - `GET /api/leaderboard`: 全服財富富豪榜 (Top 10)。
  - `GET /api/user/leaderboard`: 全服簽到與鑰匙排行榜 (Top 10, 按 `keys_count DESC` 排序)。
  - `GET /api/shops` & `GET /api/shops/owner`: 玩家箱子商店清單與店主遠端遙控。
  - `GET /api/claims`: 全服領地分佈與邊界資料。
  - `GET /api/warps` & `GET /api/public/warps`: 公共地標傳送點。
  - `GET /api/user/profile`: 登入玩家個人資料（驗證碼、鑰匙數、簽到天數、`isAdmin` 狀態）。
  - `POST /api/user/checkin`: 每日簽到領鑰匙。
  - `POST /api/user/luckydraw`: 輪盤幸運大抽獎。
  - `POST /api/playtime/exchange`: 遊戲時數兌換鑰匙 (5hr 換 1 把)。

### [5] `web-dashboard/frontend/` — 儀表板前端
- **語言與技術**: React 18 + Vite + Tailwind/Vanilla CSS。
- **建置命令**: `npm run build` ➔ 產出 `dist/`。
- **靜態部署路徑**: `/var/www/craft-core/dashboard` 與 `/var/www/craft-core/` (Caddy Web Server 託管)。

---

## 🖥️ 遠端伺服器實例與目錄地圖 (Server Directory Map)

| 服務 / 組件 | 主機實體路徑 (Remote Path) | 說明與注意細節 |
|---|---|---|
| 👑 **Fabric 伺服器 (主)** | `/opt/mcsmanager/daemon/data/InstanceData/e73c05307a6b4259bd052b88706757df/` | **服主主要營運伺服器**。模組放置於 `mods/craft-core-mod-2.3.7.jar`。資料檔位於 `config/craft-core-shop/`。 |
| 📄 **Paper 伺服器 (次)** | `/opt/mcsmanager/daemon/data/InstanceData/2010082ee9374bebbdf2be4bab7fe169/` | 次要 Paper 伺服器。插件放置於 `plugins/CraftCoreLink-1.1.0.jar`。 |
| 🤖 **Discord Bot 服務** | `/root/craft-core/discord-bot/` | PM2 管理進程 `craft-core-bot`。本地檔 `config.json` 存放私密 Webhook。 |
| ⚙️ **Web API 後端** | `/root/craft-core/web-dashboard/backend/` | PM2 管理進程 `craft-core-backend`。Port 3000。 |
| 🌐 **Caddy 前端網頁** | `/var/www/craft-core/dashboard/` | 儀表板前端靜態 HTML/JS/CSS 產物。 |

---

## 🚨 AI Agent 操作鐵則 (Strict Guardrails)

### 1. 伺服器實例與架構核對規範 (Server Instance Verification)
- **認準服主主伺服器 (Fabric)**：服主主要營運之伺服器為 **Fabric (`e73c05307a6b4259bd052b88706757df`)**。
- **多實例絕不盲猜**：遇到伺服器上有多個目錄或多個實例時，**嚴禁自主假設或盲猜目標資料夾**。若有疑慮，必須先向服主詢問確認。
- **架構類型精準區分**：不可將 Paper 插件放入 Fabric 模組目錄 (`mods/`)，亦不可將 Fabric 模組放入 Paper 插件目錄 (`plugins/`)。

### 2. 關鍵操作前的人工二次確認 (Explicit Human Confirmation)
- **變更與刪除禁逕自執行**：凡涉及到以下操作，**必須先列出操作清單向服主進行人工二次確認**，獲得明確同意後始得執行：
  - 刪除或覆蓋伺服器上的 JAR 檔案（Plugin / Mod）
  - 修改伺服器核心設定檔（`config.yml`, `craftcore.json`, `config.json`）
  - 重啟或停止 Minecraft 伺服器實例
- **確認清單格式**：
  ```markdown
  - 🎯 目標伺服器路徑 (Target Directory)
  - ❌ 預計移除/覆蓋的檔案 (Files to Remove)
  - 📦 預計放置的新檔案 (Files to Add)
  ```

### 3. 敏感資訊與 Git 排除鐵則 (Sensitive Credentials & Git Isolation)
- **絕對禁止上傳敏感 Token/Webhook**：`.env`、`config.json`、Webhook URL、API Secret 等敏感憑證**嚴禁 commit 或 push 至 GitHub**。
- **配置目錄隔離**：所有正式環境敏感設定檔僅能保留於伺服器本地端，專案 `.gitignore` 必須 100% 包含此類設定檔。

### 4. 零 Mock 數據原則 (Zero-Mock Policy)
- 網頁與 API 所有數據必須真實查詢 SQLite `database.db` 或 MCSManager 實體 JSON 資料檔，**絕對禁止使用亂數或假公式生成虛假數據**。
