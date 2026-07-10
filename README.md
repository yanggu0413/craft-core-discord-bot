# 🎮 Craft-Core Discord Bot

一款專為 Minecraft 伺服器打造的企業級 Discord 機器人，具備完整的雙向訊息同步、帳號綁定、客服單系統、每日簽到抽獎以及管理員指令功能。採用 Clean Architecture 設計原則，確保高可靠性與長期維護性。

---

## ✨ 功能一覽

| 功能類別 | 功能描述 |
|---|---|
| 🔗 帳號綁定 | Discord ↔ Minecraft 雙向帳號連動，綁定後自動加入白名單 |
| 💬 雙向聊天同步 | 遊戲內與 Discord 頻道即時雙向訊息同步（含玩家頭像 Webhook）|
| 📊 伺服器狀態 | Discord 常駐狀態面板，顯示線上玩家、TPS、Ping 值 |
| 🎫 客服單系統 | 點擊按鈕開啟私人頻道客服單，關閉時自動產出 Transcript |
| 📢 公告系統 | 管理員使用 Modal 彈窗發送全伺服器精美公告（支援 @everyone）|
| 📅 每日簽到 | `/checkin` 每日領取一把抽獎鑰匙 |
| 🎰 幸運抽獎 | `/抽獎` 使用鑰匙開獎，即時發送原生物資至玩家背包 |
| 🤝 聯名合作 | 管理員 `/聯名` 給予指定玩家 6 把抽獎鑰匙 |
| ⚙️ 管理員指令 | `/封鎖`、`/踢出`、`/玩家資訊` 等，通過 WebSocket 即時在遊戲內執行 |

---

## 🏗️ 架構概覽 (Clean Architecture)

```
discord-bot/
├── src/
│   ├── index.js                    # 極簡入口，全域錯誤防衛
│   ├── config.js                   # 集中式設定管理
│   ├── bot/
│   │   ├── commands/               # 斜線指令模組
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
│       └── tier4_real_world.test.js
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
```json
{
  "timestamp": "2026-07-09T10:05:33.123Z",
  "level": "info",
  "message": "Minecraft client authenticated",
  "serverId": "lobby"
}
```
- 日誌分級輸出至 `logs/combined.log` 和 `logs/error.log`。
- Process 級別的 `uncaughtException` 與 `unhandledRejection` 分別記錄至 `logs/exceptions.log` 和 `logs/rejections.log`，**確保任何局部錯誤絕不導致 Bot 進程崩潰**。

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
將 `fabric-mod/build/libs/craftcore-*.jar` 放入 Minecraft 伺服器的 `mods/` 目錄並重啟伺服器即可。

---

## 📜 遊戲內指令

| 指令 | 說明 |
|---|---|
| `/discord` | 取得 Discord 伺服器邀請連結 |
| `/discord link` | 申請 Discord 帳號綁定驗證碼 |

---

## 🤖 Discord 斜線指令

| 指令 | 說明 | 權限 |
|---|---|---|
| `/綁定 <驗證碼>` | 使用遊戲內取得的驗證碼完成帳號綁定 | 所有人 |
| `/解綁` | 解除 Discord 與 Minecraft 的帳號綁定 | 所有人 |
| `/我的資訊` | 查詢自己的綁定資訊 | 所有人 |
| `/checkin` | 每日簽到，獲得 1 把抽獎鑰匙 | 已綁定玩家 |
| `/抽獎` | 使用抽獎鑰匙開獎，即時發送遊戲內物資 | 已綁定玩家 |
| `/客服單` | 在頻道部署客服單開啟按鈕 | 管理員 |
| `/公告` | 以精美格式向全伺服器發布公告 | 管理員 |
| `/玩家資訊 <玩家名>` | 查詢玩家線上狀態、座標、上線時間 | 管理員 |
| `/封鎖 <玩家名>` | 封禁指定玩家 | 管理員 |
| `/踢出 <玩家名>` | 踢出指定玩家 | 管理員 |
| `/聯名 <玩家>` | 給予指定玩家 6 把抽獎鑰匙（聯名合作獎勵）| 管理員 |

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
