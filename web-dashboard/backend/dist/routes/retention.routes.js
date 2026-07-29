"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const configLoader_1 = require("../utils/configLoader");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/machines - List certified machines
router.get('/machines', async (req, res) => {
    const machines = (0, configLoader_1.loadConfigJson)('machines.json') || {};
    return res.json({ success: true, machines: Object.values(machines) });
});
// GET /api/treasure/hints - Get active treasure hints
router.get('/treasure/hints', async (req, res) => {
    return res.json({
        success: true,
        hint: '野外神秘藏寶箱每 2 小時隨機刷新，請在遊戲內輸入 /treasure 查看線索！'
    });
});
// GET /api/bounty/global - Global community goal progress
router.get('/bounty/global', async (req, res) => {
    const goal = (0, configLoader_1.loadConfigJson)('global_goal.json') || {
        title: '全服大狂歡：累積討伐怪物',
        currentCount: 0,
        targetCount: 3000,
        completed: false
    };
    return res.json({ success: true, goal });
});
// GET /api/user/titles - User unlocked titles
router.get('/user/titles', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    const titlesMap = (0, configLoader_1.loadConfigJson)('titles.json') || {};
    const userData = titlesMap[username.toLowerCase()] || { activeTitle: '', unlockedTitles: [] };
    return res.json({
        success: true,
        activeTitle: userData.activeTitle || '',
        unlockedTitles: userData.unlockedTitles || []
    });
});
exports.default = router;
