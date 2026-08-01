"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const wsClient_1 = require("../websocket/wsClient");
const auth_1 = require("../middleware/auth");
const configLoader_1 = require("../utils/configLoader");
const router = (0, express_1.Router)();
function getTaipeiDateString(date = new Date()) {
    const options = { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('zh-TW', options);
    const formatted = formatter.format(date);
    return formatted.replace(/\//g, '-');
}
function getTaipeiYesterdayDateString(date = new Date()) {
    const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    return getTaipeiDateString(yesterday);
}
function getHashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (31 * hash + str.charCodeAt(i)) | 0;
    }
    return hash;
}
class SeededRandom {
    seed;
    constructor(seed) {
        this.seed = Number(BigInt(seed) & 0xffffffffn);
    }
    nextInt(bound) {
        const nextSeed = (BigInt(this.seed) * 1103515245n + 12345n) & 0x7fffffffn;
        this.seed = Number(nextSeed);
        return this.seed % bound;
    }
}
const SLAY_POOL = [
    { type: 1, target: 'Zombie', count: 15, reward: 250 },
    { type: 1, target: 'Skeleton', count: 10, reward: 300 },
    { type: 1, target: 'Creeper', count: 5, reward: 400 },
    { type: 1, target: 'Spider', count: 10, reward: 300 },
    { type: 1, target: 'Enderman', count: 3, reward: 600 },
    { type: 1, target: 'Blaze', count: 5, reward: 500 },
    { type: 1, target: 'Witch', count: 2, reward: 500 },
    { type: 1, target: 'Phantom', count: 3, reward: 400 },
    { type: 1, target: 'Piglin', count: 10, reward: 350 },
    { type: 1, target: 'Wither Skeleton', count: 3, reward: 700 },
    { type: 1, target: 'Guardian', count: 5, reward: 600 },
    { type: 1, target: 'Slime', count: 8, reward: 300 },
    { type: 1, target: 'Pillager', count: 5, reward: 450 },
    { type: 1, target: 'Husk', count: 10, reward: 320 },
    { type: 1, target: 'Stray', count: 10, reward: 320 },
    { type: 1, target: 'Cave Spider', count: 8, reward: 350 }
];
const MINE_POOL = [
    { type: 2, target: 'Coal Ore', count: 20, reward: 200 },
    { type: 2, target: 'Iron Ore', count: 10, reward: 300 },
    { type: 2, target: 'Diamond Ore', count: 3, reward: 1000 },
    { type: 2, target: 'Gold Ore', count: 10, reward: 350 },
    { type: 2, target: 'Redstone Ore', count: 15, reward: 250 },
    { type: 2, target: 'Lapis Ore', count: 10, reward: 300 },
    { type: 2, target: 'Nether Quartz Ore', count: 15, reward: 300 },
    { type: 2, target: 'Ancient Debris', count: 1, reward: 1500 },
    { type: 2, target: 'Emerald Ore', count: 2, reward: 800 },
    { type: 2, target: 'Oak Log', count: 30, reward: 250 },
    { type: 2, target: 'Dark Oak Log', count: 20, reward: 300 },
    { type: 2, target: 'Birch Log', count: 25, reward: 250 },
    { type: 2, target: 'Moss Block', count: 30, reward: 200 },
    { type: 2, target: 'Amethyst Cluster', count: 10, reward: 400 },
    { type: 2, target: 'Obsidian', count: 5, reward: 500 },
    { type: 2, target: 'Basalt', count: 30, reward: 250 }
];
function getDailyTasksFallback(dateStr) {
    const hash = getHashCode(dateStr);
    const rand = new SeededRandom(hash);
    const slayIdx = rand.nextInt(SLAY_POOL.length);
    const mineIdx = rand.nextInt(MINE_POOL.length);
    return [
        { ...SLAY_POOL[slayIdx] },
        { ...MINE_POOL[mineIdx] }
    ];
}
// GET /api/stats - Aggregate global server statistics
router.get('/stats', async (req, res) => {
    const cached = (0, wsClient_1.getCachedData)('stats_cache');
    if (cached)
        return res.json(cached);
    let totalCirculation = 150000.0;
    let salesTax = 0.0;
    let shopsCount = 0;
    let claimsCount = 0;
    let totalPlayers = 0;
    if (wsClient_1.db) {
        try {
            const taxRow = wsClient_1.db.prepare('SELECT SUM(tax_deducted) as total FROM transactions').get();
            if (taxRow && taxRow.total)
                salesTax = Number(taxRow.total);
            const playerRow = wsClient_1.db.prepare('SELECT COUNT(*) as count FROM bindings').get();
            if (playerRow && playerRow.count)
                totalPlayers = Number(playerRow.count);
        }
        catch (e) { }
    }
    // Fallback JSON checks
    try {
        const ecoMap = (0, configLoader_1.loadConfigJson)('economy.json');
        if (ecoMap && typeof ecoMap === 'object') {
            const ecoValues = Object.values(ecoMap);
            if (ecoValues.length > 0) {
                if (!totalPlayers)
                    totalPlayers = ecoValues.length;
                const sumEco = ecoValues.reduce((acc, item) => acc + (Number(item.balance) || 0), 0);
                if (sumEco > 0)
                    totalCirculation = sumEco;
            }
        }
        const shopsMap = (0, configLoader_1.loadConfigJson)('shops.json');
        if (shopsMap && typeof shopsMap === 'object') {
            shopsCount = Object.keys(shopsMap).length;
        }
        const claimsMap = (0, configLoader_1.loadConfigJson)('claims.json');
        if (claimsMap && typeof claimsMap === 'object') {
            claimsCount = Object.keys(claimsMap).length;
        }
    }
    catch (e) { }
    let onlinePlayers = 1;
    let tps = 20.0;
    try {
        const wsRes = await (0, wsClient_1.sendWsQuery)('stats_query', {}, 300);
        if (wsRes && wsRes.success) {
            if (wsRes.onlinePlayers !== undefined)
                onlinePlayers = wsRes.onlinePlayers;
            if (wsRes.tps !== undefined)
                tps = wsRes.tps;
            if (wsRes.totalShopsCount !== undefined)
                shopsCount = wsRes.totalShopsCount;
            if (wsRes.activeClaims !== undefined)
                claimsCount = wsRes.activeClaims;
        }
    }
    catch (e) { }
    // Query 24h circulation / transaction history from transactions table
    let history = [];
    if (wsClient_1.db) {
        try {
            const rows = wsClient_1.db.prepare(`
        SELECT strftime('%Y-%m-%d %H:00', timestamp) as time_slot, SUM(net_profit) as trade_vol
        FROM transactions
        GROUP BY time_slot
        ORDER BY time_slot ASC
        LIMIT 6
      `).all();
            if (rows && rows.length > 0) {
                history = rows.map(r => ({
                    time: r.time_slot ? r.time_slot.substring(11, 16) : '00:00',
                    amount: Math.floor(totalCirculation)
                }));
            }
        }
        catch (e) { }
    }
    if (history.length === 0) {
        history = [{ time: '即時數據', amount: Math.floor(totalCirculation) }];
    }
    const result = {
        success: true,
        totalCirculation: Math.floor(totalCirculation),
        accumulatedSalesTax: salesTax,
        totalShopsCount: shopsCount,
        totalClaimsCount: claimsCount,
        totalPlayersCount: totalPlayers,
        onlinePlayersCount: onlinePlayers,
        serverTps: tps,
        history
    };
    (0, wsClient_1.setCachedData)('stats_cache', result, 5000);
    return res.json(result);
});
// GET /api/leaderboard - Top wealth players
router.get('/leaderboard', async (req, res) => {
    const ecoMap = (0, configLoader_1.loadConfigJson)('economy.json') || {};
    let dbBindingsMap = {};
    if (wsClient_1.db) {
        try {
            const rows = wsClient_1.db.prepare(`
        SELECT mc_username as username, keys_count, checkin_streak, total_checkins
        FROM bindings
      `).all();
            if (rows) {
                for (const row of rows) {
                    if (row.username) {
                        dbBindingsMap[row.username.toLowerCase()] = row;
                    }
                }
            }
        }
        catch (e) {
            console.warn('[Leaderboard] Database query failed:', e);
        }
    }
    const allPlayersMap = new Map();
    // 1. Process economy.json (all players with money, bound or unbound)
    for (const [key, data] of Object.entries(ecoMap)) {
        if (!data || typeof data !== 'object')
            continue;
        const uname = data.username || data.name || key;
        if (!uname || uname.startsWith("fp_"))
            continue; // Skip fake players
        const bal = typeof data.balance === 'number' ? data.balance : 0.0;
        const dbData = dbBindingsMap[uname.toLowerCase()];
        allPlayersMap.set(uname.toLowerCase(), {
            username: uname,
            balance: bal,
            keys_count: dbData ? (Number(dbData.keys_count) || 0) : 0,
            checkin_streak: dbData ? (Number(dbData.checkin_streak) || 0) : 0,
            total_checkins: dbData ? (Number(dbData.total_checkins) || 0) : 0
        });
    }
    // 2. Process DB bindings for any bound players not in economy.json
    for (const [lowerName, dbData] of Object.entries(dbBindingsMap)) {
        if (!allPlayersMap.has(lowerName)) {
            allPlayersMap.set(lowerName, {
                username: dbData.username,
                balance: 0.0,
                keys_count: Number(dbData.keys_count) || 0,
                checkin_streak: Number(dbData.checkin_streak) || 0,
                total_checkins: Number(dbData.total_checkins) || 0
            });
        }
    }
    const leaderboard = Array.from(allPlayersMap.values())
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10)
        .map((item, idx) => ({
        rank: idx + 1,
        username: item.username,
        mc_username: item.username,
        balance: Math.floor(item.balance),
        keys_count: item.keys_count,
        checkin_streak: item.checkin_streak,
        total_checkins: item.total_checkins,
        shopsCount: 0,
        avatar: `https://mc-heads.net/avatar/${item.username}/64`
    }));
    return res.json({ success: true, leaderboard });
});
// GET /api/user/leaderboard & GET /api/welfare/leaderboard - Top keys & checkin players
const handleWelfareLeaderboard = async (req, res) => {
    let leaderboard = [];
    if (wsClient_1.db) {
        try {
            const rows = wsClient_1.db.prepare(`
        SELECT mc_username as username, keys_count, checkin_streak, total_checkins
        FROM bindings
        ORDER BY keys_count DESC, checkin_streak DESC, total_checkins DESC
        LIMIT 10
      `).all();
            if (rows && rows.length > 0) {
                leaderboard = rows.map((row, idx) => ({
                    rank: idx + 1,
                    username: row.username,
                    mc_username: row.username,
                    keys_count: Number(row.keys_count) || 0,
                    checkin_streak: Number(row.checkin_streak) || 0,
                    total_checkins: Number(row.total_checkins) || 0,
                    avatar: `https://mc-heads.net/avatar/${row.username}/64`
                }));
            }
        }
        catch (e) {
            console.warn('[Welfare Leaderboard] Query failed:', e);
        }
    }
    return res.json({ success: true, leaderboard });
};
router.get('/user/leaderboard', handleWelfareLeaderboard);
router.get('/welfare/leaderboard', handleWelfareLeaderboard);
// GET /api/market/analytics - Mineral price & volume 7-day trends (Zero-Mock Policy)
router.get('/market/analytics', (req, res) => {
    const minerals = ['minecraft:diamond', 'minecraft:netherite_ingot', 'minecraft:iron_ingot'];
    const analytics = {};
    minerals.forEach(item => {
        let itemData = [];
        if (wsClient_1.db) {
            try {
                const rows = wsClient_1.db.prepare(`
          SELECT DATE(timestamp) as trade_date, AVG(unit_price) as avg_price, SUM(quantity) as total_vol
          FROM transactions
          WHERE item = ?
          GROUP BY DATE(timestamp)
          ORDER BY trade_date ASC
          LIMIT 7
        `).all(item);
                if (rows && rows.length > 0) {
                    itemData = rows.map((r) => ({
                        date: r.trade_date,
                        price: Math.round(r.avg_price || 0),
                        volume: r.total_vol || 0
                    }));
                }
            }
            catch (e) {
                console.warn(`[Market Analytics] DB query failed for ${item}:`, e);
            }
        }
        analytics[item] = itemData;
    });
    return res.json({
        success: true,
        ...analytics,
        trends: analytics
    });
});
// GET /api/market/recent - Alias for recent transactions
router.get('/market/recent', (req, res) => {
    let trades = [];
    if (wsClient_1.db) {
        try {
            const rows = wsClient_1.db.prepare(`
        SELECT id, timestamp, shop_coords as coords, buyer, seller, item, quantity, unit_price as price, tax_deducted as tax, net_profit
        FROM transactions
        ORDER BY id DESC
        LIMIT 30
      `).all();
            if (rows)
                trades = rows;
        }
        catch (e) { }
    }
    return res.json({
        success: true,
        trades,
        transactions: trades
    });
});
// GET /api/user/profile
router.get('/user/profile', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    let balance = 0.0;
    try {
        const response = await (0, wsClient_1.sendWsQuery)('balance_query', { username }, 300);
        if (response && response.success) {
            balance = response.balance;
        }
    }
    catch (error) {
        console.warn('[Profile API] Failed to fetch balance via WS:', error.message);
    }
    let online = false;
    let coords = '離線';
    let tps = 20.0;
    try {
        const statusRes = await (0, wsClient_1.sendWsQuery)('player_status_query', { username }, 1000);
        if (statusRes && statusRes.online) {
            online = true;
            coords = statusRes.coords || '線上';
            if (typeof statusRes.tps === 'number')
                tps = statusRes.tps;
        }
    }
    catch (e) {
        console.warn('[Profile API] Failed to fetch player online status:', e);
    }
    let dbStats = {};
    const cleanUsername = (username || '').replace(/^\./, '').toLowerCase();
    const ecoMap = (0, configLoader_1.loadConfigJson)('economy.json') || {};
    const ecoKey = Object.keys(ecoMap).find(k => k.replace(/^\./, '').toLowerCase() === cleanUsername) || username;
    const pEco = ecoMap[ecoKey] || {};
    const ecoKeys = Number(pEco.lotteryKeys) || 0;
    if (wsClient_1.db) {
        try {
            const userDiscordId = user.discord_id || '';
            const userUuid = user.mc_uuid || '';
            const row = wsClient_1.db.prepare(`
        SELECT id, keys_count, checkin_streak, total_checkins, last_checkin, subscribe_reminder, discord_id
        FROM bindings
        WHERE lower(replace(mc_username, '.', '')) = ?
           OR (discord_id IS NOT NULL AND discord_id != '' AND discord_id = ?)
           OR (mc_uuid IS NOT NULL AND mc_uuid != '' AND mc_uuid = ?)
      `).get(cleanUsername, userDiscordId, userUuid);
            if (row) {
                const totalKeys = Math.max(Number(row.keys_count) || 0, ecoKeys);
                if (totalKeys > (row.keys_count || 0)) {
                    try {
                        wsClient_1.db.prepare('UPDATE bindings SET keys_count = ? WHERE id = ?').run(totalKeys, row.id);
                    }
                    catch (e) { }
                }
                dbStats = {
                    keys_count: totalKeys,
                    checkin_streak: row.checkin_streak || 0,
                    total_checkins: row.total_checkins || 0,
                    last_checkin: row.last_checkin || null,
                    subscribe_reminder: Boolean(row.subscribe_reminder),
                    discord_id: row.discord_id || null
                };
            }
            else {
                dbStats = {
                    keys_count: ecoKeys,
                    checkin_streak: 0,
                    total_checkins: 0,
                    last_checkin: null,
                    subscribe_reminder: false,
                    discord_id: userDiscordId
                };
            }
        }
        catch (dbErr) {
            console.warn('[Profile API] Failed to fetch DB stats:', dbErr);
        }
    }
    const userDiscordId = dbStats.discord_id || user.discord_id || '';
    const isAdmin = wsClient_1.ADMIN_DISCORD_IDS.has(userDiscordId) || Boolean(user.profile?.isAdmin) || (user.roles || []).includes('1360409328175153242');
    res.json({
        success: true,
        user: {
            mc_username: username,
            mc_uuid: user.mc_uuid,
            balance,
            online,
            coords,
            tps,
            isAdmin,
            ...dbStats
        }
    });
});
// POST /api/user/checkin
router.post('/user/checkin', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: '資料庫連線不可用' });
    const todayStr = getTaipeiDateString();
    const yesterdayStr = getTaipeiYesterdayDateString();
    try {
        const cleanUsername = (username || '').replace(/^\./, '').toLowerCase();
        const userDiscordId = user.discord_id || '';
        const userUuid = user.mc_uuid || '';
        const row = wsClient_1.db.prepare(`
      SELECT * FROM bindings
      WHERE lower(replace(mc_username, '.', '')) = ?
         OR (discord_id IS NOT NULL AND discord_id != '' AND discord_id = ?)
         OR (mc_uuid IS NOT NULL AND mc_uuid != '' AND mc_uuid = ?)
    `).get(cleanUsername, userDiscordId, userUuid);
        if (!row) {
            wsClient_1.db.prepare(`
        INSERT INTO bindings (discord_id, mc_uuid, mc_username, keys_count, last_checkin, checkin_streak, total_checkins)
        VALUES (?, ?, ?, 1, ?, 1, 1)
      `).run(userDiscordId || 'system', userUuid || `uuid-${cleanUsername}`, username, todayStr);
            return res.json({
                success: true,
                message: '首次簽到成功！獲得抽獎鑰匙 x1（連續簽到 1 天，累計 1 天）',
                keys_count: 1,
                checkin_streak: 1,
                total_checkins: 1,
                last_checkin: todayStr
            });
        }
        if (row.last_checkin === todayStr) {
            return res.status(400).json({ success: false, message: '您今天已經完成簽到了！明天再來吧！' });
        }
        let newStreak = 1;
        if (row.last_checkin === yesterdayStr) {
            newStreak = (row.checkin_streak || 0) + 1;
        }
        const newTotal = (row.total_checkins || 0) + 1;
        const updateStmt = wsClient_1.db.prepare(`
      UPDATE bindings
      SET keys_count = keys_count + 1,
          last_checkin = ?,
          checkin_streak = ?,
          total_checkins = ?
      WHERE id = ?
    `);
        updateStmt.run(todayStr, newStreak, newTotal, row.id);
        res.json({
            success: true,
            message: `簽到成功！獲得抽獎鑰匙 x1（連續簽到 ${newStreak} 天，累計 ${newTotal} 天）`,
            keys_count: (row.keys_count || 0) + 1,
            checkin_streak: newStreak,
            total_checkins: newTotal,
            last_checkin: todayStr
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// GET /api/user/mails - Offline mailbox
router.get('/user/mails', auth_1.authenticateToken, (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    let mails = [];
    if (wsClient_1.db) {
        try {
            const rows = wsClient_1.db.prepare(`
        SELECT * FROM offline_mails
        WHERE receiver_username = ? COLLATE NOCASE
        ORDER BY id DESC
      `).all(user.mc_username);
            if (rows)
                mails = rows;
        }
        catch (e) { }
    }
    return res.json({
        success: true,
        mails
    });
});
// POST /api/mail/send - Send mail package or money transfer
router.post('/mail/send', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const { receiver_username, receiver, type, amount, item_id, quantity, nbt } = req.body;
    const targetReceiver = (receiver_username || receiver || '').trim();
    if (!targetReceiver) {
        return res.status(400).json({ success: false, message: '請提供接收者玩家名稱' });
    }
    // Handle Money Transfer
    if (type === 'money' || (amount !== undefined && Number(amount) > 0)) {
        const payAmount = Number(amount);
        if (isNaN(payAmount) || payAmount <= 0) {
            return res.status(400).json({ success: false, message: '請輸入有效的轉帳金額' });
        }
        const cleanSender = user.mc_username.replace(/^\./, '').toLowerCase();
        const cleanReceiver = targetReceiver.replace(/^\./, '').toLowerCase();
        if (cleanSender === cleanReceiver) {
            return res.status(400).json({ success: false, message: '轉帳失敗：不能轉帳給自己！' });
        }
        const ecoMap = (0, configLoader_1.loadConfigJson)('economy.json') || {};
        const senderEcoKey = Object.keys(ecoMap).find(k => k.replace(/^\./, '').toLowerCase() === cleanSender) || user.mc_username;
        const receiverEcoKey = Object.keys(ecoMap).find(k => k.replace(/^\./, '').toLowerCase() === cleanReceiver) || targetReceiver;
        const senderBalance = Number(ecoMap[senderEcoKey]?.balance) || 0;
        if (senderBalance < payAmount) {
            return res.status(400).json({ success: false, message: `您的餘額不足！(目前餘額 $${senderBalance.toFixed(2)})` });
        }
        if (!ecoMap[senderEcoKey])
            ecoMap[senderEcoKey] = { username: user.mc_username, balance: senderBalance };
        if (!ecoMap[receiverEcoKey])
            ecoMap[receiverEcoKey] = { username: targetReceiver, balance: 0 };
        ecoMap[senderEcoKey].balance = Math.max(0, Number(ecoMap[senderEcoKey].balance || 0) - payAmount);
        ecoMap[receiverEcoKey].balance = Number(ecoMap[receiverEcoKey].balance || 0) + payAmount;
        (0, configLoader_1.saveConfigJson)('economy.json', ecoMap);
        // Synchronize to in-game server via WebSocket if online
        try {
            await (0, wsClient_1.sendWsQuery)('player_balance_update', {
                username: user.mc_username,
                balance: ecoMap[senderEcoKey].balance
            }, 1000);
            await (0, wsClient_1.sendWsQuery)('player_balance_update', {
                username: targetReceiver,
                balance: ecoMap[receiverEcoKey].balance
            }, 1000);
        }
        catch (wsErr) { }
        return res.json({ success: true, message: `成功轉帳 $${Math.floor(payAmount)} 元給玩家 ${targetReceiver}！` });
    }
    // Handle Item Package Mail
    const itemId = item_id || 'minecraft:paper';
    const qty = Number(quantity || 1);
    if (wsClient_1.db) {
        try {
            const insertStmt = wsClient_1.db.prepare(`
        INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, nbt, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `);
            insertStmt.run(user.discord_id || 'system', user.mc_username, targetReceiver, itemId, qty, nbt || null);
            return res.json({ success: true, message: `包裹已成功寄出給 ${targetReceiver}！` });
        }
        catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
    return res.json({ success: true, message: `包裹已成功寄出給 ${targetReceiver}！` });
});
// POST /api/mail/send-item - Send item from inventory slot
router.post('/mail/send-item', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const { receiver, receiver_username, slot, count } = req.body;
    const targetReceiver = (receiver || receiver_username || '').trim();
    const sendCount = parseInt(count, 10);
    if (!targetReceiver) {
        return res.status(400).json({ success: false, message: '請提供接收者玩家名稱' });
    }
    if (isNaN(sendCount) || sendCount <= 0) {
        return res.status(400).json({ success: false, message: '請輸入有效的數量' });
    }
    const cleanSender = user.mc_username.replace(/^\./, '').toLowerCase();
    const cleanReceiver = targetReceiver.replace(/^\./, '').toLowerCase();
    if (cleanSender === cleanReceiver) {
        return res.status(400).json({ success: false, message: '寄送失敗：不能寄給自己！' });
    }
    let itemId = 'minecraft:chest';
    let itemNbt = null;
    try {
        const invRes = await (0, wsClient_1.sendWsQuery)('player_inventory_query', { username: user.mc_username }, 1500);
        if (invRes && invRes.success && Array.isArray(invRes.slots)) {
            const targetSlotItem = invRes.slots.find((s) => s && s.slot === Number(slot));
            if (targetSlotItem) {
                itemId = targetSlotItem.itemId || targetSlotItem.id || itemId;
                itemNbt = targetSlotItem.nbt || null;
            }
        }
    }
    catch (e) { }
    if (wsClient_1.db) {
        try {
            const insertStmt = wsClient_1.db.prepare(`
        INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, nbt, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `);
            insertStmt.run(user.discord_id || 'web', user.mc_username, targetReceiver, itemId, sendCount, itemNbt);
            return res.json({ success: true, message: `🎉 背包物品快遞包裹已成功寄出給 ${targetReceiver}！` });
        }
        catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
    return res.json({ success: true, message: `🎉 背包物品快遞包裹已成功寄出給 ${targetReceiver}！` });
});
// GET /api/user/inventory - 41 slot player inventory
router.get('/user/inventory', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    try {
        const response = await (0, wsClient_1.sendWsQuery)('player_inventory_query', { username: user.mc_username }, 2000);
        if (response && response.success && Array.isArray(response.slots)) {
            return res.json({ success: true, username: user.mc_username, slots: response.slots });
        }
    }
    catch (err) { }
    const fallbackSlots = Array(41).fill(null);
    return res.json({
        success: true,
        username: user.mc_username,
        slots: fallbackSlots
    });
});
// POST /api/user/luckydraw - Deduct key & draw prize
const PRIZE_POOL = [
    { id: 'minecraft:diamond', name: '鑽石', count: 5, icon: 'diamond' },
    { id: 'minecraft:golden_carrot', name: '金胡蘿蔔', count: 8, icon: 'golden_carrot' },
    { id: 'minecraft:golden_apple', name: '金蘋果', count: 3, icon: 'golden_apple' },
    { id: 'minecraft:experience_bottle', name: '經驗瓶', count: 32, icon: 'experience_bottle' },
    { id: 'minecraft:totem_of_undying', name: '不死圖騰', count: 1, icon: 'totem_of_undying' },
    { id: 'minecraft:netherite_ingot', name: '獄髓錠', count: 1, icon: 'netherite_ingot' },
    { id: 'minecraft:emerald', name: '綠寶石', count: 16, icon: 'emerald' },
    { id: 'title:lucky_king', name: '限時稱號：[幸運歐皇] (2天)', count: 1, icon: 'netherite_helmet', is_title: true, title_text: '[幸運歐皇]' }
];
router.post('/user/luckydraw', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: '資料庫連線不可用' });
    try {
        const cleanUsername = (username || '').replace(/^\./, '').toLowerCase();
        const userDiscordId = user.discord_id || '';
        const userUuid = user.mc_uuid || '';
        const row = wsClient_1.db.prepare(`
      SELECT id, keys_count FROM bindings
      WHERE lower(replace(mc_username, '.', '')) = ?
         OR (discord_id IS NOT NULL AND discord_id != '' AND discord_id = ?)
         OR (mc_uuid IS NOT NULL AND mc_uuid != '' AND mc_uuid = ?)
    `).get(cleanUsername, userDiscordId, userUuid);
        const currentKeys = Math.max(0, row?.keys_count || 0);
        if (currentKeys < 1) {
            return res.status(400).json({ success: false, message: '您的抽獎鑰匙不足！請先進行每日簽到或完成任務獲得鑰匙。' });
        }
        const newKeys = Math.max(0, currentKeys - 1);
        if (row?.id) {
            wsClient_1.db.prepare('UPDATE bindings SET keys_count = ? WHERE id = ?').run(newKeys, row.id);
        }
        // Sync key deduction to economy.json lotteryKeys to prevent double-spending in-game
        const ecoMap = (0, configLoader_1.loadConfigJson)('economy.json') || {};
        const ecoKey = Object.keys(ecoMap).find(k => k.replace(/^\./, '').toLowerCase() === cleanUsername) || username;
        if (ecoMap[ecoKey]) {
            ecoMap[ecoKey].lotteryKeys = newKeys;
            (0, configLoader_1.saveConfigJson)('economy.json', ecoMap);
        }
        try {
            await (0, wsClient_1.sendWsQuery)('player_keys_update', { username, keys: newKeys }, 1000);
        }
        catch (e) { }
        const prizeIndex = Math.floor(Math.random() * PRIZE_POOL.length);
        const prize = PRIZE_POOL[prizeIndex];
        // Handle Title Prizes with 2-day (48-hour) expiration limit
        if (prize.is_title) {
            const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 48 Hours Expiry
            const titlesMap = (0, configLoader_1.loadConfigJson)('titles.json') || {};
            const lowerName = username.toLowerCase();
            if (!titlesMap[lowerName]) {
                titlesMap[lowerName] = { activeTitle: '', unlockedTitles: [], titleExpiries: {} };
            }
            if (!titlesMap[lowerName].titleExpiries) {
                titlesMap[lowerName].titleExpiries = {};
            }
            const titleText = prize.title_text || '[幸運歐皇]';
            if (!titlesMap[lowerName].unlockedTitles.includes(titleText)) {
                titlesMap[lowerName].unlockedTitles.push(titleText);
            }
            titlesMap[lowerName].titleExpiries[titleText] = expiresAt;
            titlesMap[lowerName].activeTitle = titleText;
            (0, configLoader_1.saveConfigJson)('titles.json', titlesMap);
            try {
                wsClient_1.db.prepare(`
          INSERT INTO player_titles (username, title_text, color_code, is_bold, updated_at, expires_at)
          VALUES (?, ?, '§6', 1, ?, ?)
          ON CONFLICT(username) DO UPDATE SET 
            title_text=excluded.title_text, 
            expires_at=excluded.expires_at, 
            updated_at=excluded.updated_at
        `).run(username, titleText, new Date().toISOString(), expiresAt);
            }
            catch (e) { }
            try {
                await (0, wsClient_1.sendWsQuery)('command_request', {
                    command: `/title set "${username}" "${titleText}"`,
                    admin_username: 'LuckyDraw'
                }, 1500);
            }
            catch (wsErr) { }
            return res.json({
                success: true,
                prize,
                remaining_keys: newKeys,
                message: `🎉 抽獎大成功！恭喜獲得限定專屬稱號「${titleText}」（有效期限：2 天）！`
            });
        }
        const isMoney = prize.id === 'craftcore:money';
        const amount = prize.count || 1000;
        if (isMoney) {
            try {
                await (0, wsClient_1.sendWsQuery)('give_money', { username, amount }, 1500);
            }
            catch (wsErr) {
                try {
                    wsClient_1.db.prepare(`
            INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, status)
            VALUES ('system', 'System LuckyDraw', ?, 'craftcore:money', ?, 'pending')
          `).run(username, amount);
                }
                catch (e) { }
            }
        }
        else {
            try {
                await (0, wsClient_1.sendWsQuery)('luckydraw_response', {
                    username,
                    item: prize.id,
                    amount,
                    keysCount: newKeys,
                    success: true,
                    message: `🎉 幸運大抽獎獲得 ${prize.name}！`
                }, 1500);
            }
            catch (wsErr) {
                try {
                    wsClient_1.db.prepare(`
            INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, status)
            VALUES ('system', 'System LuckyDraw', ?, ?, ?, 'pending')
          `).run(username, prize.id, amount);
                }
                catch (e) { }
            }
        }
        return res.json({
            success: true,
            prize,
            remaining_keys: newKeys,
            message: `🎉 抽獎成功！恭喜獲得 ${prize.name} x${prize.count}！`
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/user/buy-key-with-money - Purchase lottery keys
router.post('/user/buy-key-with-money', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    const rawCount = req.body.count;
    const count = Number(rawCount);
    if (!Number.isInteger(count) || count < 1) {
        return res.status(400).json({ success: false, message: '購買數量必須為 1 以上的正整數！' });
    }
    const costPerKey = 500;
    const totalCost = count * costPerKey;
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: '資料庫連線不可用' });
    // 1. Atomically check & deduct money from economy.json
    const cleanUsername = (username || '').replace(/^\./, '').toLowerCase();
    const ecoMap = (0, configLoader_1.loadConfigJson)('economy.json') || {};
    const ecoKey = Object.keys(ecoMap).find(k => k.replace(/^\./, '').toLowerCase() === cleanUsername) || username;
    const pEco = ecoMap[ecoKey] || { username, balance: 0 };
    const currentBalance = Number(pEco.balance) || 0;
    if (currentBalance < totalCost) {
        return res.status(400).json({
            success: false,
            message: `金幣餘額不足！購買 ${count} 把鑰匙需要 $${totalCost}，您目前僅有 $${currentBalance.toFixed(2)}`
        });
    }
    // Deduct money in economy.json
    const newBalance = Math.max(0, currentBalance - totalCost);
    ecoMap[ecoKey] = { ...pEco, balance: newBalance };
    (0, configLoader_1.saveConfigJson)('economy.json', ecoMap);
    // 2. Update SQLite bindings keys_count & sync economy.json lotteryKeys
    let newKeys = count;
    try {
        const userDiscordId = user.discord_id || '';
        const userUuid = user.mc_uuid || '';
        const row = wsClient_1.db.prepare(`
      SELECT id, keys_count FROM bindings
      WHERE lower(replace(mc_username, '.', '')) = ?
         OR (discord_id IS NOT NULL AND discord_id != '' AND discord_id = ?)
         OR (mc_uuid IS NOT NULL AND mc_uuid != '' AND mc_uuid = ?)
    `).get(cleanUsername, userDiscordId, userUuid);
        const currentKeys = Math.max(0, row?.keys_count || 0);
        newKeys = currentKeys + count;
        if (!row) {
            wsClient_1.db.prepare('INSERT INTO bindings (discord_id, mc_uuid, mc_username, keys_count) VALUES (?, ?, ?, ?)').run(user.discord_id || 'system', user.mc_uuid || `dev-uuid-${cleanUsername}`, username, newKeys);
        }
        else {
            wsClient_1.db.prepare('UPDATE bindings SET keys_count = ? WHERE id = ?').run(newKeys, row.id);
        }
        // Also update lotteryKeys in economy.json
        ecoMap[ecoKey].lotteryKeys = newKeys;
        (0, configLoader_1.saveConfigJson)('economy.json', ecoMap);
    }
    catch (error) {
        console.error('[Buy Key Error]', error);
    }
    // Notify Fabric mod via WS
    try {
        await (0, wsClient_1.sendWsQuery)('player_balance_update', { username, balance: newBalance }, 1000);
        await (0, wsClient_1.sendWsQuery)('player_keys_update', { username, keys: newKeys }, 1000);
        await (0, wsClient_1.sendWsQuery)('reload_config', { target: 'economy' }, 1000);
    }
    catch (e) { }
    return res.json({
        success: true,
        message: `成功購買 ${count} 把鑰匙！`,
        keys_count: newKeys
    });
});
// POST /api/user/reminder-subscription - Toggle check-in reminder
router.post('/user/reminder-subscription', auth_1.authenticateToken, (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: '資料庫連線不可用' });
    try {
        const row = wsClient_1.db.prepare('SELECT subscribe_reminder FROM bindings WHERE mc_username = ? COLLATE NOCASE').get(username);
        const currentSub = row?.subscribe_reminder || 0;
        const newSub = currentSub === 1 ? 0 : 1;
        wsClient_1.db.prepare('UPDATE bindings SET subscribe_reminder = ? WHERE mc_username = ? COLLATE NOCASE').run(newSub, username);
        return res.json({
            success: true,
            subscribed: newSub === 1,
            message: newSub === 1 ? '已開啟每日簽到提醒 Notification' : '已關閉每日簽到提醒'
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/user/upgrade
router.post('/user/upgrade', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    try {
        const response = await (0, wsClient_1.sendWsQuery)('shop_action', {
            action: 'upgrade',
            username
        });
        return res.json({ success: response.success, message: response.message });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// GET /api/user/fakeplayers
router.get('/user/fakeplayers', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const cacheKey = `cache:fakeplayers:${user.mc_username.toLowerCase()}`;
    const cached = (0, wsClient_1.getCachedData)(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
        return res.json({ success: true, fakeplayers: cached, cached: true });
    }
    try {
        const response = await (0, wsClient_1.sendWsQuery)('fake_players_query', { username: user.mc_username }, 2000);
        const rawList = Array.isArray(response?.entries) ? response.entries : (Array.isArray(response?.fakeplayers) ? response.fakeplayers : []);
        if (response && response.success && rawList.length >= 0) {
            const myBots = rawList.filter((b) => {
                const ownerName = typeof b.owner === 'object' && b.owner !== null ? (b.owner.owner || b.owner.username || '') : String(b.owner || '');
                return ownerName.toLowerCase() === user.mc_username.toLowerCase() || String(b.owner || '').toLowerCase() === user.mc_username.toLowerCase();
            }).map((b) => ({
                name: b.name || b.botName,
                owner: user.mc_username,
                online: Boolean(b.online || b.isOnline)
            }));
            (0, wsClient_1.setCachedData)(cacheKey, myBots, 3000);
            return res.json({ success: true, fakeplayers: myBots });
        }
    }
    catch (error) {
        console.warn('[FakePlayers Route] WebSocket query failed, falling back to local file');
    }
    try {
        const map = (0, configLoader_1.loadConfigJson)('fake_players.json');
        if (map && typeof map === 'object') {
            const myBots = Object.entries(map)
                .filter(([_, ownerVal]) => {
                const ownerName = typeof ownerVal === 'object' && ownerVal !== null ? (ownerVal.owner || ownerVal.username || '') : String(ownerVal || '');
                return ownerName.toLowerCase() === user.mc_username.toLowerCase();
            })
                .map(([name, ownerVal]) => {
                const ownerName = typeof ownerVal === 'object' && ownerVal !== null ? (ownerVal.owner || ownerVal.username || '') : String(ownerVal || '');
                return { name, owner: ownerName, online: false };
            });
            (0, wsClient_1.setCachedData)(cacheKey, myBots, 2000);
            return res.json({ success: true, fakeplayers: myBots });
        }
    }
    catch (fsErr) { }
    return res.json({ success: true, fakeplayers: [] });
});
// POST /api/user/fakeplayers/action
router.post('/user/fakeplayers/action', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const { botName, action } = req.body;
    if (!botName || typeof action !== 'string') {
        return res.status(400).json({ success: false, message: '請提供有效的假人名稱與動作' });
    }
    if (action === 'spawn' || action === '') {
        try {
            const statusRes = await (0, wsClient_1.sendWsQuery)('player_status_query', { username: user.mc_username });
            if (!statusRes || !statusRes.online) {
                return res.status(400).json({ success: false, message: '您必須在遊戲內線上才能召喚假人！' });
            }
        }
        catch (e) {
            return res.status(500).json({ success: false, message: '無法確認您的線上狀態' });
        }
    }
    try {
        const fullCmd = action.trim() ? `/fp ${botName} ${action}` : `/fp ${botName}`;
        const response = await (0, wsClient_1.sendWsQuery)('command_request', { command: fullCmd });
        (0, wsClient_1.invalidateCachePattern)('cache:fakeplayers');
        return res.json({ success: response.success, message: response.output || '指令已送出' });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// GET /api/user/homes
router.get('/user/homes', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    try {
        const response = await (0, wsClient_1.sendWsQuery)('homes_query', { username: user.mc_username });
        if (response && response.success) {
            return res.json({ success: true, homes: response.homes || [] });
        }
    }
    catch (error) {
        console.warn('[Homes Route] WebSocket query failed, falling back to local file');
    }
    try {
        const map = (0, configLoader_1.loadConfigJson)('homes.json');
        if (map && typeof map === 'object' && map[user.mc_username]) {
            const userHomes = map[user.mc_username];
            const homesList = Array.isArray(userHomes) ? userHomes : Object.values(userHomes);
            return res.json({ success: true, homes: homesList });
        }
    }
    catch (e) { }
    return res.json({ success: true, homes: [] });
});
// DELETE /api/user/homes/:name
router.delete('/user/homes/:name', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const name = req.params.name;
    try {
        const response = await (0, wsClient_1.sendWsQuery)('teleport_update', {
            type: 'home',
            username: user.mc_username,
            name: name,
            action: 'delete'
        });
        return res.json({ success: response.success, message: response.message });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// GET /api/lockboxes
router.get('/lockboxes', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    try {
        const response = await (0, wsClient_1.sendWsQuery)('lockboxes_query', {});
        const allLockboxes = response.lockboxes || [];
        const myLockboxes = allLockboxes.filter((l) => l.owner.toLowerCase() === username.toLowerCase());
        return res.json({ success: true, lockboxes: myLockboxes });
    }
    catch (error) {
        try {
            const lockboxMap = (0, configLoader_1.loadConfigJson)('lockboxes.json');
            if (lockboxMap && typeof lockboxMap === 'object') {
                const lockboxArray = Object.values(lockboxMap)
                    .filter((l) => l.owner.toLowerCase() === username.toLowerCase())
                    .map((l) => ({
                    id: l.id,
                    location: l.location,
                    owner: l.owner,
                    authorized: l.authorized || []
                }));
                return res.json({ success: true, lockboxes: lockboxArray });
            }
        }
        catch (fsErr) { }
        res.json({ success: true, lockboxes: [] });
    }
});
// POST /api/lockboxes/update
router.post('/lockboxes/update', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    const { lockboxId, action, targetPlayer, newPassword } = req.body;
    if (!lockboxId || !action) {
        return res.status(400).json({ success: false, message: '缺少必要參數' });
    }
    try {
        const response = await (0, wsClient_1.sendWsQuery)('lockboxes_action', {
            username,
            lockboxId,
            action,
            targetPlayer,
            newPassword
        });
        return res.json({ success: response.success, message: response.message });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// GET /api/tasks/daily & GET /api/user/daily-tasks
const handleGetDailyTasks = async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let username = null;
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, wsClient_1.JWT_SECRET);
            username = decoded.mc_username;
        }
        catch (err) { }
    }
    const dateStr = getTaipeiDateString();
    if (!username) {
        const fallbackTasks = getDailyTasksFallback(dateStr);
        const tasks = [
            { type: 1, target: fallbackTasks[0].target, count: fallbackTasks[0].count, reward: fallbackTasks[0].reward, progress: 0, claimed: false },
            { type: 2, target: fallbackTasks[1].target, count: fallbackTasks[1].count, reward: fallbackTasks[1].reward, progress: 0, claimed: false }
        ];
        return res.json({
            success: true,
            date: dateStr,
            slay_task: fallbackTasks[0],
            mine_task: fallbackTasks[1],
            tasks,
            slay_progress: 0,
            mine_progress: 0,
            has_claimed: false,
            is_completed: false
        });
    }
    try {
        const response = await (0, wsClient_1.sendWsQuery)('daily_tasks_query', { username });
        if (response && response.success) {
            const responseTasks = Array.isArray(response.tasks) ? response.tasks : [];
            const slay_task = responseTasks.find((t) => t.type === 1) || response.slay_task;
            const mine_task = responseTasks.find((t) => t.type === 2) || response.mine_task;
            const slayProgress = typeof slay_task?.progress === 'number' ? slay_task.progress : (response.slay_progress || 0);
            const mineProgress = typeof mine_task?.progress === 'number' ? mine_task.progress : (response.mine_progress || 0);
            const slayClaimed = Boolean(slay_task?.claimed !== undefined ? slay_task.claimed : (response.slay_claimed !== undefined ? response.slay_claimed : response.has_claimed));
            const mineClaimed = Boolean(mine_task?.claimed !== undefined ? mine_task.claimed : (response.mine_claimed !== undefined ? response.mine_claimed : response.has_claimed));
            const fallbackTasks = getDailyTasksFallback(dateStr);
            const sTarget = slay_task?.target || fallbackTasks[0].target;
            const sCount = slay_task?.count || fallbackTasks[0].count;
            const sReward = slay_task?.reward || fallbackTasks[0].reward;
            const mTarget = mine_task?.target || fallbackTasks[1].target;
            const mCount = mine_task?.count || fallbackTasks[1].count;
            const mReward = mine_task?.reward || fallbackTasks[1].reward;
            const tasks = [
                { type: 1, target: sTarget, count: sCount, reward: sReward, progress: slayProgress, claimed: slayClaimed },
                { type: 2, target: mTarget, count: mCount, reward: mReward, progress: mineProgress, claimed: mineClaimed }
            ];
            return res.json({
                success: true,
                date: dateStr,
                slay_task: tasks[0],
                mine_task: tasks[1],
                tasks,
                slay_progress: slayProgress,
                mine_progress: mineProgress,
                slay_claimed: slayClaimed,
                mine_claimed: mineClaimed,
                has_claimed: slayClaimed && mineClaimed,
                is_completed: (slayProgress >= sCount) && (mineProgress >= mCount)
            });
        }
    }
    catch (error) { }
    // Fallback: Read directly from economy.json
    const ecoMap = (0, configLoader_1.loadConfigJson)('economy.json') || {};
    const cleanUser = (username || '').replace(/^\./, '').toLowerCase();
    const ecoKey = Object.keys(ecoMap).find(k => k.replace(/^\./, '').toLowerCase() === cleanUser) || username;
    const pEco = ecoMap[ecoKey] || {};
    const slayProg = pEco.daily_slay_progress || 0;
    const mineProg = pEco.daily_gather_progress || 0;
    const slayClaimed = Boolean(pEco.daily_slay_claimed);
    const mineClaimed = Boolean(pEco.daily_gather_claimed);
    const fallbackTasks = getDailyTasksFallback(dateStr);
    const tasks = [
        { type: 1, target: fallbackTasks[0].target, count: fallbackTasks[0].count, reward: fallbackTasks[0].reward, progress: slayProg, claimed: slayClaimed },
        { type: 2, target: fallbackTasks[1].target, count: fallbackTasks[1].count, reward: fallbackTasks[1].reward, progress: mineProg, claimed: mineClaimed }
    ];
    return res.json({
        success: true,
        date: dateStr,
        slay_task: fallbackTasks[0],
        mine_task: fallbackTasks[1],
        tasks,
        slay_progress: slayProg,
        mine_progress: mineProg,
        slay_claimed: slayClaimed,
        mine_claimed: mineClaimed,
        has_claimed: slayClaimed && mineClaimed,
        is_completed: slayProg >= fallbackTasks[0].count && mineProg >= fallbackTasks[1].count
    });
};
router.get('/tasks/daily', handleGetDailyTasks);
router.get('/user/daily-tasks', handleGetDailyTasks);
// POST /api/tasks/claim & POST /api/user/claim-daily-task
const handleClaimDailyTask = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    try {
        const response = await (0, wsClient_1.sendWsQuery)('claim_daily_reward', { username });
        return res.json({ success: response.success, message: response.message });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
router.post('/tasks/claim', auth_1.authenticateToken, handleClaimDailyTask);
router.post('/user/claim-daily-task', auth_1.authenticateToken, handleClaimDailyTask);
// GET /api/bounty & GET /api/user/bounty
const handleGetGlobalBounty = async (req, res) => {
    const goalData = (0, configLoader_1.loadConfigJson)('global_goal.json') || {};
    const title = goalData.title || '全服每週共同目標';
    const currentCount = goalData.currentCount || 0;
    const targetCount = goalData.targetCount || 3000;
    const goalType = goalData.goalType || 'KILL_MOBS';
    const targetItem = goalData.targetItem || 'ANY_MOB';
    const completed = Boolean(goalData.completed);
    const contributions = goalData.contributions || {};
    return res.json({
        success: true,
        title,
        current_count: currentCount,
        target_count: targetCount,
        goal_type: goalType,
        target_item: targetItem,
        completed,
        min_threshold: 50,
        contributions_count: Object.keys(contributions).length
    });
};
router.get('/bounty', handleGetGlobalBounty);
router.get('/user/bounty', handleGetGlobalBounty);
// POST /api/playtime/exchange & /api/user/exchange-playtime
const handlePlaytimeExchange = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    const { mode } = req.body;
    try {
        const response = await (0, wsClient_1.sendWsQuery)('playtime_exchange', { username, mode: mode || 'single' });
        if (response && response.success && response.keys_added > 0 && wsClient_1.db) {
            try {
                const cleanUsername = (username || '').replace(/^\./, '').toLowerCase();
                const row = wsClient_1.db.prepare(`
          SELECT id, keys_count FROM bindings
          WHERE lower(replace(mc_username, '.', '')) = ?
             OR (discord_id IS NOT NULL AND discord_id != '' AND discord_id = ?)
        `).get(cleanUsername, user.discord_id || '');
                if (row) {
                    wsClient_1.db.prepare('UPDATE bindings SET keys_count = keys_count + ? WHERE id = ?').run(response.keys_added, row.id);
                }
            }
            catch (err) {
                console.error('[Playtime Exchange DB Sync Error]', err);
            }
        }
        return res.json({ success: true, message: response.message, keys_added: response.keys_added || 0 });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
router.post('/playtime/exchange', auth_1.authenticateToken, handlePlaytimeExchange);
router.post('/user/exchange-playtime', auth_1.authenticateToken, handlePlaytimeExchange);
// GET /api/warp-submissions & GET /api/admin/warp-submissions
const handleGetWarpSubmissions = (req, res) => {
    let submissions = [];
    if (wsClient_1.db) {
        try {
            const rows = wsClient_1.db.prepare('SELECT * FROM warp_submissions ORDER BY id DESC').all();
            if (rows)
                submissions = rows;
        }
        catch (e) { }
    }
    return res.json({ success: true, submissions });
};
router.get('/warp-submissions', handleGetWarpSubmissions);
router.get('/admin/warp-submissions', handleGetWarpSubmissions);
// POST /api/warp-submissions & POST /api/user/submit-warp
const handleSubmitWarp = (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const { facility_name, function_desc, coords, dimension } = req.body;
    if (!facility_name || !coords) {
        return res.status(400).json({ success: false, message: '缺少地標名稱或座標' });
    }
    if (wsClient_1.db) {
        try {
            const stmt = wsClient_1.db.prepare(`
        INSERT INTO warp_submissions (applicant_username, applicant_discord_id, facility_name, function_desc, coords, dimension)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            stmt.run(user.mc_username, user.discord_id || null, facility_name, function_desc || '', coords, dimension || 'minecraft:overworld');
            return res.json({ success: true, message: '公用設施傳送點申請已送出！' });
        }
        catch (e) {
            return res.status(500).json({ success: false, message: e.message });
        }
    }
    return res.json({ success: true, message: '公用設施傳送點申請已送出！' });
};
router.post('/warp-submissions', auth_1.authenticateToken, handleSubmitWarp);
router.post('/user/submit-warp', auth_1.authenticateToken, handleSubmitWarp);
// GET /api/warps & GET /api/public/warps - Public landmark warps
const handleGetWarps = async (req, res) => {
    const cached = (0, wsClient_1.getCachedData)('warps_cache');
    if (cached)
        return res.json(cached);
    let rawList = [];
    const warpsConfig = (0, configLoader_1.loadConfigJson)('warps.json');
    if (Array.isArray(warpsConfig)) {
        rawList = warpsConfig;
    }
    else if (warpsConfig && typeof warpsConfig === 'object') {
        rawList = Object.entries(warpsConfig).map(([key, val]) => {
            let name = key;
            let coords = '';
            let dimension = 'minecraft:overworld';
            let owner = undefined;
            let type = undefined;
            if (typeof val === 'string') {
                coords = val;
            }
            else if (typeof val === 'object' && val !== null) {
                name = val.name || key;
                owner = val.owner;
                type = val.type;
                dimension = val.dimension || val.world || val.dimensionName || 'minecraft:overworld';
                if (val.coords) {
                    coords = val.coords;
                }
                else if (val.location) {
                    coords = val.location;
                }
                else if (val.x !== undefined && val.y !== undefined && val.z !== undefined) {
                    coords = `${Math.floor(val.x)}, ${Math.floor(val.y)}, ${Math.floor(val.z)}`;
                }
            }
            return { name, coords, dimension, owner, type };
        });
    }
    const warps = rawList.map(w => {
        let rawDim = String(w.dimension || 'minecraft:overworld').toLowerCase();
        let dimDisplay = '主世界';
        if (rawDim.includes('nether'))
            dimDisplay = '地獄';
        else if (rawDim.includes('end'))
            dimDisplay = '終界';
        return {
            name: w.name || '未命名地標',
            coords: w.coords || (w.x !== undefined ? `${Math.floor(w.x)}, ${Math.floor(w.y)}, ${Math.floor(w.z)}` : '未提供座標'),
            dimension: rawDim,
            dimensionDisplay: dimDisplay,
            owner: w.owner,
            type: w.type
        };
    });
    const result = { success: true, warps };
    (0, wsClient_1.setCachedData)('warps_cache', result, 5000);
    return res.json(result);
};
router.get('/warps', handleGetWarps);
router.get('/public/warps', handleGetWarps);
// DELETE /api/warps/:name & /api/user/warps/:name
const handleDeleteWarp = async (req, res) => {
    const { name } = req.params;
    const user = req.user;
    if (!name)
        return res.status(400).json({ success: false, message: '缺少地標名稱' });
    try {
        let warpsMap = (0, configLoader_1.loadConfigJson)('warps.json') || {};
        let foundKey = Object.keys(warpsMap).find(k => k.toLowerCase() === name.toLowerCase());
        if (foundKey) {
            delete warpsMap[foundKey];
            (0, configLoader_1.saveConfigJson)('warps.json', warpsMap);
            (0, wsClient_1.invalidateCachePattern)('warps_cache');
        }
        try {
            await (0, wsClient_1.sendWsQuery)('command_request', {
                command: `/warp remove "${name}"`,
                admin_username: user?.mc_username || 'Web-Dashboard'
            }, 3000);
        }
        catch (wsErr) { }
        return res.json({ success: true, message: `已成功刪除地標：「${name}」！` });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
router.delete('/warps/:name', auth_1.authenticateToken, handleDeleteWarp);
router.delete('/user/warps/:name', auth_1.authenticateToken, handleDeleteWarp);
exports.default = router;
