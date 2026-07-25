import { Router, Request, Response } from 'express';
import { db } from '../websocket/wsClient';

const router = Router();

// GET /api/titles
router.get('/titles', (req: Request, res: Response) => {
  if (!db) return res.json({ success: true, titles: {} });
  try {
    const rows = db.prepare('SELECT username, title_text, color_code, is_bold FROM player_titles').all() as any[];
    const titlesMap: Record<string, any> = {};
    for (const r of rows) {
      titlesMap[r.username.toLowerCase()] = {
        title_text: r.title_text,
        color_code: r.color_code || '§c',
        is_bold: Boolean(r.is_bold)
      };
    }
    res.json({ success: true, titles: titlesMap });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
