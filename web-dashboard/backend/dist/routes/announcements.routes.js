"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wsClient_1 = require("../websocket/wsClient");
const router = (0, express_1.Router)();
// GET /api/announcements
router.get('/announcements', async (_req, res) => {
    if (!wsClient_1.db)
        return res.json({ success: true, announcements: [] });
    try {
        const list = wsClient_1.db.prepare('SELECT * FROM announcements ORDER BY id DESC LIMIT 20').all();
        return res.json({ success: true, announcements: list });
    }
    catch (e) {
        return res.json({ success: true, announcements: [] });
    }
});
// POST /api/admin/announcements
router.post('/admin/announcements', wsClient_1.authenticateToken, wsClient_1.requireAdmin, async (req, res) => {
    const { title, content, scope, impact } = req.body;
    if (!title || !title.trim()) {
        return res.status(400).json({ success: false, message: '公告標題不能為空' });
    }
    const publisher = req.user?.mc_username || 'Web-Dashboard';
    const cleanTitle = title.trim();
    const cleanContent = content ? content.trim() : '';
    const cleanScope = scope ? scope.trim() : '';
    const cleanImpact = impact ? impact.trim() : '';
    if (wsClient_1.db) {
        try {
            const stmt = wsClient_1.db.prepare('INSERT INTO announcements (title, content, scope, impact, publisher) VALUES (?, ?, ?, ?, ?)');
            stmt.run(cleanTitle, cleanContent, cleanScope, cleanImpact, publisher);
        }
        catch (dbErr) {
            console.error('Failed to save announcement to DB:', dbErr);
        }
    }
    try {
        await (0, wsClient_1.sendWsQuery)('command_request', {
            command: `/say [全服公告] ${cleanTitle}`,
            admin_username: publisher
        }, 2000);
    }
    catch (e) { }
    const webhookUrl = process.env.DISCORD_ANNOUNCEMENT_WEBHOOK || process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
        try {
            const todayStr = new Date().toLocaleDateString('zh-TW');
            const embedPayload = {
                content: '@公告通知',
                embeds: [{
                        title: `📢 ｜ 伺服器公告：${cleanTitle}`,
                        description: `親愛的玩家們：\n\n${cleanContent}\n\n----------------------------------------\n\n📌 ｜ **公告核心內容**\n* 🗓️ **發布時間**：${todayStr}${cleanScope ? `\n* ⚙️ **涉及範圍**：${cleanScope}` : ''}${cleanImpact ? `\n* ⚠️ **重要影響**：${cleanImpact}` : ''}\n\n**Craft-Core 管理團隊 敬上**`,
                        color: 5793266,
                        footer: { text: `發布者: ${publisher} • ${todayStr}` }
                    }]
            };
            fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(embedPayload)
            }).catch(err => console.error('Discord Webhook push error:', err));
        }
        catch (e) { }
    }
    return res.json({
        success: true,
        message: '全服公告已成功發布至 Discord 與遊戲內廣播！'
    });
});
exports.default = router;
