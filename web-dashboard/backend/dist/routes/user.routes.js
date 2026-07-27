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
    { type: 1, target: 'Creeper', count: 5, reward: 400 }
];
const MINE_POOL = [
    { type: 2, target: 'Coal Ore', count: 20, reward: 200 },
    { type: 2, target: 'Iron Ore', count: 10, reward: 300 },
    { type: 2, target: 'Diamond Ore', count: 3, reward: 1000 }
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
        const wsRes = await (0, wsClient_1.sendWsQuery)('stats_query', {}, 1500);
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
    return res.json({
        success: true,
        totalCirculation,
        accumulatedSalesTax: salesTax,
        totalShopsCount: shopsCount,
        activeClaims: claimsCount,
        totalPlayers,
        onlinePlayers,
        tps
    });
});
// GET /api/leaderboard & GET /api/user/leaderboard - Top wealth players
const handleLeaderboard = async (req, res) => {
    let leaderboard = [];
    const ecoMap = (0, configLoader_1.loadConfigJson)('economy.json') || {};
    if (wsClient_1.db) {
        try {
            const rows = wsClient_1.db.prepare(`
        SELECT mc_username as username, keys_count, checkin_streak, total_checkins
        FROM bindings
      `).all();
            if (rows && rows.length > 0) {
                leaderboard = rows.map((row) => {
                    const playerEco = ecoMap[row.username] || Object.values(ecoMap).find((v) => v && typeof v === 'object' && (v.username?.toLowerCase() === row.username.toLowerCase() || v.name?.toLowerCase() === row.username.toLowerCase()));
                    const realBalance = playerEco && typeof playerEco.balance === 'number' ? playerEco.balance : 0.0;
                    return {
                        username: row.username,
                        balance: realBalance,
                        shopsCount: 0,
                        avatar: `https://mc-heads.net/avatar/${row.username}/64`
                    };
                })
                    .sort((a, b) => b.balance - a.balance)
                    .map((item, idx) => ({ rank: idx + 1, ...item }))
                    .slice(0, 10);
            }
        }
        catch (e) {
            console.warn('[Leaderboard] Database query failed:', e);
        }
    }
    if (leaderboard.length === 0 && Object.keys(ecoMap).length > 0) {
        const entries = Object.entries(ecoMap)
            .map(([uuid, data]) => ({
            username: data.username || data.name || uuid,
            balance: Number(data.balance) || 0.0
        }))
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 10);
        leaderboard = entries.map((item, idx) => ({
            rank: idx + 1,
            username: item.username,
            balance: item.balance,
            shopsCount: 0,
            avatar: `https://mc-heads.net/avatar/${item.username}/64`
        }));
    }
    return res.json({
        success: true,
        leaderboard
    });
};
router.get('/leaderboard', handleLeaderboard);
router.get('/user/leaderboard', handleLeaderboard);
// GET /api/market/analytics - Mineral price & volume 7-day trends
router.get('/market/analytics', (req, res) => {
    const minerals = ['minecraft:diamond', 'minecraft:netherite_ingot', 'minecraft:iron_ingot'];
    const analytics = {};
    const dates = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${month}/${day}`);
    }
    const basePrices = {
        'minecraft:diamond': 500,
        'minecraft:netherite_ingot': 2500,
        'minecraft:iron_ingot': 50
    };
    const baseVolumes = {
        'minecraft:diamond': 20,
        'minecraft:netherite_ingot': 5,
        'minecraft:iron_ingot': 150
    };
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
                    itemData = rows.map((r, idx) => ({
                        date: r.trade_date || dates[idx % dates.length],
                        price: Math.round(r.avg_price || basePrices[item]),
                        volume: r.total_vol || baseVolumes[item]
                    }));
                }
            }
            catch (e) { }
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
        const response = await (0, wsClient_1.sendWsQuery)('balance_query', { username }, 1500);
        if (response && response.success) {
            balance = response.balance;
        }
    }
    catch (error) {
        console.warn('[Profile API] Failed to fetch balance via WS:', error.message);
    }
    let dbStats = {};
    if (wsClient_1.db) {
        try {
            const row = wsClient_1.db.prepare('SELECT keys_count, checkin_streak, total_checkins, last_checkin, subscribe_reminder, discord_id FROM bindings WHERE mc_username = ? COLLATE NOCASE').get(username);
            if (row) {
                dbStats = {
                    keys_count: row.keys_count || 0,
                    checkin_streak: row.checkin_streak || 0,
                    total_checkins: row.total_checkins || 0,
                    last_checkin: row.last_checkin || null,
                    subscribe_reminder: Boolean(row.subscribe_reminder),
                    discord_id: row.discord_id || null
                };
            }
        }
        catch (dbErr) {
            console.warn('[Profile API] Failed to fetch DB stats:', dbErr);
        }
    }
    res.json({
        success: true,
        user: {
            mc_username: username,
            mc_uuid: user.mc_uuid,
            balance,
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
        const row = wsClient_1.db.prepare('SELECT * FROM bindings WHERE mc_username = ? COLLATE NOCASE').get(username);
        if (!row) {
            return res.status(404).json({ success: false, message: '找不到玩家綁定紀錄' });
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
      WHERE mc_username = ? COLLATE NOCASE
    `);
        updateStmt.run(todayStr, newStreak, newTotal, username);
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
// POST /api/mail/send - Send mail package
router.post('/mail/send', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const { receiver_username, item_id, quantity, nbt } = req.body;
    if (!receiver_username || !item_id || !quantity) {
        return res.status(400).json({ success: false, message: '缺少接收者、物品 ID 或數量參數' });
    }
    if (wsClient_1.db) {
        try {
            const insertStmt = wsClient_1.db.prepare(`
        INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, nbt, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `);
            insertStmt.run(user.discord_id || 'system', user.mc_username, receiver_username, item_id, Number(quantity), nbt || null);
            return res.json({ success: true, message: `包裹已成功寄出給 ${receiver_username}！` });
        }
        catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
    return res.json({ success: true, message: `包裹已成功寄出給 ${receiver_username}！` });
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
    { id: 'minecraft:emerald', name: '綠寶石', count: 16, icon: 'emerald' }
];
router.post('/user/luckydraw', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: '資料庫連線不可用' });
    try {
        const row = wsClient_1.db.prepare('SELECT keys_count FROM bindings WHERE mc_username = ? COLLATE NOCASE').get(username);
        const currentKeys = row?.keys_count || 0;
        if (currentKeys < 1) {
            return res.status(400).json({ success: false, message: '您的抽獎鑰匙不足！請先進行每日簽到或完成任務獲得鑰匙。' });
        }
        const newKeys = currentKeys - 1;
        wsClient_1.db.prepare('UPDATE bindings SET keys_count = ? WHERE mc_username = ? COLLATE NOCASE').run(newKeys, username);
        const prizeIndex = Math.floor(Math.random() * PRIZE_POOL.length);
        const prize = PRIZE_POOL[prizeIndex];
        try {
            await (0, wsClient_1.sendWsQuery)('deliver_item', { username, item: prize.id, count: prize.count }, 1500);
        }
        catch (wsErr) {
            try {
                wsClient_1.db.prepare(`
          INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, status)
          VALUES ('system', 'System LuckyDraw', ?, ?, ?, 'pending')
        `).run(username, prize.id, prize.count);
            }
            catch (e) { }
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
    const count = Math.max(1, parseInt(req.body.count || '1', 10));
    const costPerKey = 500;
    const totalCost = count * costPerKey;
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: '資料庫連線不可用' });
    // 1. Check player balance
    let balance = 0;
    let balanceFetched = false;
    try {
        const wsRes = await (0, wsClient_1.sendWsQuery)('balance_query', { username }, 1500);
        if (wsRes && wsRes.success && typeof wsRes.balance === 'number') {
            balance = wsRes.balance;
            balanceFetched = true;
        }
    }
    catch (e) { }
    if (!balanceFetched) {
        try {
            const ecoMap = (0, configLoader_1.loadConfigJson)('economy.json');
            if (ecoMap && typeof ecoMap === 'object') {
                const playerEco = ecoMap[username] || Object.values(ecoMap).find((v) => v.username?.toLowerCase() === username.toLowerCase() || v.name?.toLowerCase() === username.toLowerCase());
                if (playerEco && typeof playerEco.balance === 'number') {
                    balance = playerEco.balance;
                    balanceFetched = true;
                }
            }
        }
        catch (e) { }
    }
    if (balance < totalCost) {
        return res.status(400).json({
            success: false,
            message: `金幣餘額不足！購買 ${count} 把鑰匙需要 $${totalCost}，您目前僅有 $${balance}`
        });
    }
    // 2. Deduct money
    try {
        await (0, wsClient_1.sendWsQuery)('command_request', { command: `removemoney "${username}" ${totalCost}` }, 1500);
    }
    catch (e) {
        try {
            await (0, wsClient_1.sendWsQuery)('give_money', { username, amount: -totalCost }, 1500);
        }
        catch (err) { }
    }
    // 3. Update SQLite bindings keys_count
    try {
        const row = wsClient_1.db.prepare('SELECT keys_count FROM bindings WHERE mc_username = ? COLLATE NOCASE').get(username);
        const currentKeys = row?.keys_count || 0;
        const newKeys = currentKeys + count;
        if (!row) {
            wsClient_1.db.prepare('INSERT INTO bindings (discord_id, mc_uuid, mc_username, keys_count) VALUES (?, ?, ?, ?)').run(user.discord_id || 'system', user.mc_uuid || `dev-uuid-${username.toLowerCase()}`, username, newKeys);
        }
        else {
            wsClient_1.db.prepare('UPDATE bindings SET keys_count = ? WHERE mc_username = ? COLLATE NOCASE').run(newKeys, username);
        }
        return res.json({
            success: true,
            message: `成功購買 ${count} 把鑰匙！`,
            keys_count: newKeys
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
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
        const response = await (0, wsClient_1.sendWsQuery)('fake_players_query', { username: user.mc_username }, 1500);
        if (response && response.success && Array.isArray(response.fakeplayers)) {
            const myBots = response.fakeplayers.filter((b) => {
                const ownerName = typeof b.owner === 'object' && b.owner !== null ? (b.owner.owner || b.owner.username || '') : String(b.owner || '');
                return ownerName.toLowerCase() === user.mc_username.toLowerCase();
            });
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
// GET /api/tasks/daily
router.get('/tasks/daily', async (req, res) => {
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
            const slay_task = response.slay_task;
            const mine_task = response.mine_task;
            const tasks = [
                { type: 1, target: slay_task?.target || 'Zombie', count: slay_task?.count || 15, reward: slay_task?.reward || 250, progress: response.slay_progress || 0, claimed: Boolean(response.has_claimed) },
                { type: 2, target: mine_task?.target || 'Coal Ore', count: mine_task?.count || 20, reward: mine_task?.reward || 200, progress: response.mine_progress || 0, claimed: Boolean(response.has_claimed) }
            ];
            return res.json({
                success: true,
                date: dateStr,
                slay_task,
                mine_task,
                tasks,
                slay_progress: response.slay_progress || 0,
                mine_progress: response.mine_progress || 0,
                has_claimed: Boolean(response.has_claimed),
                is_completed: Boolean(response.is_completed)
            });
        }
    }
    catch (error) { }
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
});
// POST /api/tasks/claim
router.post('/tasks/claim', auth_1.authenticateToken, async (req, res) => {
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
});
// POST /api/playtime/exchange & /api/user/exchange-playtime
const handlePlaytimeExchange = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    const { mode } = req.body;
    try {
        const response = await (0, wsClient_1.sendWsQuery)('playtime_exchange', { username, mode: mode || 'single' });
        return res.json({ success: response.success, message: response.message, keys_added: response.keys_added || 0 });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
router.post('/playtime/exchange', auth_1.authenticateToken, handlePlaytimeExchange);
router.post('/user/exchange-playtime', auth_1.authenticateToken, handlePlaytimeExchange);
// GET /api/warp-submissions & POST /api/warp-submissions
router.get('/warp-submissions', (req, res) => {
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
});
router.post('/warp-submissions', auth_1.authenticateToken, (req, res) => {
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
});
exports.default = router;
