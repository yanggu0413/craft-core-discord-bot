import { Router, Request, Response } from 'express';
import { loadConfigJson } from '../utils/configLoader';
import { authenticateToken } from '../middleware/auth';
import { CustomRequest } from '../websocket/wsClient';

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

// GET /api/user/titles - User unlocked titles
router.get('/user/titles', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  const titlesMap = loadConfigJson<Record<string, any>>('titles.json') || {};
  const userData = titlesMap[username.toLowerCase()] || { activeTitle: '', unlockedTitles: [] };

  return res.json({
    success: true,
    activeTitle: userData.activeTitle || '',
    unlockedTitles: userData.unlockedTitles || []
  });
});

export default router;
