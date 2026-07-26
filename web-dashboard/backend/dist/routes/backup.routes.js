"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const wsClient_1 = require("../websocket/wsClient");
const router = (0, express_1.Router)();
router.use(wsClient_1.authenticateToken, wsClient_1.requireAdmin);
// GET /api/admin/backup/status
router.get('/status', async (req, res) => {
    let wsStats = null;
    let fetchedViaWs = false;
    try {
        const wsRes = await (0, wsClient_1.sendWsQuery)('backup_query', { action: 'status' });
        if (wsRes && wsRes.success) {
            wsStats = wsRes.stats;
            fetchedViaWs = true;
        }
    }
    catch (wsErr) {
        console.warn('[Backup Route] WebSocket query failed, falling back to local backups directory:', wsErr);
    }
    if (fetchedViaWs && wsStats) {
        return res.json({ success: true, stats: wsStats });
    }
    // Fallback: Scan local backups/ directory when WS is offline
    try {
        const possibleDirs = [
            path_1.default.resolve(__dirname, '../../../../backups'),
            path_1.default.resolve(__dirname, '../../../../../fabric-mod/backups'),
            path_1.default.resolve('backups')
        ];
        let backupDir = possibleDirs[0];
        for (const d of possibleDirs) {
            if (fs_1.default.existsSync(d)) {
                backupDir = d;
                break;
            }
        }
        let totalBytes = 0;
        let count = 0;
        const files = [];
        if (fs_1.default.existsSync(backupDir)) {
            const list = fs_1.default.readdirSync(backupDir).filter(f => f.endsWith('.7z'));
            count = list.length;
            for (const f of list) {
                const stat = fs_1.default.statSync(path_1.default.join(backupDir, f));
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
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});
// POST /api/admin/backup/trigger
router.post('/trigger', async (req, res) => {
    try {
        const adminUsername = req.user?.mc_username || 'Admin';
        const wsRes = await (0, wsClient_1.sendWsQuery)('backup_query', { action: 'trigger', admin_username: adminUsername });
        return res.json(wsRes || { success: true, message: '地圖備份作業已發起！' });
    }
    catch (err) {
        return res.status(503).json({ success: false, message: '遊戲伺服器未連線，無法即時發起備份（' + err.message + '）' });
    }
});
exports.default = router;
