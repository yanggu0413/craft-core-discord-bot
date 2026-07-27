"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wsClient_1 = require("../websocket/wsClient");
const auth_1 = require("../middleware/auth");
const configLoader_1 = require("../utils/configLoader");
const router = (0, express_1.Router)();
// GET /api/shops
router.get('/shops', async (req, res) => {
    const cacheKey = 'cache:shops:all';
    const cached = (0, wsClient_1.getCachedData)(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
        return res.json({ success: true, shops: cached, cached: true, totalSalesTax: wsClient_1.accumulatedSalesTax });
    }
    let shops = [];
    let fetchedViaWs = false;
    try {
        const response = await (0, wsClient_1.sendWsQuery)('shops_query', {});
        if (response && response.success && Array.isArray(response.shops) && response.shops.length > 0) {
            shops = response.shops;
            fetchedViaWs = true;
        }
    }
    catch (wsErr) {
        console.warn('[Shops Route] WebSocket query failed, falling back to local file:', wsErr);
    }
    if (fetchedViaWs) {
        (0, wsClient_1.setCachedData)(cacheKey, shops, 3000);
        return res.json({ success: true, shops, totalSalesTax: wsClient_1.accumulatedSalesTax });
    }
    // Fallback to MCSManager / local JSON file reading when WS is disconnected
    try {
        const shopsMap = (0, configLoader_1.loadConfigJson)('shops.json');
        if (shopsMap && typeof shopsMap === 'object') {
            const shopsArray = Object.values(shopsMap);
            (0, wsClient_1.setCachedData)(cacheKey, shopsArray, 3000);
            return res.json({ success: true, shops: shopsArray, totalSalesTax: wsClient_1.accumulatedSalesTax });
        }
        return res.json({ success: true, shops: [], totalSalesTax: wsClient_1.accumulatedSalesTax });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/shop/rename
router.post('/shop/rename', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const { coords, custom_name } = req.body;
    if (!coords || !custom_name) {
        return res.status(400).json({ success: false, message: '缺少座標或新名稱參數' });
    }
    try {
        const response = await (0, wsClient_1.sendWsQuery)('shop_action', {
            action: 'rename',
            username: user.mc_username,
            coords,
            custom_name
        });
        (0, wsClient_1.invalidateCachePattern)('cache:shops');
        return res.json({ success: response.success, message: response.message });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/shop/withdraw
router.post('/shop/withdraw', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const { coords } = req.body;
    if (!coords) {
        return res.status(400).json({ success: false, message: '缺少商店座標參數' });
    }
    try {
        const response = await (0, wsClient_1.sendWsQuery)('shop_action', {
            action: 'withdraw',
            username: user.mc_username,
            coords
        });
        (0, wsClient_1.invalidateCachePattern)('cache:shops');
        return res.json({ success: response.success, message: response.message });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/shop/rate
router.post('/shop/rate', auth_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const { coords, rating } = req.body;
    if (!coords || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: '請提供有效的商店座標與 1~5 評分星等！' });
    }
    try {
        const response = await (0, wsClient_1.sendWsQuery)('shop_action', {
            action: 'rate',
            username: user.mc_username,
            coords,
            rating
        });
        (0, wsClient_1.invalidateCachePattern)('cache:shops');
        return res.json({ success: response.success, message: response.message || '評分成功！感謝您的回饋。' });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// GET /api/transactions
router.get('/transactions', (req, res) => {
    const cacheKey = 'cache:transactions:public';
    const cached = (0, wsClient_1.getCachedData)(cacheKey);
    if (cached) {
        return res.json({ success: true, transactions: cached, cached: true });
    }
    if (!wsClient_1.db)
        return res.json({ success: true, transactions: [] });
    try {
        const rows = wsClient_1.db.prepare('SELECT id, timestamp, shop_coords, buyer, seller, item, quantity, unit_price, tax_deducted, net_profit FROM transactions ORDER BY id DESC LIMIT 50').all();
        (0, wsClient_1.setCachedData)(cacheKey, rows, 3000);
        res.json({ success: true, transactions: rows });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.default = router;
