import { Router, Request, Response } from 'express';
import { db, getCachedData, setCachedData, invalidateCachePattern, authenticateToken, requireAdmin, CustomRequest, sendEventAnnouncementToDiscord } from '../websocket/wsClient';

const router = Router();

// GET /api/events
router.get('/events', (req: Request, res: Response) => {
  const cacheKey = 'cache:events:all';
  const cached = getCachedData(cacheKey);
  if (cached) return res.json({ success: true, events: cached, cached: true });

  if (!db) return res.json({ success: true, events: [] });
  try {
    const events = db.prepare('SELECT * FROM server_events ORDER BY id DESC').all();
    setCachedData(cacheKey, events, 5000);
    res.json({ success: true, events });
  } catch (e: any) {
    res.json({ success: true, events: [] });
  }
});

// GET /api/events/active
router.get('/events/active', (req: Request, res: Response) => {
  const cacheKey = 'cache:events:active';
  const cached = getCachedData(cacheKey);
  if (cached) return res.json({ success: true, events: cached, cached: true });

  if (!db) return res.json({ success: true, events: [] });
  try {
    const events = db.prepare("SELECT * FROM server_events WHERE status = 'active' ORDER BY id DESC").all();
    setCachedData(cacheKey, events, 5000);
    res.json({ success: true, events });
  } catch (e: any) {
    res.json({ success: true, events: [] });
  }
});

// POST /api/admin/events
router.post('/admin/events', authenticateToken, requireAdmin, async (req: CustomRequest, res: Response) => {
  const { title, description, start_time, end_time, reward_info, status } = req.body;
  if (!title || !description) {
    return res.status(400).json({ success: false, message: '請提供活動標題與詳細說明' });
  }
  if (!db) return res.status(500).json({ success: false, message: 'Database connection offline' });
  try {
    const stmt = db.prepare(`
      INSERT INTO server_events (title, description, start_time, end_time, reward_info, status, creator_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const creatorName = req.user?.mc_username || '管理員';
    const eventStatus = status || 'active';
    stmt.run(title, description, start_time || '', end_time || '', reward_info || '', eventStatus, creatorName);
    invalidateCachePattern('cache:events');

    if (eventStatus === 'active') {
      sendEventAnnouncementToDiscord({
        title,
        description,
        start_time,
        end_time,
        reward_info,
        creator_name: creatorName
      });
    }

    res.json({ success: true, message: '成功建立新活動，已同步推播公告至 Discord！' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// PUT /api/admin/events/:id
router.put('/admin/events/:id', authenticateToken, requireAdmin, async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  const { title, description, start_time, end_time, reward_info, status } = req.body;
  if (!db) return res.status(500).json({ success: false, message: 'Database connection offline' });
  try {
    const existing: any = db.prepare('SELECT * FROM server_events WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '找不到該活動' });
    }

    const updatedTitle = title ?? existing.title ?? '';
    const updatedDesc = description ?? existing.description ?? '';
    const updatedStartTime = start_time ?? existing.start_time ?? '';
    const updatedEndTime = end_time ?? existing.end_time ?? '';
    const updatedReward = reward_info ?? existing.reward_info ?? '';
    const updatedStatus = status ?? existing.status ?? 'active';

    const stmt = db.prepare(`
      UPDATE server_events
      SET title = ?, description = ?, start_time = ?, end_time = ?, reward_info = ?, status = ?
      WHERE id = ?
    `);
    stmt.run(updatedTitle, updatedDesc, updatedStartTime, updatedEndTime, updatedReward, updatedStatus, id);
    invalidateCachePattern('cache:events');

    if (updatedStatus === 'active') {
      sendEventAnnouncementToDiscord({
        title: updatedTitle,
        description: updatedDesc,
        start_time: updatedStartTime,
        end_time: updatedEndTime,
        reward_info: updatedReward,
        creator_name: req.user?.mc_username || '管理員'
      });
    }

    res.json({ success: true, message: '活動更新成功！' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE /api/admin/events/:id
router.delete('/admin/events/:id', authenticateToken, requireAdmin, async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  if (!db) return res.status(500).json({ success: false, message: 'Database connection offline' });
  try {
    db.prepare('DELETE FROM server_events WHERE id = ?').run(id);
    invalidateCachePattern('cache:events');
    res.json({ success: true, message: '活動已刪除！' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
