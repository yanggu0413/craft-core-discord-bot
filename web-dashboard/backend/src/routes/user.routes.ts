import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db, sendWsQuery, getCachedData, setCachedData, invalidateCachePattern, CustomRequest, JWT_SECRET, ADMIN_DISCORD_IDS } from '../websocket/wsClient';
import { authenticateToken } from '../middleware/auth';
import { loadConfigJson, saveConfigJson } from '../utils/configLoader';

const router = Router();

function getTaipeiDateString(date: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('zh-TW', options);
  const formatted = formatter.format(date);
  return formatted.replace(/\//g, '-');
}

function getTaipeiYesterdayDateString(date: Date = new Date()): string {
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getTaipeiDateString(yesterday);
}

function getHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (31 * hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = Number(BigInt(seed) & 0xffffffffn);
  }
  nextInt(bound: number): number {
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
  { type: 1, target: 'Phantom', count: 3, reward: 400 }
];

const MINE_POOL = [
  { type: 2, target: 'Coal Ore', count: 20, reward: 200 },
  { type: 2, target: 'Iron Ore', count: 10, reward: 300 },
  { type: 2, target: 'Diamond Ore', count: 3, reward: 1000 },
  { type: 2, target: 'Gold Ore', count: 10, reward: 350 },
  { type: 2, target: 'Redstone Ore', count: 15, reward: 250 },
  { type: 2, target: 'Lapis Ore', count: 10, reward: 300 },
  { type: 2, target: 'Nether Quartz Ore', count: 15, reward: 300 },
  { type: 2, target: 'Ancient Debris', count: 1, reward: 1500 }
];

function getDailyTasksFallback(dateStr: string) {
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
router.get('/stats', async (req: Request, res: Response) => {
  const cached = getCachedData<any>('stats_cache');
  if (cached) return res.json(cached);

  let totalCirculation = 150000.0;
  let salesTax = 0.0;
  let shopsCount = 0;
  let claimsCount = 0;
  let totalPlayers = 0;

  if (db) {
    try {
      const taxRow = db.prepare('SELECT SUM(tax_deducted) as total FROM transactions').get() as any;
      if (taxRow && taxRow.total) salesTax = Number(taxRow.total);

      const playerRow = db.prepare('SELECT COUNT(*) as count FROM bindings').get() as any;
      if (playerRow && playerRow.count) totalPlayers = Number(playerRow.count);
    } catch (e) {}
  }

  // Fallback JSON checks
  try {
    const ecoMap = loadConfigJson<Record<string, any>>('economy.json');
    if (ecoMap && typeof ecoMap === 'object') {
      const ecoValues = Object.values(ecoMap);
      if (ecoValues.length > 0) {
        if (!totalPlayers) totalPlayers = ecoValues.length;
        const sumEco = ecoValues.reduce((acc: number, item: any) => acc + (Number(item.balance) || 0), 0);
        if (sumEco > 0) totalCirculation = sumEco;
      }
    }

    const shopsMap = loadConfigJson<Record<string, any>>('shops.json');
    if (shopsMap && typeof shopsMap === 'object') {
      shopsCount = Object.keys(shopsMap).length;
    }

    const claimsMap = loadConfigJson<Record<string, any>>('claims.json');
    if (claimsMap && typeof claimsMap === 'object') {
      claimsCount = Object.keys(claimsMap).length;
    }
  } catch (e) {}

  let onlinePlayers = 1;
  let tps = 20.0;

  try {
    const wsRes = await sendWsQuery('stats_query', {}, 300);
    if (wsRes && wsRes.success) {
      if (wsRes.onlinePlayers !== undefined) onlinePlayers = wsRes.onlinePlayers;
      if (wsRes.tps !== undefined) tps = wsRes.tps;
      if (wsRes.totalShopsCount !== undefined) shopsCount = wsRes.totalShopsCount;
      if (wsRes.activeClaims !== undefined) claimsCount = wsRes.activeClaims;
    }
  } catch (e) {}

  // Query 24h circulation / transaction history from transactions table
  let history: any[] = [];
  if (db) {
    try {
      const rows = db.prepare(`
        SELECT strftime('%Y-%m-%d %H:00', timestamp) as time_slot, SUM(net_profit) as trade_vol
        FROM transactions
        GROUP BY time_slot
        ORDER BY time_slot ASC
        LIMIT 6
      `).all() as any[];
      if (rows && rows.length > 0) {
        history = rows.map(r => ({
          time: r.time_slot ? r.time_slot.substring(11, 16) : '00:00',
          amount: Math.floor(totalCirculation)
        }));
      }
    } catch (e) {}
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

  setCachedData('stats_cache', result, 5000);
  return res.json(result);
});

// GET /api/leaderboard - Top wealth players
router.get('/leaderboard', async (req: Request, res: Response) => {
  const ecoMap = loadConfigJson<Record<string, any>>('economy.json') || {};
  let dbBindingsMap: Record<string, any> = {};

  if (db) {
    try {
      const rows = db.prepare(`
        SELECT mc_username as username, keys_count, checkin_streak, total_checkins
        FROM bindings
      `).all() as any[];
      if (rows) {
        for (const row of rows) {
          if (row.username) {
            dbBindingsMap[row.username.toLowerCase()] = row;
          }
        }
      }
    } catch (e) {
      console.warn('[Leaderboard] Database query failed:', e);
    }
  }

  const allPlayersMap = new Map<string, { username: string; balance: number; keys_count: number; checkin_streak: number; total_checkins: number }>();

  // 1. Process economy.json (all players with money, bound or unbound)
  for (const [key, data] of Object.entries(ecoMap)) {
    if (!data || typeof data !== 'object') continue;
    const uname = data.username || data.name || key;
    if (!uname || uname.startsWith("fp_")) continue; // Skip fake players
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
const handleWelfareLeaderboard = async (req: Request, res: Response) => {
  let leaderboard: any[] = [];
  if (db) {
    try {
      const rows = db.prepare(`
        SELECT mc_username as username, keys_count, checkin_streak, total_checkins
        FROM bindings
        ORDER BY keys_count DESC, checkin_streak DESC, total_checkins DESC
        LIMIT 10
      `).all() as any[];

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
    } catch (e) {
      console.warn('[Welfare Leaderboard] Query failed:', e);
    }
  }

  return res.json({ success: true, leaderboard });
};

router.get('/user/leaderboard', handleWelfareLeaderboard);
router.get('/welfare/leaderboard', handleWelfareLeaderboard);

// GET /api/market/analytics - Mineral price & volume 7-day trends (Zero-Mock Policy)
router.get('/market/analytics', (req: Request, res: Response) => {
  const minerals = ['minecraft:diamond', 'minecraft:netherite_ingot', 'minecraft:iron_ingot'];
  const analytics: Record<string, any[]> = {};

  minerals.forEach(item => {
    let itemData: any[] = [];
    if (db) {
      try {
        const rows = db.prepare(`
          SELECT DATE(timestamp) as trade_date, AVG(unit_price) as avg_price, SUM(quantity) as total_vol
          FROM transactions
          WHERE item = ?
          GROUP BY DATE(timestamp)
          ORDER BY trade_date ASC
          LIMIT 7
        `).all(item) as any[];

        if (rows && rows.length > 0) {
          itemData = rows.map((r) => ({
            date: r.trade_date,
            price: Math.round(r.avg_price || 0),
            volume: r.total_vol || 0
          }));
        }
      } catch (e) {
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
router.get('/market/recent', (req: Request, res: Response) => {
  let trades: any[] = [];
  if (db) {
    try {
      const rows = db.prepare(`
        SELECT id, timestamp, shop_coords as coords, buyer, seller, item, quantity, unit_price as price, tax_deducted as tax, net_profit
        FROM transactions
        ORDER BY id DESC
        LIMIT 30
      `).all() as any[];
      if (rows) trades = rows;
    } catch (e) {}
  }

  return res.json({
    success: true,
    trades,
    transactions: trades
  });
});

// GET /api/user/profile
router.get('/user/profile', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  let balance = 0.0;
  try {
    const response = await sendWsQuery('balance_query', { username }, 300);
    if (response && response.success) {
      balance = response.balance;
    }
  } catch (error: any) {
    console.warn('[Profile API] Failed to fetch balance via WS:', error.message);
  }

  let online = false;
  let coords = '離線';
  let tps = 20.0;
  try {
    const statusRes = await sendWsQuery('player_status_query', { username }, 1000);
    if (statusRes && statusRes.online) {
      online = true;
      coords = statusRes.coords || '線上';
      if (typeof statusRes.tps === 'number') tps = statusRes.tps;
    }
  } catch (e) {
    console.warn('[Profile API] Failed to fetch player online status:', e);
  }

  let dbStats: any = {};
  const cleanUsername = (username || '').replace(/^\./, '').toLowerCase();
  const ecoMap = loadConfigJson<Record<string, any>>('economy.json') || {};
  const ecoKey = Object.keys(ecoMap).find(k => k.replace(/^\./, '').toLowerCase() === cleanUsername) || username;
  const pEco = ecoMap[ecoKey] || {};
  const ecoKeys = Number(pEco.lotteryKeys) || 0;

  if (db) {
    try {
      const userDiscordId = user.discord_id || '';
      const userUuid = user.mc_uuid || '';
      const row = db.prepare(`
        SELECT id, keys_count, checkin_streak, total_checkins, last_checkin, subscribe_reminder, discord_id
        FROM bindings
        WHERE lower(replace(mc_username, '.', '')) = ?
           OR (discord_id IS NOT NULL AND discord_id != '' AND discord_id = ?)
           OR (mc_uuid IS NOT NULL AND mc_uuid != '' AND mc_uuid = ?)
      `).get(cleanUsername, userDiscordId, userUuid) as any;
      if (row) {
        const totalKeys = Math.max(Number(row.keys_count) || 0, ecoKeys);
        if (totalKeys > (row.keys_count || 0)) {
          try {
            db.prepare('UPDATE bindings SET keys_count = ? WHERE id = ?').run(totalKeys, row.id);
          } catch (e) {}
        }
        dbStats = {
          keys_count: totalKeys,
          checkin_streak: row.checkin_streak || 0,
          total_checkins: row.total_checkins || 0,
          last_checkin: row.last_checkin || null,
          subscribe_reminder: Boolean(row.subscribe_reminder),
          discord_id: row.discord_id || null
        };
      } else {
        dbStats = {
          keys_count: ecoKeys,
          checkin_streak: 0,
          total_checkins: 0,
          last_checkin: null,
          subscribe_reminder: false,
          discord_id: userDiscordId
        };
      }
    } catch (dbErr) {
      console.warn('[Profile API] Failed to fetch DB stats:', dbErr);
    }
  }

  const userDiscordId = dbStats.discord_id || user.discord_id || '';
  const isAdmin = ADMIN_DISCORD_IDS.has(userDiscordId) || Boolean(user.profile?.isAdmin) || (user.roles || []).includes('1360409328175153242');

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
router.post('/user/checkin', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  if (!db) return res.status(500).json({ success: false, message: '資料庫連線不可用' });

  const todayStr = getTaipeiDateString();
  const yesterdayStr = getTaipeiYesterdayDateString();

  try {
    const cleanUsername = (username || '').replace(/^\./, '').toLowerCase();
    const userDiscordId = user.discord_id || '';
    const userUuid = user.mc_uuid || '';
    const row = db.prepare(`
      SELECT * FROM bindings
      WHERE lower(replace(mc_username, '.', '')) = ?
         OR (discord_id IS NOT NULL AND discord_id != '' AND discord_id = ?)
         OR (mc_uuid IS NOT NULL AND mc_uuid != '' AND mc_uuid = ?)
    `).get(cleanUsername, userDiscordId, userUuid) as any;

    if (!row) {
      db.prepare(`
        INSERT INTO bindings (discord_id, mc_uuid, mc_username, keys_count, last_checkin, checkin_streak, total_checkins)
        VALUES (?, ?, ?, 1, ?, 1, 1)
      `).run(
        userDiscordId || 'system',
        userUuid || `uuid-${cleanUsername}`,
        username,
        todayStr
      );
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
    const updateStmt = db.prepare(`
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/user/mails - Offline mailbox
router.get('/user/mails', authenticateToken, (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  let mails: any[] = [];
  if (db) {
    try {
      const rows = db.prepare(`
        SELECT * FROM offline_mails
        WHERE receiver_username = ? COLLATE NOCASE
        ORDER BY id DESC
      `).all(user.mc_username) as any[];
      if (rows) mails = rows;
    } catch (e) {}
  }

  return res.json({
    success: true,
    mails
  });
});

// POST /api/mail/send - Send mail package or money transfer
router.post('/mail/send', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

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

    const ecoMap = loadConfigJson<Record<string, any>>('economy.json') || {};
    const senderEcoKey = Object.keys(ecoMap).find(k => k.replace(/^\./, '').toLowerCase() === cleanSender) || user.mc_username;
    const receiverEcoKey = Object.keys(ecoMap).find(k => k.replace(/^\./, '').toLowerCase() === cleanReceiver) || targetReceiver;

    const senderBalance = Number(ecoMap[senderEcoKey]?.balance) || 0;
    if (senderBalance < payAmount) {
      return res.status(400).json({ success: false, message: `您的餘額不足！(目前餘額 $${senderBalance.toFixed(2)})` });
    }

    if (!ecoMap[senderEcoKey]) ecoMap[senderEcoKey] = { username: user.mc_username, balance: senderBalance };
    if (!ecoMap[receiverEcoKey]) ecoMap[receiverEcoKey] = { username: targetReceiver, balance: 0 };

    ecoMap[senderEcoKey].balance = Math.max(0, Number(ecoMap[senderEcoKey].balance || 0) - payAmount);
    ecoMap[receiverEcoKey].balance = Number(ecoMap[receiverEcoKey].balance || 0) + payAmount;
    saveConfigJson('economy.json', ecoMap);

    // Synchronize to in-game server via WebSocket if online
    try {
      await sendWsQuery('player_balance_update', {
        username: user.mc_username,
        balance: ecoMap[senderEcoKey].balance
      }, 1000);
      await sendWsQuery('player_balance_update', {
        username: targetReceiver,
        balance: ecoMap[receiverEcoKey].balance
      }, 1000);
    } catch (wsErr) {}

    return res.json({ success: true, message: `成功轉帳 $${Math.floor(payAmount)} 元給玩家 ${targetReceiver}！` });
  }

  // Handle Item Package Mail
  const itemId = item_id || 'minecraft:paper';
  const qty = Number(quantity || 1);

  if (db) {
    try {
      const insertStmt = db.prepare(`
        INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, nbt, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `);
      insertStmt.run(user.discord_id || 'system', user.mc_username, targetReceiver, itemId, qty, nbt || null);
      return res.json({ success: true, message: `包裹已成功寄出給 ${targetReceiver}！` });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  return res.json({ success: true, message: `包裹已成功寄出給 ${targetReceiver}！` });
});

// POST /api/mail/send-item - Send item from inventory slot
router.post('/mail/send-item', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

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
  let itemNbt: string | null = null;

  try {
    const invRes = await sendWsQuery('player_inventory_query', { username: user.mc_username }, 1500);
    if (invRes && invRes.success && Array.isArray(invRes.slots)) {
      const targetSlotItem = invRes.slots.find((s: any) => s && s.slot === Number(slot));
      if (targetSlotItem) {
        itemId = targetSlotItem.itemId || targetSlotItem.id || itemId;
        itemNbt = targetSlotItem.nbt || null;
      }
    }
  } catch (e) {}

  if (db) {
    try {
      const insertStmt = db.prepare(`
        INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, nbt, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `);
      insertStmt.run(user.discord_id || 'web', user.mc_username, targetReceiver, itemId, sendCount, itemNbt);
      return res.json({ success: true, message: `🎉 背包物品快遞包裹已成功寄出給 ${targetReceiver}！` });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  return res.json({ success: true, message: `🎉 背包物品快遞包裹已成功寄出給 ${targetReceiver}！` });
});

// GET /api/user/inventory - 41 slot player inventory
router.get('/user/inventory', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  try {
    const response = await sendWsQuery('player_inventory_query', { username: user.mc_username }, 2000);
    if (response && response.success && Array.isArray(response.slots)) {
      return res.json({ success: true, username: user.mc_username, slots: response.slots });
    }
  } catch (err) {}

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

router.post('/user/luckydraw', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  if (!db) return res.status(500).json({ success: false, message: '資料庫連線不可用' });

  try {
    const cleanUsername = (username || '').replace(/^\./, '').toLowerCase();
    const userDiscordId = user.discord_id || '';
    const userUuid = user.mc_uuid || '';
    const row = db.prepare(`
      SELECT id, keys_count FROM bindings
      WHERE lower(replace(mc_username, '.', '')) = ?
         OR (discord_id IS NOT NULL AND discord_id != '' AND discord_id = ?)
         OR (mc_uuid IS NOT NULL AND mc_uuid != '' AND mc_uuid = ?)
    `).get(cleanUsername, userDiscordId, userUuid) as any;
    const currentKeys = Math.max(0, row?.keys_count || 0);

    if (currentKeys < 1) {
      return res.status(400).json({ success: false, message: '您的抽獎鑰匙不足！請先進行每日簽到或完成任務獲得鑰匙。' });
    }

    const newKeys = Math.max(0, currentKeys - 1);
    if (row?.id) {
      db.prepare('UPDATE bindings SET keys_count = ? WHERE id = ?').run(newKeys, row.id);
    }

    // Sync key deduction to economy.json lotteryKeys to prevent double-spending in-game
    const ecoMap = loadConfigJson<Record<string, any>>('economy.json') || {};
    const ecoKey = Object.keys(ecoMap).find(k => k.replace(/^\./, '').toLowerCase() === cleanUsername) || username;
    if (ecoMap[ecoKey]) {
      ecoMap[ecoKey].lotteryKeys = newKeys;
      saveConfigJson('economy.json', ecoMap);
    }
    try {
      await sendWsQuery('player_keys_update', { username, keys: newKeys }, 1000);
    } catch (e) {}

    const prizeIndex = Math.floor(Math.random() * PRIZE_POOL.length);
    const prize = PRIZE_POOL[prizeIndex];

    // Handle Title Prizes with 2-day (48-hour) expiration limit
    if ((prize as any).is_title) {
      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 48 Hours Expiry
      const titlesMap = loadConfigJson<Record<string, any>>('titles.json') || {};
      const lowerName = username.toLowerCase();
      
      if (!titlesMap[lowerName]) {
        titlesMap[lowerName] = { activeTitle: '', unlockedTitles: [], titleExpiries: {} };
      }
      if (!titlesMap[lowerName].titleExpiries) {
        titlesMap[lowerName].titleExpiries = {};
      }
      
      const titleText = (prize as any).title_text || '[幸運歐皇]';
      if (!titlesMap[lowerName].unlockedTitles.includes(titleText)) {
        titlesMap[lowerName].unlockedTitles.push(titleText);
      }
      titlesMap[lowerName].titleExpiries[titleText] = expiresAt;
      titlesMap[lowerName].activeTitle = titleText;
      saveConfigJson('titles.json', titlesMap);

      try {
        db.prepare(`
          INSERT INTO player_titles (username, title_text, color_code, is_bold, updated_at, expires_at)
          VALUES (?, ?, '§6', 1, ?, ?)
          ON CONFLICT(username) DO UPDATE SET 
            title_text=excluded.title_text, 
            expires_at=excluded.expires_at, 
            updated_at=excluded.updated_at
        `).run(username, titleText, new Date().toISOString(), expiresAt);
      } catch (e) {}

      try {
        await sendWsQuery('command_request', {
          command: `/title set "${username}" "${titleText}"`,
          admin_username: 'LuckyDraw'
        }, 1500);
      } catch (wsErr) {}

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
        await sendWsQuery('give_money', { username, amount }, 1500);
      } catch (wsErr) {
        try {
          db.prepare(`
            INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, status)
            VALUES ('system', 'System LuckyDraw', ?, 'craftcore:money', ?, 'pending')
          `).run(username, amount);
        } catch (e) {}
      }
    } else {
      try {
        await sendWsQuery('luckydraw_response', {
          username,
          item: prize.id,
          amount,
          keysCount: newKeys,
          success: true,
          message: `🎉 幸運大抽獎獲得 ${prize.name}！`
        }, 1500);
      } catch (wsErr) {
        try {
          db.prepare(`
            INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, status)
            VALUES ('system', 'System LuckyDraw', ?, ?, ?, 'pending')
          `).run(username, prize.id, amount);
        } catch (e) {}
      }
    }

    return res.json({
      success: true,
      prize,
      remaining_keys: newKeys,
      message: `🎉 抽獎成功！恭喜獲得 ${prize.name} x${prize.count}！`
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/user/buy-key-with-money - Purchase lottery keys
router.post('/user/buy-key-with-money', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;
  const rawCount = req.body.count;
  const count = Number(rawCount);

  if (!Number.isInteger(count) || count < 1) {
    return res.status(400).json({ success: false, message: '購買數量必須為 1 以上的正整數！' });
  }
  const costPerKey = 500;
  const totalCost = count * costPerKey;

  if (!db) return res.status(500).json({ success: false, message: '資料庫連線不可用' });

  // 1. Atomically check & deduct money from economy.json
  const cleanUsername = (username || '').replace(/^\./, '').toLowerCase();
  const ecoMap = loadConfigJson<Record<string, any>>('economy.json') || {};
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
  saveConfigJson('economy.json', ecoMap);

  // 2. Update SQLite bindings keys_count & sync economy.json lotteryKeys
  let newKeys = count;
  try {
    const userDiscordId = user.discord_id || '';
    const userUuid = user.mc_uuid || '';
    const row = db.prepare(`
      SELECT id, keys_count FROM bindings
      WHERE lower(replace(mc_username, '.', '')) = ?
         OR (discord_id IS NOT NULL AND discord_id != '' AND discord_id = ?)
         OR (mc_uuid IS NOT NULL AND mc_uuid != '' AND mc_uuid = ?)
    `).get(cleanUsername, userDiscordId, userUuid) as any;
    const currentKeys = Math.max(0, row?.keys_count || 0);
    newKeys = currentKeys + count;

    if (!row) {
      db.prepare('INSERT INTO bindings (discord_id, mc_uuid, mc_username, keys_count) VALUES (?, ?, ?, ?)').run(
        user.discord_id || 'system',
        user.mc_uuid || `dev-uuid-${cleanUsername}`,
        username,
        newKeys
      );
    } else {
      db.prepare('UPDATE bindings SET keys_count = ? WHERE id = ?').run(newKeys, row.id);
    }

    // Also update lotteryKeys in economy.json
    ecoMap[ecoKey].lotteryKeys = newKeys;
    saveConfigJson('economy.json', ecoMap);
  } catch (error: any) {
    console.error('[Buy Key Error]', error);
  }

  // Notify Fabric mod via WS
  try {
    await sendWsQuery('player_balance_update', { username, balance: newBalance }, 1000);
    await sendWsQuery('player_keys_update', { username, keys: newKeys }, 1000);
    await sendWsQuery('reload_config', { target: 'economy' }, 1000);
  } catch (e) {}

  return res.json({
    success: true,
    message: `成功購買 ${count} 把鑰匙！`,
    keys_count: newKeys
  });
});

// POST /api/user/reminder-subscription - Toggle check-in reminder
router.post('/user/reminder-subscription', authenticateToken, (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  if (!db) return res.status(500).json({ success: false, message: '資料庫連線不可用' });

  try {
    const row = db.prepare('SELECT subscribe_reminder FROM bindings WHERE mc_username = ? COLLATE NOCASE').get(username) as any;
    const currentSub = row?.subscribe_reminder || 0;
    const newSub = currentSub === 1 ? 0 : 1;

    db.prepare('UPDATE bindings SET subscribe_reminder = ? WHERE mc_username = ? COLLATE NOCASE').run(newSub, username);

    return res.json({
      success: true,
      subscribed: newSub === 1,
      message: newSub === 1 ? '已開啟每日簽到提醒 Notification' : '已關閉每日簽到提醒'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/user/upgrade
router.post('/user/upgrade', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  try {
    const response = await sendWsQuery('shop_action', {
      action: 'upgrade',
      username
    });
    return res.json({ success: response.success, message: response.message });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/user/fakeplayers
router.get('/user/fakeplayers', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  const cacheKey = `cache:fakeplayers:${user.mc_username.toLowerCase()}`;
  const cached = getCachedData<any[]>(cacheKey);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return res.json({ success: true, fakeplayers: cached, cached: true });
  }

  try {
    const response = await sendWsQuery('fake_players_query', { username: user.mc_username }, 2000);
    const rawList = Array.isArray(response?.entries) ? response.entries : (Array.isArray(response?.fakeplayers) ? response.fakeplayers : []);
    if (response && response.success && rawList.length >= 0) {
      const myBots = rawList.filter((b: any) => {
        const ownerName = typeof b.owner === 'object' && b.owner !== null ? (b.owner.owner || b.owner.username || '') : String(b.owner || '');
        return ownerName.toLowerCase() === user.mc_username.toLowerCase() || String(b.owner || '').toLowerCase() === user.mc_username.toLowerCase();
      }).map((b: any) => ({
        name: b.name || b.botName,
        owner: user.mc_username,
        online: Boolean(b.online || b.isOnline)
      }));
      setCachedData(cacheKey, myBots, 3000);
      return res.json({ success: true, fakeplayers: myBots });
    }
  } catch (error: any) {
    console.warn('[FakePlayers Route] WebSocket query failed, falling back to local file');
  }

  try {
    const map = loadConfigJson<Record<string, any>>('fake_players.json');
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
      setCachedData(cacheKey, myBots, 2000);
      return res.json({ success: true, fakeplayers: myBots });
    }
  } catch (fsErr) {}
  return res.json({ success: true, fakeplayers: [] });
});

// POST /api/user/fakeplayers/action
router.post('/user/fakeplayers/action', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  const { botName, action } = req.body;
  if (!botName || typeof action !== 'string') {
    return res.status(400).json({ success: false, message: '請提供有效的假人名稱與動作' });
  }

  if (action === 'spawn' || action === '') {
    try {
      const statusRes = await sendWsQuery('player_status_query', { username: user.mc_username });
      if (!statusRes || !statusRes.online) {
        return res.status(400).json({ success: false, message: '您必須在遊戲內線上才能召喚假人！' });
      }
    } catch (e: any) {
      return res.status(500).json({ success: false, message: '無法確認您的線上狀態' });
    }
  }

  try {
    const fullCmd = action.trim() ? `/fp ${botName} ${action}` : `/fp ${botName}`;
    const response = await sendWsQuery('command_request', { command: fullCmd });
    invalidateCachePattern('cache:fakeplayers');
    return res.json({ success: response.success, message: response.output || '指令已送出' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/user/homes
router.get('/user/homes', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  try {
    const response = await sendWsQuery('homes_query', { username: user.mc_username });
    if (response && response.success) {
      return res.json({ success: true, homes: response.homes || [] });
    }
  } catch (error: any) {
    console.warn('[Homes Route] WebSocket query failed, falling back to local file');
  }

  try {
    const map = loadConfigJson<Record<string, any>>('homes.json');
    if (map && typeof map === 'object' && map[user.mc_username]) {
      const userHomes = map[user.mc_username];
      const homesList = Array.isArray(userHomes) ? userHomes : Object.values(userHomes);
      return res.json({ success: true, homes: homesList });
    }
  } catch (e) {}

  return res.json({ success: true, homes: [] });
});

// DELETE /api/user/homes/:name
router.delete('/user/homes/:name', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  const name = req.params.name;
  try {
    const response = await sendWsQuery('teleport_update', {
      type: 'home',
      username: user.mc_username,
      name: name,
      action: 'delete'
    });
    return res.json({ success: response.success, message: response.message });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/lockboxes
router.get('/lockboxes', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  try {
    const response = await sendWsQuery('lockboxes_query', {});
    const allLockboxes = response.lockboxes || [];
    const myLockboxes = allLockboxes.filter((l: any) => l.owner.toLowerCase() === username.toLowerCase());
    return res.json({ success: true, lockboxes: myLockboxes });
  } catch (error: any) {
    try {
      const lockboxMap = loadConfigJson<Record<string, any>>('lockboxes.json');
      if (lockboxMap && typeof lockboxMap === 'object') {
        const lockboxArray = Object.values(lockboxMap)
          .filter((l: any) => (l as any).owner.toLowerCase() === username.toLowerCase())
          .map((l: any) => ({
            id: l.id,
            location: l.location,
            owner: l.owner,
            authorized: l.authorized || []
          }));
        return res.json({ success: true, lockboxes: lockboxArray });
      }
    } catch (fsErr) {}
    res.json({ success: true, lockboxes: [] });
  }
});

// POST /api/lockboxes/update
router.post('/lockboxes/update', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;
  const { lockboxId, action, targetPlayer, newPassword } = req.body;

  if (!lockboxId || !action) {
    return res.status(400).json({ success: false, message: '缺少必要參數' });
  }

  try {
    const response = await sendWsQuery('lockboxes_action', {
      username,
      lockboxId,
      action,
      targetPlayer,
      newPassword
    });
    return res.json({ success: response.success, message: response.message });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/tasks/daily & GET /api/user/daily-tasks
const handleGetDailyTasks = async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let username: string | null = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      username = decoded.mc_username;
    } catch (err) {}
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
    const response = await sendWsQuery('daily_tasks_query', { username });
    if (response && response.success) {
      const responseTasks = Array.isArray(response.tasks) ? response.tasks : [];
      const slay_task = responseTasks.find((t: any) => t.type === 1) || response.slay_task;
      const mine_task = responseTasks.find((t: any) => t.type === 2) || response.mine_task;

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
  } catch (error: any) {}

  // Fallback: Read directly from economy.json
  const ecoMap = loadConfigJson<Record<string, any>>('economy.json') || {};
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
const handleClaimDailyTask = async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  try {
    const response = await sendWsQuery('claim_daily_reward', { username });
    return res.json({ success: response.success, message: response.message });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

router.post('/tasks/claim', authenticateToken, handleClaimDailyTask);
router.post('/user/claim-daily-task', authenticateToken, handleClaimDailyTask);

// POST /api/playtime/exchange & /api/user/exchange-playtime
const handlePlaytimeExchange = async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;
  const { mode } = req.body;

  try {
    const response = await sendWsQuery('playtime_exchange', { username, mode: mode || 'single' });
    if (response && response.success && response.keys_added > 0 && db) {
      try {
        const cleanUsername = (username || '').replace(/^\./, '').toLowerCase();
        const row = db.prepare(`
          SELECT id, keys_count FROM bindings
          WHERE lower(replace(mc_username, '.', '')) = ?
             OR (discord_id IS NOT NULL AND discord_id != '' AND discord_id = ?)
        `).get(cleanUsername, user.discord_id || '') as any;
        if (row) {
          db.prepare('UPDATE bindings SET keys_count = keys_count + ? WHERE id = ?').run(response.keys_added, row.id);
        }
      } catch (err) {
        console.error('[Playtime Exchange DB Sync Error]', err);
      }
    }
    return res.json({ success: true, message: response.message, keys_added: response.keys_added || 0 });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

router.post('/playtime/exchange', authenticateToken, handlePlaytimeExchange);
router.post('/user/exchange-playtime', authenticateToken, handlePlaytimeExchange);

// GET /api/warp-submissions & GET /api/admin/warp-submissions
const handleGetWarpSubmissions = (req: Request, res: Response) => {
  let submissions: any[] = [];
  if (db) {
    try {
      const rows = db.prepare('SELECT * FROM warp_submissions ORDER BY id DESC').all();
      if (rows) submissions = rows;
    } catch (e) {}
  }
  return res.json({ success: true, submissions });
};

router.get('/warp-submissions', handleGetWarpSubmissions);
router.get('/admin/warp-submissions', handleGetWarpSubmissions);

// POST /api/warp-submissions & POST /api/user/submit-warp
const handleSubmitWarp = (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  const { facility_name, function_desc, coords, dimension } = req.body;
  if (!facility_name || !coords) {
    return res.status(400).json({ success: false, message: '缺少地標名稱或座標' });
  }

  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO warp_submissions (applicant_username, applicant_discord_id, facility_name, function_desc, coords, dimension)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(user.mc_username, user.discord_id || null, facility_name, function_desc || '', coords, dimension || 'minecraft:overworld');
      return res.json({ success: true, message: '公用設施傳送點申請已送出！' });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.json({ success: true, message: '公用設施傳送點申請已送出！' });
};

router.post('/warp-submissions', authenticateToken, handleSubmitWarp);
router.post('/user/submit-warp', authenticateToken, handleSubmitWarp);

// GET /api/warps & GET /api/public/warps - Public landmark warps
const handleGetWarps = async (req: Request, res: Response) => {
  const cached = getCachedData<any>('warps_cache');
  if (cached) return res.json(cached);

  let rawList: any[] = [];
  const warpsConfig = loadConfigJson<any>('warps.json');
  if (Array.isArray(warpsConfig)) {
    rawList = warpsConfig;
  } else if (warpsConfig && typeof warpsConfig === 'object') {
    rawList = Object.entries(warpsConfig).map(([key, val]: [string, any]) => {
      let name = key;
      let coords = '';
      let dimension = 'minecraft:overworld';
      let owner = undefined;
      let type = undefined;

      if (typeof val === 'string') {
        coords = val;
      } else if (typeof val === 'object' && val !== null) {
        name = val.name || key;
        owner = val.owner;
        type = val.type;
        dimension = val.dimension || val.world || val.dimensionName || 'minecraft:overworld';
        if (val.coords) {
          coords = val.coords;
        } else if (val.location) {
          coords = val.location;
        } else if (val.x !== undefined && val.y !== undefined && val.z !== undefined) {
          coords = `${Math.floor(val.x)}, ${Math.floor(val.y)}, ${Math.floor(val.z)}`;
        }
      }
      return { name, coords, dimension, owner, type };
    });
  }

  const warps = rawList.map(w => {
    let rawDim = String(w.dimension || 'minecraft:overworld').toLowerCase();
    let dimDisplay = '主世界';
    if (rawDim.includes('nether')) dimDisplay = '地獄';
    else if (rawDim.includes('end')) dimDisplay = '終界';

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
  setCachedData('warps_cache', result, 5000);
  return res.json(result);
};

router.get('/warps', handleGetWarps);
router.get('/public/warps', handleGetWarps);

// DELETE /api/warps/:name & /api/user/warps/:name
const handleDeleteWarp = async (req: CustomRequest, res: Response) => {
  const { name } = req.params;
  const user = req.user;
  if (!name) return res.status(400).json({ success: false, message: '缺少地標名稱' });

  try {
    let warpsMap = loadConfigJson<Record<string, any>>('warps.json') || {};
    let foundKey = Object.keys(warpsMap).find(k => k.toLowerCase() === name.toLowerCase());

    if (foundKey) {
      delete warpsMap[foundKey];
      saveConfigJson('warps.json', warpsMap);
      invalidateCachePattern('warps_cache');
    }

    try {
      await sendWsQuery('command_request', {
        command: `/warp remove "${name}"`,
        admin_username: user?.mc_username || 'Web-Dashboard'
      }, 3000);
    } catch (wsErr) {}

    return res.json({ success: true, message: `已成功刪除地標：「${name}」！` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

router.delete('/warps/:name', authenticateToken, handleDeleteWarp);
router.delete('/user/warps/:name', authenticateToken, handleDeleteWarp);

export default router;
