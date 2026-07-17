# 🎮 Craft-Core Discord Bot

一款專為 Minecraft 伺服器打造的企業級 Discord 機器人，具備完整的雙向訊息同步、帳號綁定、客服單系統、每日簽到抽獎以及管理員指令功能。採用 Clean Architecture 設計原則，確保高可靠性與長期維護性。

---

## ✨ 功能一覽

### 核心功能
| 功能類別 | 功能描述 |
|---|---|
| 💬 雙向聊天同步 | 遊戲內與 Discord 頻道即時雙向訊息同步（含玩家頭像 Webhook）|
| 📊 伺服器狀態 | Discord 常駐狀態面板，顯示線上玩家、TPS、Ping 值 |
| 🎫 客服單系統 | 點擊按鈕開啟私人頻道客服單，關閉時自動產出 Transcript |
| 📅 每日簽到 | `/checkin` 每日領取簽到獎勵 |
| 🎰 幸運抽獎 | `/抽獎` 使用鑰匙開獎，即時發送原生物資至玩家背包 |
| ☠️ 死亡排行榜 | `/死亡榜` 顯示伺服器玩家的死亡次數統計與排名 |

### 🚀 Phase 2 全新升級功能
| 功能類別 | 功能描述 |
|---|---|
| 🔑 雙面板分離 (Dual Panel) | 將**鑰匙領取面板**與**互動功能面板**獨立拆分，介面更乾淨，減少誤觸。玩家可透過鑰匙領取面板獲取每日簽到與聯名鑰匙，再到互動功能面板進行抽獎與查詢。 |
| 🛡️ 管理員控制面板 (Admin Control Panel) | 全新後台控制面板，管理員可直接進行「強制綁定」、「解除綁定」以及「玩家資訊查詢」，免除在 Discord 中輸入複雜指令的繁瑣步驟。 |
| 📦 郵件快遞與離線信箱 (Express & Offline Mailbox) | 支援離線發送物品！若玩家在線，系統將即時投遞至背包；若玩家離線，物品將暫存於離線信箱中，待玩家下次登入時自動快遞發送，保障獎勵不丟失。 |
| 📢 公告草稿預覽與發佈 (Announcement Draft) | 支援公告發佈工作流：管理員在後台編輯公告後，可先產生「草稿預覽」，確認排版與文字無誤後，再一鍵「正式發佈」至全服，提升公告品質。 |
| 📈 伺服器統計看板 (Consolidated Statistics Board) | 整合式伺服器統計看板，定時更新並釘選於指定頻道，一眼看清線上人數、今日聊天訊息量、系統負載等關鍵數據。 |
| ✉️ DM 私訊驗證碼綁定 (DM Binding Verification) | 為了提高隱私安全，廢除公開頻道的 `/綁定` 指令，玩家只需私訊 (DM) 機器人輸入遊戲中獲得的 6 位數驗證碼，即可安全、安靜地完成帳號綁定。 |

### 🌐 Phase 3 網頁控制面板 (Web Dashboard)
| 功能類別 | 功能描述 |
|---|---|
| 🌐 數據總覽 (Dashboard Home) | 展示玩家 3D Skin 頭像、遊戲內餘額、伺服器流通金幣、累積徵收稅款與箱子商店數，並附帶全服富豪榜。 |
| 🏪 商店導航 (Shop Explorer) | 提供實時箱子商店清單，支援模糊搜尋商品/擁有者、價格與庫存排序，並提供一鍵複製 `/tp` 座標。 |
| 📈 市場行情 (Market Analytics) | 統計主要礦物（鑽石、獄髓、鐵錠等）的平均交易價格，並以 7 天折線圖展示市場價格趨勢與交易量。 |
| 🔑 店主管理 (Owner Control) | 玩家登入後，可遠端提領商店營收金幣、扣除 $5000 遙控修改告示牌標題、升級插槽限制等。 |
| 🔒 Discord 驗證 | 透過 Discord OAuth2 與 JWT 提供安全且流暢的單點登入 (SSO) 機制，並配置開發者 Mock 測試登入旁路。 |

---

## 🏗️ 架構概覽 (Clean Architecture)

```
discord-bot/
├── src/
│   ├── index.js                    # 極簡入口，全域錯誤防衛
│   ├── config.js                   # 集中式設定管理
│   ├── bot/
│   │   ├── commands/               # 斜線指令模組 (生產環境)
│   │   ├── commands_legacy/        # 舊版/備份斜線指令 (僅在測試環境載入)
│   │   ├── handlers/               # 互動事件分流
│   │   │   ├── commandHandler.js   # 斜線指令路由
│   │   │   ├── buttonHandler.js    # 按鈕事件路由
│   │   │   └── modalHandler.js     # Modal 提交路由
│   │   └── middleware/             # 指令中間件管線
│   │       ├── pipeline.js         # 中間件組合器
│   │       ├── permissionCheck.js  # 角色白名單權限
│   │       ├── auditLogger.js      # 行為審計日誌
│   │       ├── errorHandler.js     # 集中式錯誤捕捉
│   │       └── cooldown.js         # 指令冷卻限速
│   ├── database/
│   │   ├── index.js                # 非同步 DB 操作層
│   │   └── repositories.js         # Repository 模式 SQL 分層
│   ├── services/
│   │   ├── webhookService.js       # Webhook/Discord 訊息發送服務
│   │   ├── ticketService.js        # 客服單業務邏輯
│   │   └── statusService.js        # 伺服器狀態更新服務
│   ├── utils/
│   │   ├── logger.js               # Winston 結構化日誌
│   │   ├── AppError.js             # 自訂錯誤類別分層
│   │   └── discordQueue.js         # Discord API 緩衝佇列 (p-queue)
│   └── websocket/
│       ├── server.js               # WebSocket 伺服器 + 心跳 + Rate Limit
│       ├── session.js              # 多子服 Map 連線池
│       └── handler.js              # 封包路由器 + Zod 驗證
├── tests/                          # 完整 Jest 測試套件
│   ├── database.test.js
│   ├── challenger.test.js
│   ├── stress_boundary.test.js
│   └── e2e/
│       ├── tier1_feature_coverage.test.js
│       ├── tier2_boundary_cases.test.js
│       ├── tier3_cross_feature.test.js
│       ├── tier4_real_world.test.js
│       └── tier5_phase2_features.test.js
└── logs/                           # Winston 結構化日誌輸出目錄
    ├── combined.log
    ├── error.log
    ├── exceptions.log
    └── rejections.log
```

---

## 🛡️ 企業級架構特性

### 1. 🔌 WebSocket 可靠性與多子服連線池
- **心跳機制 (Ping/Pong)**：每 30 秒偵測並自動清除殭屍連線，防止記憶體洩漏。
- **多子服連線池**：使用 `Map` 動態管理多台 Minecraft 子伺服器的連線（大廳與副本分流），每台子服以 `serverId` 作為唯一識別 Key。
- **IP 頻率限制**：連線層防禦，每 IP 每分鐘限制 5 次連線嘗試，防止惡意 DoS 攻擊。
- **Zod 封包驗證**：所有傳入的 WebSocket 封包均通過 Zod Schema 嚴格驗證，拒絕格式異常的封包。

### 2. ⚙️ 中間件導向指令系統
每個斜線指令均流經標準化管線：
```
[指令執行請求]
    ↓
permissionCheck   → 驗證使用者是否具備管理員角色
    ↓
cooldown          → 指令冷卻時間防刷
    ↓
auditLogger       → 記錄執行者、時間、指令內容至日誌
    ↓
errorHandler      → 集中式錯誤捕捉，回傳友善提示
    ↓
[指令邏輯執行]
```

### 3. 📨 Discord API 緩衝佇列 (p-queue)
所有對 Discord API / Webhook 的發送請求（包括聊天訊息、玩家登入登出廣播、死亡通知、成就廣播、客服單訊息、伺服器狀態等）均通過 `discordQueue` 佇列發出，確保：
- 嚴格遵守 Discord API Rate Limit，防止機器人被限流鎖定。
- 突發高頻事件（如多名玩家同時登入）自動排隊，訊息按順序穩定發出。
- 失敗請求支援自動重試機制。

### 4. 📝 結構化日誌系統 (Winston)
- 日誌分級輸出至 `logs/combined.log` 和 `logs/error.log`。
- Process 級別的 `uncaughtException` 與 `unhandledRejection` 分別記錄至 `logs/exceptions.log` 和 `logs/rejections.log`，**確保 any 局部錯誤絕不導致 Bot 進程崩潰**。

### 5. 🗄️ 非同步資料庫與 Repository 模式
- 所有 SQLite 操作均以 `Promise/Async-Await` 封裝，確保非阻塞。
- Repository 模式（`UserRepository`, `TicketRepository`, `PlayerStatsRepository` 等）將 SQL 邏輯與業務邏輯徹底解耦，為未來遷移至 MySQL/PostgreSQL 做好準備。

---

## 🚀 快速開始

### 1. 環境需求
- **Node.js**: v20 或以上
- **Minecraft**: 1.21.1（安裝 Fabric Mod）

### 2. 安裝依賴
```bash
cd discord-bot
npm install
```

### 3. 設定 config.json
複製並填寫設定檔：
```json
{
  "discord": {
    "token": "YOUR_BOT_TOKEN",
    "clientId": "YOUR_CLIENT_ID",
    "guildId": "YOUR_GUILD_ID",
    "adminRoleIds": ["ADMIN_ROLE_ID"],
    "chatWebhookUrl": "YOUR_WEBHOOK_URL",
    "channels": {
      "chatSync": "CHANNEL_ID",
      "ticketLogs": "CHANNEL_ID",
      "status": "CHANNEL_ID"
    }
  },
  "websocket": {
    "port": 8080,
    "secret": "YOUR_SECRET_KEY"
  },
  "minecraft": {
    "avatarProvider": "https://crafatar.com/avatars/{uuid}?size=64&overlay"
  }
}
```

### 4. 向 Discord 註冊斜線指令
```bash
npm run deploy
```

### 5. 啟動機器人
```bash
npm start
# 或使用 PM2 持久部署
pm2 start src/index.js --name craft-core-bot
```

### 6. 安裝 Fabric 模組
將專案根目錄的 `craftcore-1.0.0.jar` 或編譯生成的 `fabric-mod/build/libs/craftcore-*.jar` 放入 Minecraft 伺服器的 `mods/` 目錄並重啟伺服器即可。

---

## 📦 開源與編譯發佈指南 (Open Source & Release Guide)

本專案支援完全開源編譯與部署。主要包含 Fabric 模組的編譯以及 Discord 機器人原始碼的打包發佈。

### 1. Fabric 模組編譯 (Fabric Mod Compilation)
Fabric 模組位於 `fabric-mod/` 目錄中。若要自行編譯產生 `.jar` 模組檔案，請遵循以下步驟：
- 確保系統已安裝 Java JDK 17 或以上。
- 進入 `fabric-mod/` 目錄：
  ```bash
  cd fabric-mod
  ```
- 執行 Gradle 編譯任務：
  - Windows:
    ```cmd
    .\gradlew build
    ```
  - Linux / macOS:
    ```bash
    ./gradlew build
    ```
- 編譯完成後，生成的 `.jar` 檔案將位於 `fabric-mod/build/libs/` 目錄下（例如 `craftcore-1.0.0.jar`）。
- 您可以將該 `.jar` 檔案複製到專案根目錄或直接部署至 Minecraft 伺服器的 `mods/` 目錄中。

### 2. Discord 機器人打包 (Discord Bot Packaging)
Discord 機器人位於 `discord-bot/` 目錄中。在進行開源釋出或部署時，需排除依賴庫（`node_modules`）與執行日誌（`logs`），將原始碼壓縮為 `discord-bot.zip`：
- 在 Windows 環境下，可於 `discord-bot/` 目錄執行以下 PowerShell 指令進行打包：
  ```powershell
  powershell -Command "Compress-Archive -Path src, tests, config.json.template, .env.template, kill_port.js, package.json, package-lock.json, PROJECT.md, README.md, TEST_INFRA.md, TEST_READY.md -DestinationPath ..\discord-bot.zip -Force"
  ```
- 壓縮完成後，生成的 `discord-bot.zip` 將會放置於專案根目錄下。

### 3. 已編譯釋出資源 (Compiled Release Assets)
釋出版包含以下核心資產：
- **`craftcore-1.0.0.jar`**: 已編譯的 Minecraft Fabric 伺服器端模組，負責與 Discord 機器人建立 WebSocket 通訊。
- **`discord-bot.zip`**: Discord 機器人原始碼包，解壓後執行 `npm install` 與配置環境即可啟動。

---

## 📜 遊戲內指令

| 指令 | 說明 |
|---|---|
| `/discord` | 取得 Discord 伺服器邀請連結 |
| `/discord link` | 申請 Discord 帳號綁定驗證碼 |

---

## 🤖 Discord 斜線指令 (生產環境)

| 指令 | 說明 | 權限 |
|---|---|---|
| `/checkin` | 每日簽到，獲得簽到與領取面板鑰匙 | 已綁定玩家 |
| `/抽獎` | 使用鑰匙開獎，即時發送或暫存至離線郵件信箱 | 已綁定玩家 |
| `/解除綁定` | 解除 Discord 與 Minecraft 的帳號綁定關係 | 所有人 |
| `/死亡榜` | 查詢玩家死亡排行看板 | 所有人 |
| `/客服單` | 在頻道部署客服單開啟按鈕 | 管理員 |

*備註：為保護使用者隱私與提升系統安全性，舊版 `/綁定`、`/公告`、`/封鎖`、`/玩家資訊`、`/踢出`、`/聯名` 斜線指令已退役並移至 `commands_legacy/` 目錄（僅於測試環境加載）。相關功能已全面移轉至雙面板介面與管理員控制面板。*

---

## 🧪 執行測試

```bash
npm test
```

測試套件包含：
- **Unit Tests**：資料庫層、WebSocket Session Pool、指令邏輯。
- **E2E Tier 1**：功能覆蓋測試。
- **E2E Tier 2**：邊界條件與異常處理測試。
- **E2E Tier 3**：跨模組功能組合測試。
- **E2E Tier 4**：真實世界情境模擬測試。
- **E2E Tier 5**：Phase 2 全新功能（包含雙面板、離線信箱、後台控制等）測試。

---

## 📦 主要依賴

| 套件 | 版本 | 用途 |
|---|---|---|
| `discord.js` | ^14.15 | Discord API 客戶端 |
| `ws` | ^8.18 | WebSocket 伺服器 |
| `winston` | ^3.19 | 結構化日誌系統 |
| `p-queue` | ^6.6 | Discord API 緩衝佇列 |
| `zod` | ^3.23 | WebSocket 封包 Schema 驗證 |

---

## 📄 授權

MIT License © 2026 Craft-Core Team
