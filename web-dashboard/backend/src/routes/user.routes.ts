import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { db, sendWsQuery, getCachedData, setCachedData, invalidateCachePattern, authenticateToken, CustomRequest, JWT_SECRET } from '../websocket/wsClient';

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

// GET /api/user/profile
router.get('/user/profile', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  let balance = 0.0;
  try {
    const response = await sendWsQuery('balance_query', { username });
    if (response && response.success) {
      balance = response.balance;
    }
  } catch (error: any) {
    console.warn('[Profile API] Failed to fetch balance via WS:', error.message);
  }

  let dbStats: any = {};
  if (db) {
    try {
      const row = db.prepare('SELECT keys_count, checkin_streak, total_checkins, last_checkin, subscribe_reminder, discord_id FROM bindings WHERE mc_username = ? COLLATE NOCASE').get(username) as any;
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
    } catch (dbErr) {
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
router.post('/user/checkin', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  if (!db) return res.status(500).json({ success: false, message: '資料庫連線不可用' });

  const todayStr = getTaipeiDateString();
  const yesterdayStr = getTaipeiYesterdayDateString();

  try {
    const row = db.prepare('SELECT * FROM bindings WHERE mc_username = ? COLLATE NOCASE').get(username) as any;
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
    const updateStmt = db.prepare(`
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
  if (cached) {
    return res.json({ success: true, fakeplayers: cached, cached: true });
  }

  try {
    const response = await sendWsQuery('fake_players_query', { username: user.mc_username }, 1500);
    if (response && response.success) {
      const myBots = (response.fakeplayers || []).filter((b: any) =>
        b.owner && b.owner.toLowerCase() === user.mc_username.toLowerCase()
      );
      setCachedData(cacheKey, myBots, 3000);
      return res.json({ success: true, fakeplayers: myBots });
    }
    return res.json({ success: true, fakeplayers: [] });
  } catch (error: any) {
    try {
      const possiblePaths = [
        path.resolve(__dirname, '../../../../config/craft-core-shop/fake_players.json'),
        path.resolve(__dirname, '../../../../../fabric-mod/config/craft-core-shop/fake_players.json'),
        path.resolve('config/craft-core-shop/fake_players.json')
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf8');
          const map = JSON.parse(raw);
          const myBots = Object.entries(map)
            .filter(([_, owner]) => String(owner).toLowerCase() === user.mc_username.toLowerCase())
            .map(([name, owner]) => ({ name, owner, online: false }));
          setCachedData(cacheKey, myBots, 2000);
          return res.json({ success: true, fakeplayers: myBots });
        }
      }
    } catch (fsErr) {}
    return res.json({ success: true, fakeplayers: [] });
  }
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
    return res.json({ success: true, homes: [] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
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
    res.json({ success: true, lockboxes: myLockboxes });
  } catch (error: any) {
    try {
      const possiblePaths = [
        path.resolve(__dirname, '../../../../config/craft-core-shop/lockboxes.json'),
        path.resolve(__dirname, '../../../../../fabric-mod/config/craft-core-shop/lockboxes.json'),
        path.resolve('config/craft-core-shop/lockboxes.json')
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf8');
          const lockboxMap = JSON.parse(raw);
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

// GET /api/tasks/daily
router.get('/tasks/daily', async (req: Request, res: Response) => {
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
    const tasks = getDailyTasksFallback(dateStr);
    return res.json({
      success: true,
      date: dateStr,
      slay_task: tasks[0],
      mine_task: tasks[1],
      slay_progress: 0,
      mine_progress: 0,
      has_claimed: false,
      is_completed: false
    });
  }

  try {
    const response = await sendWsQuery('daily_tasks_query', { username });
    if (response && response.success) {
      return res.json({
        success: true,
        date: dateStr,
        slay_task: response.slay_task,
        mine_task: response.mine_task,
        slay_progress: response.slay_progress,
        mine_progress: response.mine_progress,
        has_claimed: response.has_claimed,
        is_completed: response.is_completed
      });
    }
    const fallbackTasks = getDailyTasksFallback(dateStr);
    return res.json({
      success: true,
      date: dateStr,
      slay_task: fallbackTasks[0],
      mine_task: fallbackTasks[1],
      slay_progress: 0,
      mine_progress: 0,
      has_claimed: false,
      is_completed: false
    });
  } catch (error: any) {
    const fallbackTasks = getDailyTasksFallback(dateStr);
    return res.json({
      success: true,
      date: dateStr,
      slay_task: fallbackTasks[0],
      mine_task: fallbackTasks[1],
      slay_progress: 0,
      mine_progress: 0,
      has_claimed: false,
      is_completed: false
    });
  }
});

// POST /api/tasks/claim
router.post('/tasks/claim', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  try {
    const response = await sendWsQuery('claim_daily_reward', { username });
    return res.json({ success: response.success, message: response.message });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/playtime/exchange
router.post('/playtime/exchange', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;
  const { mode } = req.body;

  try {
    const response = await sendWsQuery('playtime_exchange', { username, mode: mode || 'single' });
    return res.json({ success: response.success, message: response.message, keys_added: response.keys_added || 0 });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
