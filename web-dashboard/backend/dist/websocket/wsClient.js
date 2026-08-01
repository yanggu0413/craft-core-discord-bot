"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.authenticateToken = exports.botWsClient = exports.totalShopsCount = exports.accumulatedSalesTax = exports.db = exports.ADMIN_DISCORD_IDS = exports.DATABASE_PATH = exports.WEBSOCKET_SECRET = exports.WEBSOCKET_URL = exports.JWT_SECRET = void 0;
exports.setWssInstance = setWssInstance;
exports.broadcastToWebClients = broadcastToWebClients;
exports.connectToBotWS = connectToBotWS;
exports.sendWsQuery = sendWsQuery;
exports.getCachedData = getCachedData;
exports.setCachedData = setCachedData;
exports.invalidateCachePattern = invalidateCachePattern;
exports.sendEventAnnouncementToDiscord = sendEventAnnouncementToDiscord;
const ws_1 = __importDefault(require("ws"));
// @ts-ignore
const node_sqlite_1 = require("node:sqlite");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
exports.JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_99881122';
exports.WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:8080';
exports.WEBSOCKET_SECRET = process.env.WEBSOCKET_SECRET || 'c34fc25b90a6ea1d38e2bc79679fbc9d';
const dbCandidates = [
    process.env.DATABASE_PATH ? path_1.default.resolve(__dirname, process.env.DATABASE_PATH) : null,
    '/root/craft-core/discord-bot/src/database/database.db',
    '/craft-core/discord-bot/src/database/database.db',
    path_1.default.resolve(__dirname, '../../../discord-bot/src/database/database.db'),
    path_1.default.resolve(__dirname, '../../../../discord-bot/src/database/database.db'),
    path_1.default.resolve('discord-bot/src/database/database.db'),
    path_1.default.resolve('../discord-bot/src/database/database.db')
].filter(Boolean);
exports.DATABASE_PATH = dbCandidates.find(p => fs_1.default.existsSync(p)) || dbCandidates[0];
exports.ADMIN_DISCORD_IDS = new Set([
    '1248891236480188517',
    '1286603217056174080',
    '988642621834547260',
    '987308805719207966'
]);
// Database connection
exports.db = null;
try {
    if (fs_1.default.existsSync(exports.DATABASE_PATH)) {
        exports.db = new node_sqlite_1.DatabaseSync(exports.DATABASE_PATH);
        console.log(`Connected to shared SQLite database at: ${exports.DATABASE_PATH}`);
    }
    else {
        console.warn(`Database not found at ${exports.DATABASE_PATH}, will fallback to memory DB`);
        exports.db = new node_sqlite_1.DatabaseSync(':memory:');
        exports.db.exec(`
      CREATE TABLE IF NOT EXISTS bindings (
        discord_id TEXT PRIMARY KEY,
        mc_uuid TEXT NOT NULL UNIQUE,
        mc_username TEXT NOT NULL COLLATE NOCASE,
        keys_count INTEGER DEFAULT 0,
        last_checkin TEXT,
        checkin_streak INTEGER DEFAULT 0,
        total_checkins INTEGER DEFAULT 0,
        subscribe_reminder INTEGER DEFAULT 0,
        exchanged_ticks INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }
    if (exports.db) {
        exports.db.exec(`
      CREATE TABLE IF NOT EXISTS offline_mails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_discord_id TEXT,
        sender_username TEXT,
        receiver_username TEXT,
        item_id TEXT,
        quantity INTEGER,
        nbt TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        exports.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        shop_coords TEXT,
        buyer TEXT,
        seller TEXT,
        item TEXT,
        quantity INTEGER,
        unit_price REAL,
        tax_deducted REAL,
        net_profit REAL
      )
    `);
        exports.db.exec(`
      CREATE TABLE IF NOT EXISTS server_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        reward_info TEXT,
        status TEXT DEFAULT 'active',
        creator_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        exports.db.exec(`
      CREATE TABLE IF NOT EXISTS warp_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        applicant_username TEXT NOT NULL,
        applicant_discord_id TEXT,
        facility_name TEXT NOT NULL,
        function_desc TEXT NOT NULL,
        coords TEXT NOT NULL,
        dimension TEXT DEFAULT 'minecraft:overworld',
        status TEXT DEFAULT 'pending',
        admin_reviewer TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        exports.db.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        scope TEXT,
        impact TEXT,
        publisher TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        exports.db.exec(`
      CREATE TABLE IF NOT EXISTS player_titles (
        username TEXT PRIMARY KEY COLLATE NOCASE,
        title_text TEXT NOT NULL,
        color_code TEXT DEFAULT '§c',
        is_bold INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      )
    `);
        try {
            exports.db.exec('ALTER TABLE player_titles ADD COLUMN expires_at DATETIME');
        }
        catch (e) { }
        try {
            exports.db.prepare(`
        INSERT OR IGNORE INTO player_titles (username, title_text, color_code, is_bold)
        VALUES ('im_little_rory', '[服主]', '§c', 1)
      `).run();
        }
        catch (e) { }
        try {
            exports.db.exec('ALTER TABLE bindings ADD COLUMN discord_tag TEXT');
        }
        catch (e) { }
        try {
            exports.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_bindings_username ON bindings(mc_username);
        CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer);
        CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller);
        CREATE INDEX IF NOT EXISTS idx_events_status ON server_events(status);
        CREATE INDEX IF NOT EXISTS idx_warp_subs_status ON warp_submissions(status);
      `);
        }
        catch (e) { }
    }
}
catch (error) {
    console.error('Failed to initialize database connection', error);
}
// Global Memory Stats
exports.accumulatedSalesTax = 0;
if (exports.db) {
    try {
        const row = exports.db.prepare('SELECT SUM(tax_deducted) as total FROM transactions').get();
        exports.accumulatedSalesTax = row?.total || 0;
    }
    catch (e) {
        exports.accumulatedSalesTax = 0;
    }
}
exports.totalShopsCount = 0;
// Web Frontend WebSocket Server instance
let wssInstance = null;
function setWssInstance(wss) {
    wssInstance = wss;
}
function broadcastToWebClients(data) {
    if (wssInstance) {
        wssInstance.clients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }
}
// WebSocket Client to Discord Bot Bridge
exports.botWsClient = null;
const pendingQueries = new Map();
function connectToBotWS() {
    console.log(`Connecting to Discord Bot WS at: ${exports.WEBSOCKET_URL}`);
    exports.botWsClient = new ws_1.default(exports.WEBSOCKET_URL);
    exports.botWsClient.on('open', () => {
        console.log('Connected to Discord Bot WS. Authenticating...');
        exports.botWsClient?.send(JSON.stringify({
            type: 'auth',
            payload: {
                secret: exports.WEBSOCKET_SECRET,
                role: 'web-dashboard'
            }
        }));
    });
    exports.botWsClient.on('message', (data) => {
        try {
            const packet = JSON.parse(data.toString());
            const { type, payload } = packet;
            if (type.endsWith('_response') || type === 'error_response') {
                const queryId = payload?.query_id || payload?.command_id;
                if (queryId && pendingQueries.has(queryId)) {
                    const pending = pendingQueries.get(queryId);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        pendingQueries.delete(queryId);
                        if (type === 'error_response') {
                            pending.reject(new Error(payload.message || 'Query failed'));
                        }
                        else {
                            pending.resolve(payload);
                        }
                    }
                }
            }
            if (type === 'transaction_log') {
                const log = payload;
                exports.accumulatedSalesTax += log.tax_deducted || 0;
                if (exports.db) {
                    try {
                        const insertTx = exports.db.prepare('INSERT INTO transactions (shop_coords, buyer, seller, item, quantity, unit_price, tax_deducted, net_profit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                        insertTx.run(log.shop_coords || log.coords || '', log.buyer, log.seller, log.item, log.quantity, log.unit_price, log.tax_deducted || 0, log.net_profit || 0);
                    }
                    catch (dbErr) {
                        console.error('Failed to save transaction log to database:', dbErr);
                    }
                }
                broadcastToWebClients({
                    type: 'transaction_log',
                    payload: log
                });
            }
        }
        catch (err) {
            console.error('Error parsing packet from Discord Bot WS', err);
        }
    });
    exports.botWsClient.on('close', () => {
        console.warn('Discord Bot WS connection lost. Reconnecting in 3 seconds...');
        pendingQueries.forEach((pending) => {
            clearTimeout(pending.timeout);
            try {
                pending.reject(new Error('WebSocket connection closed'));
            }
            catch (e) { }
        });
        pendingQueries.clear();
        setTimeout(connectToBotWS, 3000);
    });
    exports.botWsClient.on('error', (err) => {
        console.error('Discord Bot WS connection error:', err.message);
    });
}
function sendWsQuery(type, payload, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        if (!exports.botWsClient || exports.botWsClient.readyState !== ws_1.default.OPEN) {
            return reject(new Error('遊戲伺服器連線已中斷'));
        }
        const queryId = payload.query_id || Math.random().toString(36).substring(2, 15);
        payload.query_id = queryId;
        if (type === 'command_request') {
            payload.command_id = queryId;
        }
        const timeout = setTimeout(() => {
            pendingQueries.delete(queryId);
            reject(new Error('查詢伺服器超時'));
        }, timeoutMs);
        pendingQueries.set(queryId, { resolve, reject, timeout });
        exports.botWsClient.send(JSON.stringify({
            type,
            payload
        }));
    });
}
const apiMemoryCache = new Map();
function getCachedData(key) {
    const entry = apiMemoryCache.get(key);
    if (!entry)
        return null;
    if (Date.now() > entry.expiresAt) {
        apiMemoryCache.delete(key);
        return null;
    }
    return entry.data;
}
function setCachedData(key, data, ttlMs = 3000) {
    apiMemoryCache.set(key, {
        data,
        expiresAt: Date.now() + ttlMs
    });
}
function invalidateCachePattern(pattern) {
    for (const key of apiMemoryCache.keys()) {
        if (key.includes(pattern)) {
            apiMemoryCache.delete(key);
        }
    }
}
// Middlewares re-exported from middleware/auth
var auth_1 = require("../middleware/auth");
Object.defineProperty(exports, "authenticateToken", { enumerable: true, get: function () { return auth_1.authenticateToken; } });
Object.defineProperty(exports, "requireAdmin", { enumerable: true, get: function () { return auth_1.requireAdmin; } });
async function sendEventAnnouncementToDiscord(event) {
    const token = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
    const roleId = process.env.DISCORD_EVENT_PING_ROLE_ID || '1360409328175153242';
    if (!token || !channelId)
        return;
    try {
        const payload = {
            content: `<@&${roleId}>`,
            embeds: [
                {
                    title: `🎪 限時活動公告：${event.title}`,
                    description: event.description,
                    color: 15965202,
                    fields: [
                        { name: '🎁 活動獎勵說明', value: event.reward_info || '登入遊戲查看全服特別獎勵！' },
                        { name: '📅 活動起訖時間', value: `${event.start_time || '即刻開始'} ~ ${event.end_time || '永久常駐'}` }
                    ],
                    footer: { text: `發布者: ${event.creator_name || 'Craft-Core 管理團隊'}` },
                    timestamp: new Date().toISOString()
                }
            ],
            allowed_mentions: { roles: [roleId] }
        };
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    }
    catch (err) {
        console.error('Failed to send event announcement to Discord channel', err);
    }
}
