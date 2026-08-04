# AGENTS.md — Craft-Core Ecosystem Architecture & Operation Guidelines

> **給所有 AI Agent 的重要提示**：本專案為 **Craft-Core Minecraft 伺服器生態系統**。在進行任何程式碼修改、伺服器操作或構建發布前，請務必完整閱讀本文件的架構指南與操作鐵則。

---

## 📌 1. 專案全貌與三大核心子組件架構 (Architecture Overview)

本專案由 3 個核心子項目組成，共同構成完整的 Minecraft 遊戲伺服器與 Discord 社群連動中樞（原 Web Dashboard 所有功能已 100% 原生遷移至 Minecraft Fabric 箱子 GUI 中）：

```
craft-core-shop/
├── fabric-mod/            # [1] Minecraft Fabric 遊戲模組 (服主核心伺服器模組)
├── paper-dc/              # [2] Minecraft Paper 插件 (次要 Paper 伺服器連動插件)
└── discord-bot/           # [3] Node.js Discord 機器人 & WebSocket/SQLite 通訊中樞
```

### [1] `fabric-mod/` — Fabric 伺服器模組 (主伺服器核心)
- **語言與環境**: Java 25 / Fabric Loader (Minecraft 1.21.4 / 26.2)。
- **建置命令**: `./gradlew build` ➔ 產出 `build/libs/craft-core-mod-2.5.1.jar`。
- **目標實例路徑**: `/opt/mcsmanager/daemon/data/InstanceData/e73c05307a6b4259bd052b88706757df/mods/`。
- **核心功能**:
  - **選單與介面**: 全服選單大廳 (`/menu`)、商店市場/遙控 (`/shop`)、福利中心抽獎/簽到 (`/checkin`, `/luckydraw`)、全服排行榜、虛擬快遞箱 (`/express`)、假人控制台、領地與密碼箱管理。
  - **經濟與商店**: 箱子商店 (`shops.json`)、遊戲幣轉帳 (`economy.json`)、離線快遞箱。
  - **領地與保護**: 領地劃分 (`claims.json`)、密碼鎖保險箱 (`lockboxes.json`)、極致爆炸防護。
  - **傳送與地標**: 公共地標 (`warps.json`)、個人家點 (`homes.json`)、隨機傳送 (`/rtp`)、定向寶藏雷達 (`/treasure`)、死亡回點 (`/back`)。
  - **通訊端點**: 內建 WebSocket Client (`CraftCoreWSClient.java`)，連接 `ws://localhost:8080` (Secret: `c34fc25b90a6ea1d38e2bc79679fbc9d`)，傳送遊戲聊天、玩家進退場、死亡訊息、簽到/鑰匙同步、成就突破與執行遠端指令。

### [2] `paper-dc/` — Paper 伺服器連動插件 (CraftCoreLink)
- **語言與環境**: Java 21 / Paper API 1.21.1。
- **建置命令**: `./gradlew shadowJar` ➔ 產出 `build/libs/CraftCoreLink-1.1.0.jar`。
- **目標實例路徑**: `/opt/mcsmanager/daemon/data/InstanceData/2010082ee9374bebbdf2be4bab7fe169/plugins/`。
- **核心功能**:
  - Discord 私訊 6 位數驗證碼綁定 (`bindings.json`)。
  - LuckPerms VIP 身分組雙向同步。
  - Paper 端聊天訊息透過 Discord Webhook 轉發。

### [3] `discord-bot/` — Discord 機器人與 WebSocket/SQLite 中樞
- **語言與環境**: Node.js / discord.js (PM2 進程: `craft-core-bot`)。
- **服務路徑**: `/root/craft-core/discord-bot` (Port 8080 WebSocket 伺服器)。
- **SQLite 資料庫**: `/root/craft-core/discord-bot/src/database/database.db`
  - 表格: `bindings` (帳號綁定/鑰匙數/連續簽到)、`temp_codes` (驗證碼)、`tickets` (客服單)、`offline_mails` (離線包裹)、`daily_stats` (每日統計)、`player_stats` (玩家統計)。
- **核心功能**:
  - 提供 WebSocket 服務供 `fabric-mod` 實時通訊與簽到/鑰匙數據同步。
  - 管理 Discord 交互面板（鑰匙面板、管理員面板、市場面板、狀態公告板）。
  - 使用 `WebhookClient` 發送帶有玩家 Minecraft 皮膚頭像的聊天訊息。

---

## 🖥️ 遠端伺服器實例與目錄地圖 (Server Directory Map)

| 服務 / 組件 | 主機實體路徑 (Remote Path) | 說明與注意細節 |
|---|---|---|
| 👑 **Fabric 伺服器 (主)** | `/opt/mcsmanager/daemon/data/InstanceData/e73c05307a6b4259bd052b88706757df/` | **服主主要營運伺服器**。模組放置於 `mods/craft-core-mod-2.5.1.jar`。資料檔位於 `config/craft-core-shop/`。 |
| 📄 **Paper 伺服器 (次)** | `/opt/mcsmanager/daemon/data/InstanceData/2010082ee9374bebbdf2be4bab7fe169/` | 次要 Paper 伺服器。插件放置於 `plugins/CraftCoreLink-1.1.0.jar`。 |
| 🤖 **Discord Bot 服務** | `/root/craft-core/discord-bot/` | PM2 管理進程 `craft-core-bot` (含 Port 8080 WS 伺服器與 SQLite `database.db`)。 |

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
