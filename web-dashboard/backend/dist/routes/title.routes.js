"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wsClient_1 = require("../websocket/wsClient");
const router = (0, express_1.Router)();
// GET /api/titles
router.get('/titles', (req, res) => {
    if (!wsClient_1.db)
        return res.json({ success: true, titles: {} });
    try {
        const rows = wsClient_1.db.prepare('SELECT username, title_text, color_code, is_bold FROM player_titles').all();
        const titlesMap = {};
        for (const r of rows) {
            titlesMap[r.username.toLowerCase()] = {
                title_text: r.title_text,
                color_code: r.color_code || '§c',
                is_bold: Boolean(r.is_bold)
            };
        }
        res.json({ success: true, titles: titlesMap });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
exports.default = router;
