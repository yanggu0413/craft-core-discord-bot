"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wsClient_1 = require("../websocket/wsClient");
const router = (0, express_1.Router)();
// GET /api/events
router.get('/events', (req, res) => {
    const cacheKey = 'cache:events:all';
    const cached = (0, wsClient_1.getCachedData)(cacheKey);
    if (cached)
        return res.json({ success: true, events: cached, cached: true });
    if (!wsClient_1.db)
        return res.json({ success: true, events: [] });
    try {
        const events = wsClient_1.db.prepare('SELECT * FROM server_events ORDER BY id DESC').all();
        (0, wsClient_1.setCachedData)(cacheKey, events, 5000);
        res.json({ success: true, events });
    }
    catch (e) {
        res.json({ success: true, events: [] });
    }
});
// GET /api/events/active
router.get('/events/active', (req, res) => {
    const cacheKey = 'cache:events:active';
    const cached = (0, wsClient_1.getCachedData)(cacheKey);
    if (cached)
        return res.json({ success: true, events: cached, cached: true });
    if (!wsClient_1.db)
        return res.json({ success: true, events: [] });
    try {
        const events = wsClient_1.db.prepare("SELECT * FROM server_events WHERE LOWER(COALESCE(status, 'active')) = 'active' ORDER BY id DESC").all();
        (0, wsClient_1.setCachedData)(cacheKey, events, 5000);
        res.json({ success: true, events });
    }
    catch (e) {
        res.json({ success: true, events: [] });
    }
});
// POST /api/admin/events
router.post('/admin/events', wsClient_1.authenticateToken, wsClient_1.requireAdmin, async (req, res) => {
    const { title, description, start_time, end_time, reward_info, status } = req.body;
    if (!title || !description) {
        return res.status(400).json({ success: false, message: '請提供活動標題與詳細說明' });
    }
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: 'Database connection offline' });
    try {
        const stmt = wsClient_1.db.prepare(`
      INSERT INTO server_events (title, description, start_time, end_time, reward_info, status, creator_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        const creatorName = req.user?.mc_username || '管理員';
        const eventStatus = status || 'active';
        stmt.run(title, description, start_time || '', end_time || '', reward_info || '', eventStatus, creatorName);
        (0, wsClient_1.invalidateCachePattern)('cache:events');
        if (eventStatus === 'active') {
            (0, wsClient_1.sendEventAnnouncementToDiscord)({
                title,
                description,
                start_time,
                end_time,
                reward_info,
                creator_name: creatorName
            });
        }
        res.json({ success: true, message: '成功建立新活動，已同步推播公告至 Discord！' });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// PUT /api/admin/events/:id
router.put('/admin/events/:id', wsClient_1.authenticateToken, wsClient_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, description, start_time, end_time, reward_info, status } = req.body;
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: 'Database connection offline' });
    try {
        const existing = wsClient_1.db.prepare('SELECT * FROM server_events WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: '找不到該活動' });
        }
        const updatedTitle = title ?? existing.title ?? '';
        const updatedDesc = description ?? existing.description ?? '';
        const updatedStartTime = start_time ?? existing.start_time ?? '';
        const updatedEndTime = end_time ?? existing.end_time ?? '';
        const updatedReward = reward_info ?? existing.reward_info ?? '';
        const updatedStatus = status ?? existing.status ?? 'active';
        const stmt = wsClient_1.db.prepare(`
      UPDATE server_events
      SET title = ?, description = ?, start_time = ?, end_time = ?, reward_info = ?, status = ?
      WHERE id = ?
    `);
        stmt.run(updatedTitle, updatedDesc, updatedStartTime, updatedEndTime, updatedReward, updatedStatus, id);
        (0, wsClient_1.invalidateCachePattern)('cache:events');
        if (updatedStatus === 'active') {
            (0, wsClient_1.sendEventAnnouncementToDiscord)({
                title: updatedTitle,
                description: updatedDesc,
                start_time: updatedStartTime,
                end_time: updatedEndTime,
                reward_info: updatedReward,
                creator_name: req.user?.mc_username || '管理員'
            });
        }
        res.json({ success: true, message: '活動更新成功！' });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// DELETE /api/admin/events/:id
router.delete('/admin/events/:id', wsClient_1.authenticateToken, wsClient_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: 'Database connection offline' });
    try {
        wsClient_1.db.prepare('DELETE FROM server_events WHERE id = ?').run(id);
        (0, wsClient_1.invalidateCachePattern)('cache:events');
        res.json({ success: true, message: '活動已刪除！' });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
exports.default = router;
