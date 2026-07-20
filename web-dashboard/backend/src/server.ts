import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import WebSocket, { WebSocketServer } from 'ws';
// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import http from 'http';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_99881122';
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:8080';
const WEBSOCKET_SECRET = process.env.WEBSOCKET_SECRET || 'c34fc25b90a6ea1d38e2bc79679fbc9d';
const DATABASE_PATH = process.env.DATABASE_PATH ? path.resolve(__dirname, process.env.DATABASE_PATH) : path.resolve(__dirname, '../../../discord-bot/src/database/database.db');

// Setup Shared Database Connection
let db: DatabaseSync | null = null;
try {
  if (fs.existsSync(DATABASE_PATH)) {
    db = new DatabaseSync(DATABASE_PATH);
    console.log(`Connected to shared SQLite database at: ${DATABASE_PATH}`);
  } else {
    console.warn(`Database not found at ${DATABASE_PATH}, will fallback to memory DB for tests/mocking`);
    db = new DatabaseSync(':memory:');
    db.exec(`
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

  if (db) {
    db.exec(`
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
  }
} catch (error) {
  console.error('Failed to initialize database connection', error);
}

// -------------------------------------------------------------
// Live Memory Statistics & Trade Logs (Phase 4-5 Stats Engine)
// -------------------------------------------------------------
let accumulatedSalesTax = 0;
if (db) {
  try {
    const row = db.prepare('SELECT SUM(tax_deducted) as total FROM transactions').get() as any;
    accumulatedSalesTax = row?.total || 0;
  } catch (e) {
    accumulatedSalesTax = 0;
  }
}
let totalShopsCount = 0;

// -------------------------------------------------------------
// WebSocket RPC Client (Bridge Link to Discord Bot)
// -------------------------------------------------------------
let botWsClient: WebSocket | null = null;
const pendingQueries = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();

function connectToBotWS() {
  console.log(`Connecting to Discord Bot WS at: ${WEBSOCKET_URL}`);
  botWsClient = new WebSocket(WEBSOCKET_URL);

  botWsClient.on('open', () => {
    console.log('Connected to Discord Bot WS. Authenticating...');
    botWsClient?.send(JSON.stringify({
      type: 'auth',
      payload: {
        secret: WEBSOCKET_SECRET,
        role: 'web-dashboard'
      }
    }));
  });

  botWsClient.on('message', (data) => {
    try {
      const packet = JSON.parse(data.toString());
      const { type, payload } = packet;

      // Handle query resolve
      if (type.endsWith('_response') || type === 'error_response') {
        const queryId = payload?.query_id || payload?.command_id;
        if (queryId && pendingQueries.has(queryId)) {
          const pending = pendingQueries.get(queryId);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingQueries.delete(queryId);
            if (type === 'error_response') {
              pending.reject(new Error(payload.message || 'Query failed'));
            } else {
              pending.resolve(payload);
            }
          }
        }
      }

      // Handle real-time transaction log broadcast
      if (type === 'transaction_log') {
        const log = payload;
        accumulatedSalesTax += log.tax_deducted || 0;

        if (db) {
          try {
            const insertTx = db.prepare('INSERT INTO transactions (shop_coords, buyer, seller, item, quantity, unit_price, tax_deducted, net_profit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            insertTx.run(log.shop_coords || log.coords || '', log.buyer, log.seller, log.item, log.quantity, log.unit_price, log.tax_deducted || 0, log.net_profit || 0);
          } catch (dbErr) {
            console.error('Failed to save transaction log to database:', dbErr);
          }
        }

        // Broadcast to all connected web frontend instances
        broadcastToWebClients({
          type: 'transaction_log',
          payload: log
        });
      }
    } catch (err) {
      console.error('Error parsing packet from Discord Bot WS', err);
    }
  });

  botWsClient.on('close', () => {
    console.warn('Discord Bot WS connection lost. Reconnecting in 3 seconds...');
    setTimeout(connectToBotWS, 3000);
  });

  botWsClient.on('error', (err) => {
    console.error('Discord Bot WS connection error:', err.message);
  });
}

connectToBotWS();

// Helper to send query over WS to Minecraft via Bot bridge
function sendWsQuery(type: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!botWsClient || botWsClient.readyState !== WebSocket.OPEN) {
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
    }, 15000);

    pendingQueries.set(queryId, { resolve, reject, timeout });

    botWsClient.send(JSON.stringify({
      type,
      payload
    }));
  });
}

// -------------------------------------------------------------
// Express Server Setup & Middlewares
// -------------------------------------------------------------
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// JWT Authentication Middleware
interface CustomRequest extends Request {
  user?: {
    mc_uuid: string;
    mc_username: string;
    discord_id?: string;
    roles?: string[];
    profile?: {
      roles?: string[];
      isAdmin?: boolean;
    };
  };
}

function authenticateToken(req: CustomRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: '尚未登入，請先進行身份驗證' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: '認證憑證無效或已過期' });
    }
    req.user = decoded as CustomRequest['user'];
    next();
  });
}

function requireAdmin(req: CustomRequest, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: '尚未登入，請先進行身份驗證' });
  }

  const targetId = '1248891236480188517';
  if (user.discord_id !== targetId) {
    return res.status(403).json({ success: false, message: 'Forbidden: 您不是系統管理員' });
  }
  next();
}

// -------------------------------------------------------------
// Auth Routes & Dev Mode Bypass
// -------------------------------------------------------------

// Developer Mock login bypass endpoint
app.get('/api/auth/dev-login', (req: Request, res: Response) => {
  const username = (req.query.username as string) || 'Yanggu';
  const nonAdmin = req.query.nonAdmin === 'true';
  const roles = nonAdmin ? [] : ['1360409328175153242'];

  if (!db) {
    return res.status(500).json({ success: false, message: '資料庫未連接' });
  }

  try {
    const getBinding = db.prepare('SELECT * FROM bindings WHERE mc_username = ? COLLATE NOCASE');
    const binding = getBinding.get(username) as any;

    if (!binding) {
      // If no binding exists for mock, create a dummy link for developers to test
      const dummyDiscordId = `dev-discord-${Math.floor(Math.random() * 10000)}`;
      const dummyUuid = `dev-uuid-${Math.floor(Math.random() * 10000)}`;
      const addBinding = db.prepare('INSERT INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)');
      addBinding.run(dummyDiscordId, dummyUuid, username);
      
      const token = jwt.sign({ 
        mc_uuid: dummyUuid, 
        mc_username: username, 
        discord_id: nonAdmin ? dummyDiscordId : '1248891236480188517',
        roles,
        profile: {
          roles,
          isAdmin: !nonAdmin
        }
      }, JWT_SECRET, { expiresIn: '7d' });
      
      return res.json({
        success: true,
        message: '開發者模式建立全新測試綁定登入',
        token,
        user: { mc_username: username, mc_uuid: dummyUuid }
      });
    }

    const token = jwt.sign({ 
      mc_uuid: binding.mc_uuid, 
      mc_username: binding.mc_username, 
      discord_id: nonAdmin ? binding.discord_id : '1248891236480188517',
      roles,
      profile: {
        roles,
        isAdmin: !nonAdmin
      }
    }, JWT_SECRET, { expiresIn: '7d' });
    
    return res.json({
      success: true,
      message: '開發者模式成功登入',
      token,
      user: { mc_username: binding.mc_username, mc_uuid: binding.mc_uuid }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// OAuth Callback mock redirector
app.get('/api/auth/url', (req: Request, res: Response) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/callback');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
  res.json({ url });
});

app.get('/api/auth/callback', async (req: Request, res: Response) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  if (!db) {
    return res.status(500).send('Database connection unavailable');
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    // 1. Exchange OAuth code for access token from Discord API
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || '',
        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: process.env.DISCORD_REDIRECT_URI || '',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Discord OAuth] Token exchange failed:', errorText);
      return res.redirect(`${frontendUrl}/?error=token_exchange_failed`);
    }

    const tokenData = (await tokenResponse.json()) as any;
    const accessToken = tokenData.access_token;

    // 2. Fetch user profile information from Discord API
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      console.error('[Discord OAuth] Failed to fetch user profile');
      return res.redirect(`${frontendUrl}/?error=user_fetch_failed`);
    }

    const userData = (await userResponse.json()) as any;
    const realDiscordId = userData.id;

    // 3. Search for Minecraft binding by real Discord User ID
    const getBinding = db.prepare('SELECT * FROM bindings WHERE discord_id = ?');
    const binding = getBinding.get(realDiscordId) as any;

    if (!binding) {
      console.warn(`[Discord OAuth] Discord User ${userData.username}#${userData.discriminator} (${realDiscordId}) is not bound in database.`);
      // Redirect back with details so frontend can show helpful information
      return res.redirect(`${frontendUrl}/?error=not_bound&discord_id=${realDiscordId}&discord_username=${encodeURIComponent(userData.username)}`);
    }

    // 4. Generate local JWT token for dashboard authentication
    const roles: string[] = [];
    const isAdmin = realDiscordId === '1248891236480188517';

    const token = jwt.sign(
      { 
        mc_uuid: binding.mc_uuid, 
        mc_username: binding.mc_username, 
        discord_id: realDiscordId,
        roles,
        profile: {
          roles,
          isAdmin
        }
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(`${frontendUrl}/?token=${token}&username=${binding.mc_username}&uuid=${binding.mc_uuid}`);
  } catch (err: any) {
    console.error('[Discord OAuth] Callback error:', err);
    res.status(500).send(err.message);
  }
});

// -------------------------------------------------------------
// Core Business endpoints
// -------------------------------------------------------------

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
  { type: 1, target: 'Creeper', count: 5, reward: 400 }
];

const MINE_POOL = [
  { type: 2, target: 'Coal Ore', count: 20, reward: 200 },
  { type: 2, target: 'Iron Ore', count: 10, reward: 300 },
  { type: 2, target: 'Diamond Ore', count: 3, reward: 1000 }
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

// 0. Daily Tasks Progress
app.get('/api/tasks/daily', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let username: string | null = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      username = decoded.mc_username;
    } catch (err) {
      // Ignore token verification errors, treat as anonymous
    }
  }

  const dateStr = getTaipeiDateString();

  if (username) {
    try {
      const response = await sendWsQuery('daily_tasks_query', { username });
      return res.json({
        success: true,
        tasks: response.tasks,
        date: response.date
      });
    } catch (error: any) {
      const tasks = getDailyTasksFallback(dateStr);
      return res.json({
        success: true,
        tasks: tasks.map(t => ({ ...t, progress: 0 })),
        date: dateStr,
        offline: true
      });
    }
  } else {
    const tasks = getDailyTasksFallback(dateStr);
    return res.json({
      success: true,
      tasks: tasks.map(t => ({ ...t, progress: 0 })),
      date: dateStr
    });
  }
});

// 1. Server Global Stats
app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    // Dynamically retrieve top 100 players from mod to calculate circulating economy
    const richRes = await sendWsQuery('rich_list_query', { limit: 100 });
    const richList = richRes.players || [];
    const totalCirculation = richList.reduce((sum: number, player: any) => sum + (player.balance || 0), 0);

    res.json({
      success: true,
      stats: {
        totalCirculation,
        accumulatedSalesTax,
        totalShopsCount
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Leaderboard Endpoint
app.get('/api/leaderboard', async (req: Request, res: Response) => {
  try {
    const response = await sendWsQuery('rich_list_query', { limit: 100 });
    const leaderboard = response.players || [];
    res.json({ success: true, leaderboard });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Shop Explorer Grid List
app.get('/api/shops', async (req: Request, res: Response) => {
  try {
    // Query Minecraft Server Chest Shop Registry
    const response = await sendWsQuery('shop_stats_query', { username: '*' });
    const shops = response.shops || [];
    totalShopsCount = shops.length;
    res.json({ success: true, shops });
  } catch (error: any) {
    // If gameserver is offline, return empty registry list
    res.json({
      success: true,
      shops: []
    });
  }
});

// 4. Market Prices History Charts
app.get('/api/market/analytics', (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.json({
        success: true,
        analytics: {
          'minecraft:diamond': [],
          'minecraft:netherite_ingot': [],
          'minecraft:iron_ingot': []
        }
      });
    }

    // Query aggregated transaction data for past trade history
    const getLogs = db.prepare(`
      SELECT 
        item,
        strftime('%m/%d', timestamp, 'localtime') as date,
        AVG(unit_price) as price,
        SUM(quantity) as volume
      FROM transactions
      GROUP BY item, date
      ORDER BY date ASC
    `);
    const rows = getLogs.all() as any[];

    // Group by item key
    const analytics: Record<string, any[]> = {
      'minecraft:diamond': [],
      'minecraft:netherite_ingot': [],
      'minecraft:iron_ingot': []
    };
    for (const row of rows) {
      // Normalize item key
      const item = row.item.startsWith('minecraft:') ? row.item : `minecraft:${row.item}`;
      if (!analytics[item]) {
        analytics[item] = [];
      }
      analytics[item].push({
        date: row.date,
        price: Math.round(row.price * 10) / 10,
        volume: row.volume
      });
    }

    res.json({ success: true, analytics });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4b. Recent Real-time Trade Logs
app.get('/api/market/recent', (req: Request, res: Response) => {
  if (!db) return res.json({ success: true, trades: [] });
  try {
    const getRecent = db.prepare('SELECT timestamp, buyer, seller, item, quantity, net_profit FROM transactions ORDER BY timestamp DESC LIMIT 10');
    const rows = getRecent.all() as any[];
    const trades = rows.map((row) => {
      const dateObj = new Date(row.timestamp);
      // Format as HH:MM
      const time = dateObj.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
      return {
        time,
        buyer: row.buyer,
        seller: row.seller,
        item: row.item.replace('minecraft:', '').toUpperCase(),
        quantity: row.quantity,
        profit: row.net_profit
      };
    });
    res.json({ success: true, trades });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. User Personal Profile & Balance Info (Integrates check-in stats & keys)
app.get('/api/user/profile', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  let balance = 1000.0; // Default mock fallback
  try {
    const response = await sendWsQuery('balance_query', { username: user.mc_username });
    if (response && typeof response.balance === 'number') {
      balance = response.balance;
    }
  } catch (error: any) {
    console.warn('[Profile API] Failed to fetch live balance via WS:', error.message);
  }

  let online = false;
  let coords = "離線";
  let tps = 20.0;
  try {
    const response = await sendWsQuery('player_status_query', { username: user.mc_username });
    if (response && response.success) {
      online = response.online;
      coords = response.coords;
      tps = response.tps;
    }
  } catch (error: any) {
    console.warn('[Profile API] Failed to fetch player status via WS:', error.message);
  }

  let dbStats = {
    keys_count: 0,
    checkin_streak: 0,
    total_checkins: 0,
    last_checkin: null,
    subscribe_reminder: 0
  };

  if (db) {
    try {
      const getBinding = db.prepare('SELECT keys_count, checkin_streak, total_checkins, last_checkin, subscribe_reminder FROM bindings WHERE mc_username = ? COLLATE NOCASE');
      const binding = getBinding.get(user.mc_username) as any;
      if (binding) {
        dbStats = {
          keys_count: binding.keys_count || 0,
          checkin_streak: binding.checkin_streak || 0,
          total_checkins: binding.total_checkins || 0,
          last_checkin: binding.last_checkin || null,
          subscribe_reminder: binding.subscribe_reminder || 0
        };
      }
    } catch (dbErr) {
      console.error('[Profile API] Database query failed:', dbErr);
    }
  }

  const isAdmin = user.discord_id === '1248891236480188517';

  res.json({
    success: true,
    user: {
      mc_username: user.mc_username,
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

// 5b. User Mailbox & Pending Courier Packages
app.get('/api/user/mails', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  if (!db) {
    return res.status(500).json({ success: false, message: '資料庫連結不可用' });
  }

  try {
    const getMails = db.prepare(`
      SELECT * FROM offline_mails 
      WHERE receiver_username = ? COLLATE NOCASE OR sender_username = ? COLLATE NOCASE 
      ORDER BY created_at DESC
    `);
    const mails = getMails.all(user.mc_username, user.mc_username);
    res.json({ success: true, mails });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Welfare endpoints (Milestone 3)
app.post('/api/user/checkin', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  if (!db) return res.status(500).json({ success: false, message: '資料庫連線不可用' });

  const username = user.mc_username;

  try {
    const getBinding = db.prepare('SELECT * FROM bindings WHERE mc_username = ? COLLATE NOCASE');
    const binding = getBinding.get(username) as any;
    if (!binding) {
      return res.status(400).json({ success: false, message: '找不到玩家綁定資訊' });
    }

    const discordId = binding.discord_id;
    const todayStr = getTaipeiDateString();
    const yesterdayStr = getTaipeiYesterdayDateString();

    const lastCheckin = binding.last_checkin;
    const checkinStreak = binding.checkin_streak || 0;
    const totalCheckins = binding.total_checkins || 0;
    const keysCount = binding.keys_count || 0;

    if (lastCheckin === todayStr) {
      return res.status(400).json({ success: false, message: '📅 您今天已經簽到過囉！請明天再來。' });
    }

    let newStreak = (lastCheckin === yesterdayStr) ? (checkinStreak + 1) : 1;
    let keysAwarded = 1;
    if (newStreak === 7) {
      keysAwarded = 3;
    } else if (newStreak > 7) {
      newStreak = 1;
      keysAwarded = 1;
    }

    const newKeysCount = keysCount + keysAwarded;
    const newTotalCheckins = totalCheckins + 1;

    const updateCheckin = db.prepare('UPDATE bindings SET last_checkin = ?, checkin_streak = ?, total_checkins = ?, keys_count = ? WHERE mc_username = ? COLLATE NOCASE');
    updateCheckin.run(todayStr, newStreak, newTotalCheckins, newKeysCount, username);

    try {
      if (botWsClient && botWsClient.readyState === WebSocket.OPEN) {
        botWsClient.send(JSON.stringify({
          type: 'player_keys_update',
          payload: {
            username: username,
            keys: newKeysCount
          }
        }));
      }
    } catch (wsErr) {
      console.warn('Failed to send player_keys_update over WS:', wsErr);
    }

    let online = false;
    try {
      const statusRes = await sendWsQuery('player_status_query', { username });
      if (statusRes && statusRes.success) {
        online = statusRes.online;
      }
    } catch (err) {
      // Treat as offline
    }

    const items = ['minecraft:bread', 'minecraft:cookie', 'minecraft:coal', 'minecraft:iron_ingot'];
    const randomItem = items[Math.floor(Math.random() * items.length)];
    const itemDisplayName = randomItem.replace('minecraft:', '').toUpperCase();

    if (online) {
      try {
        await sendWsQuery('command_request', { command: `/addmoney ${username} 150`, admin_username: 'Web-Dashboard' });
        await sendWsQuery('command_request', { command: `/give ${username} ${randomItem} 1`, admin_username: 'Web-Dashboard' });
        await sendWsQuery('command_request', { command: `/playsound minecraft:entity.player.levelup master ${username}`, admin_username: 'Web-Dashboard' });
        await sendWsQuery('command_request', { command: `/title ${username} title {"text":"📅 簽到成功！","color":"green"}`, admin_username: 'Web-Dashboard' });
        await sendWsQuery('command_request', { command: `/title ${username} subtitle {"text":"獲得 $150 與 1x ${itemDisplayName}","color":"gold"}`, admin_username: 'Web-Dashboard' });
      } catch (cmdErr: any) {
        console.error('Failed to run in-game checkin commands:', cmdErr.message);
      }
    } else {
      const insertMail = db.prepare(`
        INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, nbt, status)
        VALUES ('System', 'System', ?, ?, ?, ?, 'pending')
      `);
      insertMail.run(username, 'craftcore:money', 150, null);
      insertMail.run(username, randomItem, 1, null);
    }

    return res.json({
      success: true,
      message: `簽到成功！獲得 ${keysAwarded} 把鑰匙`,
      checkin_streak: newStreak,
      total_checkins: newTotalCheckins,
      keys_count: newKeysCount,
      last_checkin: todayStr
    });

  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/user/reminder-subscription', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  if (!db) return res.status(500).json({ success: false, message: '資料庫連線不可用' });

  const { subscribe } = req.body;
  if (typeof subscribe !== 'boolean') {
    return res.status(400).json({ success: false, message: '缺少或無效的訂閱狀態' });
  }

  try {
    const statusVal = subscribe ? 1 : 0;
    const updateStmt = db.prepare('UPDATE bindings SET subscribe_reminder = ? WHERE mc_username = ? COLLATE NOCASE');
    updateStmt.run(statusVal, user.mc_username);

    return res.json({ success: true, message: subscribe ? '已開啟每日簽到提醒' : '已關閉每日簽到提醒', subscribe });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/user/luckydraw', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  if (!db) return res.status(500).json({ success: false, message: '資料庫連線不可用' });

  const username = user.mc_username;

  try {
    const binding = db.prepare('SELECT keys_count FROM bindings WHERE mc_username = ? COLLATE NOCASE').get(username) as any;
    if (!binding || (binding.keys_count || 0) < 1) {
      return res.status(400).json({ success: false, message: '鑰匙餘額不足，無法進行抽獎！' });
    }

    const newKeysCount = binding.keys_count - 1;
    db.prepare('UPDATE bindings SET keys_count = ? WHERE mc_username = ? COLLATE NOCASE').run(newKeysCount, username);

    try {
      if (botWsClient && botWsClient.readyState === WebSocket.OPEN) {
        botWsClient.send(JSON.stringify({
          type: 'player_keys_update',
          payload: {
            username: username,
            keys: newKeysCount
          }
        }));
      }
    } catch (wsErr) {
      console.warn('Failed to send player_keys_update over WS:', wsErr);
    }

    const pool = [
      { id: 'minecraft:diamond', amount: 5, name: '鑽石 x 5' },
      { id: 'minecraft:golden_carrot', amount: 5, name: '金胡蘿蔔 x 5' },
      { id: 'minecraft:golden_apple', amount: 5, name: '金蘋果 x 5' },
      { id: 'minecraft:experience_bottle', amount: 64, name: '經驗瓶 x 64' },
      { id: 'minecraft:totem_of_undying', amount: 1, name: '不死圖騰 x 1' },
      { id: 'craftcore:money', amount: 0, name: '遊戲金幣' }
    ];

    const prize = pool[Math.floor(Math.random() * pool.length)];

    let prizeName = prize.name;
    let prizeId = prize.id;
    let prizeAmount = prize.amount;

    if (prize.id === 'craftcore:money') {
      const extraMoney = Math.floor(Math.random() * 150) + 50;
      prizeAmount = 150 + extraMoney;
      prizeName = `$${prizeAmount} 遊戲幣`;
    }

    let online = false;
    try {
      const statusRes = await sendWsQuery('player_status_query', { username });
      if (statusRes && statusRes.success) {
        online = statusRes.online;
      }
    } catch (err) {
      // Treat as offline
    }

    if (online) {
      try {
        if (prizeId === 'craftcore:money') {
          await sendWsQuery('command_request', { command: `/addmoney ${username} ${prizeAmount}`, admin_username: 'Web-Dashboard' });
        } else {
          await sendWsQuery('command_request', { command: `/give ${username} ${prizeId} ${prizeAmount}`, admin_username: 'Web-Dashboard' });
        }
        await sendWsQuery('command_request', { command: `/playsound minecraft:entity.player.levelup master ${username}`, admin_username: 'Web-Dashboard' });
        await sendWsQuery('command_request', { command: `/title ${username} title {"text":"🎉 抽獎成功！","color":"yellow"}`, admin_username: 'Web-Dashboard' });
        await sendWsQuery('command_request', { command: `/title ${username} subtitle {"text":"獲得了 ${prizeName}","color":"gold"}`, admin_username: 'Web-Dashboard' });
      } catch (cmdErr: any) {
        console.error('Failed to run luckydraw commands:', cmdErr.message);
      }
    } else {
      const insertMail = db.prepare(`
        INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, nbt, status)
        VALUES ('System', 'System', ?, ?, ?, ?, 'pending')
      `);
      insertMail.run(username, prizeId, prizeAmount, null);
    }

    return res.json({
      success: true,
      reward: {
        id: prizeId,
        amount: prizeAmount,
        name: prizeName
      },
      keys_count: newKeysCount
    });

  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/user/exchange-playtime', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  if (!db) return res.status(500).json({ success: false, message: '資料庫連線不可用' });

  const username = user.mc_username;
  const { mode } = req.body;

  if (mode !== 'single' && mode !== 'all') {
    return res.status(400).json({ success: false, message: '無效的兌換模式。' });
  }

  try {
    const binding = db.prepare('SELECT keys_count FROM bindings WHERE mc_username = ? COLLATE NOCASE').get(username) as any;
    if (!binding) {
      return res.status(400).json({ success: false, message: '找不到玩家綁定資訊。' });
    }

    let scoreboardName = 'play_time';
    let getScoreRes = await sendWsQuery('command_request', {
      command: `/scoreboard players get ${username} play_time`,
      admin_username: 'Web-Dashboard'
    });

    if (!getScoreRes || !getScoreRes.success) {
      getScoreRes = await sendWsQuery('command_request', {
        command: `/scoreboard players get ${username} PlayTime`,
        admin_username: 'Web-Dashboard'
      });
      if (getScoreRes && getScoreRes.success) {
        scoreboardName = 'PlayTime';
      }
    }

    if (!getScoreRes || !getScoreRes.success) {
      return res.status(400).json({ success: false, message: '時數兌換失敗！無法取得您的遊戲時數。請確認您在線上。' });
    }

    const output = getScoreRes.output || '';
    const match = output.match(/has (\d+)/) || output.match(/(\d+)/);
    if (!match) {
      return res.status(400).json({ success: false, message: '無法解析遊戲內的時數數值。' });
    }

    const totalTicks = parseInt(match[1], 10);
    const TICK_RATE_PER_KEY = 360000;

    let keysToAdd = 0;
    let ticksToDeduct = 0;

    if (mode === 'single') {
      if (totalTicks < TICK_RATE_PER_KEY) {
        const remainingTicks = TICK_RATE_PER_KEY - totalTicks;
        const remainingHours = (remainingTicks / 72000).toFixed(1);
        return res.status(400).json({
          success: false,
          message: `可用時數不足！兌換 1 把鑰匙需要滿 5 小時，您還差 ${remainingHours} 小時。`
        });
      }
      keysToAdd = 1;
      ticksToDeduct = TICK_RATE_PER_KEY;
    } else {
      keysToAdd = Math.floor(totalTicks / TICK_RATE_PER_KEY);
      if (keysToAdd < 1) {
        const remainingTicks = TICK_RATE_PER_KEY - totalTicks;
        const remainingHours = (remainingTicks / 72000).toFixed(1);
        return res.status(400).json({
          success: false,
          message: `可用時數不足！兌換 1 把鑰匙需要滿 5 小時，您還差 ${remainingHours} 小時。`
        });
      }
      ticksToDeduct = keysToAdd * TICK_RATE_PER_KEY;
    }

    const deductRes = await sendWsQuery('command_request', {
      command: `/scoreboard players remove ${username} ${scoreboardName} ${ticksToDeduct}`,
      admin_username: 'Web-Dashboard'
    });

    if (!deductRes || !deductRes.success) {
      return res.status(500).json({ success: false, message: '遊戲內扣除時數失敗，兌換未完成。' });
    }

    const newKeysCount = (binding.keys_count || 0) + keysToAdd;
    db.prepare('UPDATE bindings SET keys_count = ? WHERE mc_username = ? COLLATE NOCASE').run(newKeysCount, username);

    try {
      if (botWsClient && botWsClient.readyState === WebSocket.OPEN) {
        botWsClient.send(JSON.stringify({
          type: 'player_keys_update',
          payload: {
            username: username,
            keys: newKeysCount
          }
        }));
      }
    } catch (wsErr) {
      console.warn('Failed to send player_keys_update over WS:', wsErr);
    }

    try {
      await sendWsQuery('command_request', {
        command: `/tellraw ${username} {"text":"§b[Craft-Core] §a成功兌換 ${keysToAdd} 把鑰匙！扣除 ${(ticksToDeduct / 72000).toFixed(0)} 小時時數。"}`,
        admin_username: 'Web-Dashboard'
      });
      await sendWsQuery('command_request', {
        command: `/playsound minecraft:entity.player.levelup master ${username}`,
        admin_username: 'Web-Dashboard'
      });
    } catch (ignored) {}

    return res.json({
      success: true,
      message: `成功兌換 ${keysToAdd} 把鑰匙！`,
      keys_count: newKeysCount,
      exchanged_hours: keysToAdd * 5
    });

  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/user/leaderboard', async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ success: false, message: '資料庫連線不可用' });

  try {
    const leaderboardStmt = db.prepare(`
      SELECT mc_username, keys_count, checkin_streak, total_checkins 
      FROM bindings 
      ORDER BY total_checkins DESC, checkin_streak DESC 
      LIMIT 10
    `);
    const leaderboard = leaderboardStmt.all() as any[];

    return res.json({
      success: true,
      leaderboard
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/tasks/claim', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  try {
    const response = await sendWsQuery('daily_task_claim_request', { username: user.mc_username });
    if (response && response.success) {
      res.json({ success: true, message: '成功領取獎勵！' });
    } else {
      res.status(400).json({ success: false, message: response?.message || '領取失敗，任務尚未完成或已領取。' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/user/inventory', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  try {
    const response = await sendWsQuery('player_inventory_query', { username: user.mc_username });
    if (response && response.success) {
      res.json({ success: true, items: response.items });
    } else {
      res.status(400).json({ success: false, message: '查詢背包失敗，請確認您在遊戲線上狀態。' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/mail/send', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  const { receiver, type, amount, slot, itemId, quantity, nbt } = req.body;
  if (!receiver) return res.status(400).json({ success: false, message: '缺少收件人姓名' });
  if (type !== 'money' && type !== 'item') return res.status(400).json({ success: false, message: '無效的郵寄類型' });

  if (!db) {
    return res.status(500).json({ success: false, message: '資料庫連結不可用' });
  }

  try {
    const getBinding = db.prepare('SELECT discord_id FROM bindings WHERE mc_username = ? COLLATE NOCASE');
    const senderBinding = getBinding.get(user.mc_username) as any;
    const senderDiscordId = senderBinding ? senderBinding.discord_id : 'web-dashboard';

    if (type === 'money') {
      const transferAmount = Number(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) {
        return res.status(400).json({ success: false, message: '金額必須為正數' });
      }

      let balance = 0;
      try {
        const balRes = await sendWsQuery('balance_query', { username: user.mc_username });
        if (balRes && typeof balRes.balance === 'number') {
          balance = balRes.balance;
        }
      } catch (err: any) {
        return res.status(400).json({ success: false, message: '無法取得您目前的金幣餘額，請確認遊戲伺服器是否在線。' });
      }

      if (balance < transferAmount) {
        return res.status(400).json({ success: false, message: '金幣餘額不足，無法寄送' });
      }

      const cmdRes = await sendWsQuery('command_request', {
        command: `removemoney "${user.mc_username}" ${transferAmount}`,
        admin_username: 'Web-Dashboard'
      });
      if (!cmdRes || !cmdRes.success) {
        return res.status(400).json({ success: false, message: '扣除寄件者餘額失敗：' + (cmdRes?.output || '未知錯誤') });
      }

      const insertMail = db.prepare(`
        INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, nbt, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `);
      insertMail.run(senderDiscordId, user.mc_username, receiver, 'craftcore:money', transferAmount, null);

      try {
        await sendWsQuery('command_request', {
          command: `tellraw ${receiver} {"text":"§b[Craft-Core] §e玩家 ${user.mc_username} 寄給您了一封快遞，請登入遊戲或重新切換分流領取！"}`,
          admin_username: 'Web-Dashboard'
        });
      } catch (ignored) {}

      return res.json({ success: true, message: '金幣匯款成功寄出！' });
    } else {
      const itemSlot = Number(slot);
      const itemQuantity = Number(quantity);
      if (isNaN(itemSlot) || itemSlot < 0 || itemSlot >= 36) {
        return res.status(400).json({ success: false, message: '無效的背包格子索引' });
      }
      if (isNaN(itemQuantity) || itemQuantity <= 0) {
        return res.status(400).json({ success: false, message: '數量必須為正整數' });
      }
      if (!itemId) {
        return res.status(400).json({ success: false, message: '缺少物品 ID' });
      }

      const takeRes = await sendWsQuery('take_item_request', {
        username: user.mc_username,
        slot: itemSlot,
        quantity: itemQuantity,
        itemId: itemId
      });

      if (!takeRes || !takeRes.success) {
        return res.status(400).json({ success: false, message: '從您的遊戲背包扣除物品失敗，請確認物品及數量是否正確且您在線上。' });
      }

      const insertMail = db.prepare(`
        INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, nbt, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `);
      insertMail.run(senderDiscordId, user.mc_username, receiver, itemId, itemQuantity, nbt || null);

      try {
        await sendWsQuery('command_request', {
          command: `tellraw ${receiver} {"text":"§b[Craft-Core] §e玩家 ${user.mc_username} 寄給您了一件快遞包裹，請登入遊戲或重新切換分流領取！"}`,
          admin_username: 'Web-Dashboard'
        });
      } catch (ignored) {}

      return res.json({ success: true, message: '物品快遞包裹成功寄出！' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/lockboxes/update', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  const { lockboxId, action, targetPlayer, newPassword } = req.body;
  if (!lockboxId || !action) {
    return res.status(400).json({ success: false, message: '缺少密碼鎖 ID 或操作參數' });
  }

  // 驗證擁有者身份
  let isOwner = false;
  const username = user.mc_username;
  try {
    const response = await sendWsQuery('lockboxes_query', {});
    const lockboxes = response.lockboxes || [];
    const targetBox = lockboxes.find((l: any) => l.id === lockboxId);
    if (targetBox && targetBox.owner.toLowerCase() === username.toLowerCase()) {
      isOwner = true;
    }
  } catch (err) {
    // Fallback to reading file
    try {
      const lockboxFile = path.resolve(__dirname, '../../../config/craft-core-shop/lockboxes.json');
      if (fs.existsSync(lockboxFile)) {
        const raw = fs.readFileSync(lockboxFile, 'utf8');
        const lockboxMap = JSON.parse(raw);
        const targetBox = lockboxMap[lockboxId];
        if (targetBox && targetBox.owner.toLowerCase() === username.toLowerCase()) {
          isOwner = true;
        }
      }
    } catch (fsErr) {
      // ignore
    }
  }

  if (!isOwner) {
    return res.status(403).json({ success: false, message: '您無權修改此密碼鎖（僅限密碼鎖擁有者修改）' });
  }

  const isGameOnline = botWsClient && botWsClient.readyState === WebSocket.OPEN;
  
  if (isGameOnline) {
    try {
      const response = await sendWsQuery('lockbox_update', {
        lockboxId,
        action,
        targetPlayer,
        newPassword
      });
      if (response && response.success) {
        return res.json({ success: true, message: '密碼鎖設定更新成功！' });
      } else {
        return res.status(400).json({ success: false, message: response?.message || '更新失敗' });
      }
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  } else {
    try {
      const fs = require('fs');
      const path = require('path');
      const possiblePaths = [
        path.resolve('config/craft-core-shop/lockboxes.json'),
        path.resolve('../config/craft-core-shop/lockboxes.json'),
        path.resolve('fabric-mod/config/craft-core-shop/lockboxes.json'),
        path.resolve('../fabric-mod/config/craft-core-shop/lockboxes.json')
      ];
      let lockboxPath = "";
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          lockboxPath = p;
          break;
        }
      }
      if (!lockboxPath) {
        lockboxPath = possiblePaths[0];
      }
      if (!fs.existsSync(lockboxPath)) {
        return res.status(400).json({ success: false, message: '遊戲伺服器離線且找不到密碼鎖設定檔' });
      }
      const data = JSON.parse(fs.readFileSync(lockboxPath, 'utf8'));
      const lockbox = data[lockboxId];
      if (!lockbox) {
        return res.status(404).json({ success: false, message: '找不到該密碼鎖記錄' });
      }

      if (lockbox.owner !== user.mc_username) {
        return res.status(403).json({ success: false, message: '您無權修改此密碼鎖' });
      }

      if (action === 'grant') {
        if (!lockbox.authorized.includes(targetPlayer)) {
          lockbox.authorized.push(targetPlayer);
        }
      } else if (action === 'revoke') {
        lockbox.authorized = lockbox.authorized.filter((p: string) => p !== targetPlayer);
      } else if (action === 'change_password') {
        lockbox.password = newPassword;
      } else if (action === 'delete') {
        delete data[lockboxId];
      } else {
        return res.status(400).json({ success: false, message: '無效的操作' });
      }

      fs.writeFileSync(lockboxPath, JSON.stringify(data, null, 2), 'utf8');
      return res.json({ success: true, message: '（伺服器離線，已直接保存至設定檔）密碼鎖更新成功！' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: '離線更新密碼鎖錯誤：' + err.message });
    }
  }
});

// 6. Rename shop (Deducts $5000 in-game fee)
app.post('/api/shop/rename', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  const { coords, custom_name } = req.body;

  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  if (!coords || !custom_name) return res.status(400).json({ success: false, message: '缺少坐標或商店名稱參數' });

  try {
    const payload = {
      username: user.mc_username,
      coords,
      custom_name
    };
    const result = await sendWsQuery('rename_shop_request', payload);
    if (result.success) {
      res.json({ success: true, message: '商店重命名成功，已扣除金幣。' });
    } else {
      res.status(400).json({ success: false, message: result.message || '重命名失敗' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Withdraw Shop Revenue
app.post('/api/shop/withdraw', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  const { coords } = req.body;

  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  if (!coords) return res.status(400).json({ success: false, message: '缺少商店坐標參數' });

  try {
    const payload = {
      username: user.mc_username,
      coords
    };
    const result = await sendWsQuery('withdraw_revenue_request', payload);
    if (result.success) {
      res.json({ success: true, message: `成功提領金幣 $${result.amount} 元！` });
    } else {
      res.status(400).json({ success: false, message: result.message || '提領失敗' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. Purchase additional slot limits
app.post('/api/user/upgrade', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });

  try {
    const payload = {
      username: user.mc_username
    };
    const result = await sendWsQuery('upgrade_limit_request', payload);
    if (result.success) {
      res.json({ success: true, message: '成功購買升級商店插槽上限！' });
    } else {
      res.status(400).json({ success: false, message: result.message || '升級失敗' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/claims
app.get('/api/claims', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  try {
    const response = await sendWsQuery('claims_query', {});
    const allClaims = response.claims || [];
    const myClaims = allClaims.filter((c: any) => c.owner.toLowerCase() === username.toLowerCase());
    res.json({ success: true, claims: myClaims });
  } catch (error: any) {
    // Fallback: Read from config/craft-core-shop/claims.json
    try {
      const claimsFile = path.resolve(__dirname, '../../../config/craft-core-shop/claims.json');
      if (fs.existsSync(claimsFile)) {
        const raw = fs.readFileSync(claimsFile, 'utf8');
        const claimsMap = JSON.parse(raw);
        const claimsArray = Object.values(claimsMap)
          .filter((c: any) => c.owner.toLowerCase() === username.toLowerCase())
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            owner: c.owner,
            chunks: c.chunks,
            corners: c.corners,
            dimension: c.dimension,
            permissions: {
              build: c.permissions?.build || [],
              break: c.permissions?.break || [],
              containers: c.permissions?.containers || [],
              interact: c.permissions?.interact || []
            }
          }));
        return res.json({ success: true, claims: claimsArray });
      }
    } catch (fsErr) {
      console.error('Failed to read claims fallback:', fsErr);
    }
    res.json({ success: true, claims: [] });
  }
});

// POST /api/claims/permission
app.post('/api/claims/permission', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  const { claimId, permissionType, player, action } = req.body;
  if (!claimId || !permissionType || !player || !action) {
    return res.status(400).json({ success: false, message: '缺少必要參數' });
  }

  // 驗證擁有者身份
  let isOwner = false;
  try {
    const response = await sendWsQuery('claims_query', {});
    const claims = response.claims || [];
    const targetClaim = claims.find((c: any) => c.id === claimId);
    if (targetClaim && targetClaim.owner.toLowerCase() === username.toLowerCase()) {
      isOwner = true;
    }
  } catch (err) {
    // Fallback to reading file
    try {
      const claimsFile = path.resolve(__dirname, '../../../config/craft-core-shop/claims.json');
      if (fs.existsSync(claimsFile)) {
        const raw = fs.readFileSync(claimsFile, 'utf8');
        const claimsMap = JSON.parse(raw);
        const targetClaim = claimsMap[claimId];
        if (targetClaim && targetClaim.owner.toLowerCase() === username.toLowerCase()) {
          isOwner = true;
        }
      }
    } catch (fsErr) {
      // ignore
    }
  }

  if (!isOwner) {
    return res.status(403).json({ success: false, message: '您無權修改此領地的權限（僅限領地擁有者修改）' });
  }

  try {
    const result = await sendWsQuery('claims_permission_update', {
      claimId,
      permissionType,
      player,
      action
    });
    if (result.success) {
      res.json({ success: true, message: '權限更新成功' });
    } else {
      res.status(400).json({ success: false, message: result.message || '更新失敗' });
    }
  } catch (error: any) {
    // Fallback: Write directly to claims.json file
    try {
      const claimsFile = path.resolve(__dirname, '../../../config/craft-core-shop/claims.json');
      if (fs.existsSync(claimsFile)) {
        const raw = fs.readFileSync(claimsFile, 'utf8');
        const claimsMap = JSON.parse(raw);
        if (claimsMap[claimId]) {
          const claim = claimsMap[claimId];
          if (!claim.permissions) {
            claim.permissions = { build: [], break: [], containers: [], interact: [] };
          }
          let key = permissionType === 'break' ? 'break' : permissionType;
          if (!claim.permissions[key]) {
            claim.permissions[key] = [];
          }
          if (action === 'grant') {
            if (!claim.permissions[key].includes(player)) {
              claim.permissions[key].push(player);
            }
          } else if (action === 'revoke') {
            claim.permissions[key] = claim.permissions[key].filter((p: string) => p !== player);
          }
          fs.writeFileSync(claimsFile, JSON.stringify(claimsMap, null, 2), 'utf8');
          return res.json({ success: true, message: '權限更新成功 (本地備份)' });
        }
      }
    } catch (fsErr) {
      console.error('Failed to update claims fallback:', fsErr);
    }
    res.status(500).json({ success: false, message: error.message || '遊戲伺服器未連線' });
  }
});

// GET /api/lockboxes
app.get('/api/lockboxes', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  try {
    const response = await sendWsQuery('lockboxes_query', {});
    const allLockboxes = response.lockboxes || [];
    const myLockboxes = allLockboxes.filter((l: any) => l.owner.toLowerCase() === username.toLowerCase());
    res.json({ success: true, lockboxes: myLockboxes });
  } catch (error: any) {
    // Fallback: Read from config/craft-core-shop/lockboxes.json
    try {
      const lockboxFile = path.resolve(__dirname, '../../../config/craft-core-shop/lockboxes.json');
      if (fs.existsSync(lockboxFile)) {
        const raw = fs.readFileSync(lockboxFile, 'utf8');
        const lockboxMap = JSON.parse(raw);
        const lockboxArray = Object.values(lockboxMap)
          .filter((l: any) => l.owner.toLowerCase() === username.toLowerCase())
          .map((l: any) => ({
            id: l.id,
            location: l.location,
            owner: l.owner,
            authorized: l.authorized || []
          }));
        return res.json({ success: true, lockboxes: lockboxArray });
      }
    } catch (fsErr) {
      console.error('Failed to read lockboxes fallback:', fsErr);
    }
    res.json({ success: true, lockboxes: [] });
  }
});

// -------------------------------------------------------------
// Admin Endpoints
// -------------------------------------------------------------

// Protect all /api/admin/* endpoints with authentication and requireAdmin
app.use('/api/admin', authenticateToken, requireAdmin);

// POST /api/admin/ban
app.post('/api/admin/ban', async (req: CustomRequest, res: Response) => {
  const { player, reason } = req.body;
  if (!player || !reason) {
    return res.status(400).json({ success: false, message: '缺少玩家名稱或原因' });
  }
  try {
    const cmdRes = await sendWsQuery('command_request', {
      command: `/ban ${player} ${reason}`,
      admin_username: req.user?.mc_username || 'Web-Dashboard'
    });
    if (cmdRes && cmdRes.success) {
      return res.json({ success: true, message: `成功封鎖玩家 ${player}：${cmdRes.output || ''}` });
    } else {
      return res.status(400).json({ success: false, message: `封鎖失敗：${cmdRes?.output || '未知錯誤'}` });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/kick
app.post('/api/admin/kick', async (req: CustomRequest, res: Response) => {
  const { player, reason } = req.body;
  if (!player || !reason) {
    return res.status(400).json({ success: false, message: '缺少玩家名稱或原因' });
  }
  try {
    const cmdRes = await sendWsQuery('command_request', {
      command: `/kick ${player} ${reason}`,
      admin_username: req.user?.mc_username || 'Web-Dashboard'
    });
    if (cmdRes && cmdRes.success) {
      return res.json({ success: true, message: `成功踢出玩家 ${player}：${cmdRes.output || ''}` });
    } else {
      return res.status(400).json({ success: false, message: `踢出失敗：${cmdRes?.output || '未知錯誤'}` });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/co-branding
app.post('/api/admin/co-branding', async (req: CustomRequest, res: Response) => {
  const { player } = req.body;
  const target = player || req.body.target;
  if (!target) {
    return res.status(400).json({ success: false, message: '缺少目標玩家名稱或 Discord ID' });
  }

  if (!db) {
    return res.status(500).json({ success: false, message: '資料庫連線不可用' });
  }

  try {
    const binding = db.prepare('SELECT discord_id, mc_username FROM bindings WHERE discord_id = ? OR mc_username = ? COLLATE NOCASE').get(target, target) as any;
    if (!binding) {
      return res.status(404).json({ success: false, message: '找不到該玩家的綁定紀錄' });
    }

    const updateKeys = db.prepare('UPDATE bindings SET keys_count = keys_count + 6 WHERE discord_id = ?');
    updateKeys.run(binding.discord_id);

    let gameSuccess = false;
    let gameOutput = '';
    try {
      const cmdRes = await sendWsQuery('command_request', {
        command: `/addmoney ${binding.mc_username} 5000`,
        admin_username: req.user?.mc_username || 'Web-Dashboard'
      });
      gameSuccess = cmdRes && cmdRes.success;
      gameOutput = cmdRes?.output || '';
    } catch (err: any) {
      gameOutput = err.message;
    }

    return res.json({
      success: true,
      message: `成功發送聯名獎勵給 ${binding.mc_username}！遊戲內金幣加值結果：${gameSuccess ? '成功' : '失敗 (' + gameOutput + ')'}`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/player/:username
app.get('/api/admin/player/:username', async (req: CustomRequest, res: Response) => {
  const { username } = req.params;
  if (!username) {
    return res.status(400).json({ success: false, message: '缺少玩家名稱' });
  }

  let dbStats = {
    keys_count: 0,
    checkin_streak: 0,
    total_checkins: 0,
    last_checkin: null,
    discord_id: null,
    mc_uuid: null
  };

  if (db) {
    try {
      const getBinding = db.prepare('SELECT discord_id, mc_uuid, keys_count, checkin_streak, total_checkins, last_checkin FROM bindings WHERE mc_username = ? COLLATE NOCASE');
      const binding = getBinding.get(username) as any;
      if (binding) {
        dbStats = {
          keys_count: binding.keys_count || 0,
          checkin_streak: binding.checkin_streak || 0,
          total_checkins: binding.total_checkins || 0,
          last_checkin: binding.last_checkin || null,
          discord_id: binding.discord_id || null,
          mc_uuid: binding.mc_uuid || null
        };
      }
    } catch (dbErr) {
      console.error('[Admin Player Search] Database query failed:', dbErr);
    }
  }

  let balance = 0;
  try {
    const response = await sendWsQuery('balance_query', { username });
    if (response && typeof response.balance === 'number') {
      balance = response.balance;
    }
  } catch (error: any) {
    console.warn('[Admin Player Search] Failed to fetch live balance via WS:', error.message);
  }

  let online = false;
  let coords = "離線";
  let tps = 20.0;
  try {
    const response = await sendWsQuery('player_status_query', { username });
    if (response && response.success) {
      online = response.online;
      coords = response.coords;
      tps = response.tps;
    }
  } catch (error: any) {
    console.warn('[Admin Player Search] Failed to fetch player status via WS:', error.message);
  }

  let inventory: any[] = [];
  try {
    const response = await sendWsQuery('player_inventory_query', { username });
    if (response && response.success) {
      inventory = response.items || [];
    }
  } catch (error: any) {
    console.warn('[Admin Player Search] Failed to fetch inventory via WS:', error.message);
  }

  res.json({
    success: true,
    profile: {
      mc_username: username,
      balance,
      online,
      coords,
      tps,
      ...dbStats
    },
    inventory
  });
});

// POST /api/admin/announcements
app.post('/api/admin/announcements', async (req: CustomRequest, res: Response) => {
  const { title, content, scope, impact } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: '缺少公告標題' });
  }

  try {
    const response = await sendWsQuery('publish_announcement', { title, content, scope, impact });
    if (response && response.success) {
      return res.json({ success: true, message: '公告已成功發布！' });
    } else {
      return res.status(400).json({ success: false, message: response?.message || '發布失敗' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Live WebSockets Server for Web Clients (Frontend Real-Time Sync)
// -------------------------------------------------------------
const wss = new WebSocketServer({ noServer: true });
const webClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  webClients.add(ws);
  ws.send(JSON.stringify({ type: 'connected', payload: { message: 'Web Dashboard Live link active.' } }));

  ws.on('close', () => {
    webClients.delete(ws);
  });
});

function broadcastToWebClients(packet: any) {
  const json = JSON.stringify(packet);
  webClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

// Upgrade HTTP Server to handle WebSocket connection from web client
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Start listening
server.listen(PORT, () => {
  console.log(`Web Dashboard Backend API Server running on port ${PORT}`);
});
