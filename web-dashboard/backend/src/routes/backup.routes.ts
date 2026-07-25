import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { sendWsQuery, authenticateToken, requireAdmin, CustomRequest } from '../websocket/wsClient';

const router = Router();

router.use(authenticateToken, requireAdmin);

// GET /api/admin/backup/status
router.get('/status', async (req: CustomRequest, res: Response) => {
  try {
    const wsRes = await sendWsQuery('backup_query', { action: 'status' });
    if (wsRes && wsRes.success) {
      return res.json({ success: true, stats: wsRes.stats });
    }
    const possibleDirs = [
      path.resolve(__dirname, '../../../../backups'),
      path.resolve(__dirname, '../../../../../fabric-mod/backups'),
      path.resolve('backups')
    ];
    let backupDir = possibleDirs[0];
    for (const d of possibleDirs) {
      if (fs.existsSync(d)) { backupDir = d; break; }
    }

    let totalBytes = 0;
    let count = 0;
    const files: any[] = [];
    if (fs.existsSync(backupDir)) {
      const list = fs.readdirSync(backupDir).filter(f => f.endsWith('.7z'));
      count = list.length;
      for (const f of list) {
        const stat = fs.statSync(path.join(backupDir, f));
        totalBytes += stat.size;
        files.push({ name: f, size_bytes: stat.size, last_modified: stat.mtimeMs });
      }
      files.sort((a, b) => b.last_modified - a.last_modified);
    }
    return res.json({
      success: true,
      stats: {
        total_bytes: totalBytes,
        max_bytes: 100 * 1024 * 1024 * 1024,
        count,
        is_backing_up: false,
        files
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/backup/trigger
router.post('/trigger', async (req: CustomRequest, res: Response) => {
  try {
    const adminUsername = req.user?.mc_username || 'Admin';
    const wsRes = await sendWsQuery('backup_query', { action: 'trigger', admin_username: adminUsername });
    return res.json(wsRes || { success: true, message: '地圖備份作業已發起！' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
