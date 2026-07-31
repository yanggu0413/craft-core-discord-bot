import { Router, Request, Response } from 'express';
import { loadConfigJson, saveConfigJson } from '../utils/configLoader';
import { authenticateToken } from '../middleware/auth';
import { CustomRequest, db, sendWsQuery } from '../websocket/wsClient';

const router = Router();

// GET /api/machines - List certified machines
router.get('/machines', async (req: Request, res: Response) => {
  const machines = loadConfigJson<Record<string, any>>('machines.json') || {};
  return res.json({ success: true, machines: Object.values(machines) });
});

// GET /api/treasure/hints - Get active treasure hints
router.get('/treasure/hints', async (req: Request, res: Response) => {
  return res.json({
    success: true,
    hint: '野外神秘藏寶箱每 2 小時隨機刷新，請在遊戲內輸入 /treasure 查看線索！'
  });
});

// GET /api/bounty/global - Global community goal progress
router.get('/bounty/global', async (req: Request, res: Response) => {
  const goal = loadConfigJson<any>('global_goal.json') || {
    title: '全服大狂歡：累積討伐怪物',
    currentCount: 0,
    targetCount: 3000,
    completed: false
  };
  return res.json({ success: true, goal });
});

// GET /api/user/titles - User unlocked titles (Filters out titles older than 2 days)
router.get('/user/titles', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;
  const lowerName = username.toLowerCase();
  const now = new Date().toISOString();

  // 1. Clean up expired titles in database
  if (db) {
    try {
      db.prepare('DELETE FROM player_titles WHERE username = ? AND expires_at IS NOT NULL AND expires_at <= ? COLLATE NOCASE').run(username, now);
    } catch (e) {}
  }

  // 2. Clean up expired titles in titles.json
  const titlesMap = loadConfigJson<Record<string, any>>('titles.json') || {};
  const userData = titlesMap[lowerName] || { activeTitle: '', unlockedTitles: [], titleExpiries: {} };
  const expiries = userData.titleExpiries || {};

  let validUnlocked: string[] = [];
  for (const title of (userData.unlockedTitles || [])) {
    const expireTime = expiries[title];
    if (expireTime && expireTime <= now) {
      // Expired temporary title
      if (userData.activeTitle === title) {
        userData.activeTitle = '';
        try {
          sendWsQuery('command_request', {
            command: `/title remove "${username}"`,
            admin_username: 'System-Expiry'
          }, 1500);
        } catch (e) {}
      }
    } else {
      validUnlocked.push(title);
    }
  }

  userData.unlockedTitles = validUnlocked;
  titlesMap[lowerName] = userData;
  saveConfigJson('titles.json', titlesMap);

  let unlockedSet = new Set<string>(validUnlocked);

  if (db) {
    try {
      const row = db.prepare('SELECT title_text, expires_at FROM player_titles WHERE username = ? COLLATE NOCASE').get(username) as any;
      if (row?.title_text) {
        if (!row.expires_at || row.expires_at > now) {
          unlockedSet.add(row.title_text);
        }
      }
    } catch (e) {}
  }

  return res.json({
    success: true,
    activeTitle: userData.activeTitle || '',
    unlockedTitles: Array.from(unlockedSet),
    titleExpiries: expiries
  });
});

// POST /api/user/title/equip - Equip selected title
router.post('/user/title/equip', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;
  const { title_text, color_code, is_bold } = req.body;
  const now = new Date().toISOString();

  try {
    const titlesMap = loadConfigJson<Record<string, any>>('titles.json') || {};
    const lowerName = username.toLowerCase();
    if (!titlesMap[lowerName]) {
      titlesMap[lowerName] = { activeTitle: '', unlockedTitles: [], titleExpiries: {} };
    }

    const expiries = titlesMap[lowerName].titleExpiries || {};
    if (title_text && expiries[title_text] && expiries[title_text] <= now) {
      return res.status(400).json({ success: false, message: '該稱號已過期 (限時 2 天)，無法佩戴！' });
    }

    titlesMap[lowerName].activeTitle = title_text || '';
    if (title_text && !titlesMap[lowerName].unlockedTitles.includes(title_text)) {
      titlesMap[lowerName].unlockedTitles.push(title_text);
    }
    saveConfigJson('titles.json', titlesMap);

    if (db) {
      try {
        db.prepare('DELETE FROM player_titles WHERE username = ? COLLATE NOCASE').run(username);
        if (title_text) {
          const titleExpiry = expiries[title_text] || null;
          db.prepare(`
            INSERT INTO player_titles (username, title_text, color_code, is_bold, updated_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(username, title_text, color_code || '§a', is_bold ? 1 : 0, now, titleExpiry);
        }
      } catch (e) {}
    }

    try {
      await sendWsQuery('command_request', {
        command: title_text ? `/title set "${username}" "${title_text}"` : `/title remove "${username}"`,
        admin_username: 'Web-Dashboard'
      }, 3000);
    } catch (wsErr) {}

    return res.json({ success: true, message: title_text ? `已成功佩戴稱號：「${title_text}」！` : '已卸下當前稱號！' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
