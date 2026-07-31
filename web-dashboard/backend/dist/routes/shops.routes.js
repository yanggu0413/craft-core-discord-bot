"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wsClient_1 = require("../websocket/wsClient");
const auth_1 = require("../middleware/auth");
const configLoader_1 = require("../utils/configLoader");
const router = (0, express_1.Router)();
function normalizeShop(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const owner = raw.player || raw.owner || raw.username || '伺服器玩家';
    const buyPrice = Number(raw.price !== undefined ? raw.price : (raw.sellPrice !== undefined ? raw.sellPrice : raw.buy_price)) || 0;
    const sellPrice = Number(raw.buyPrice !== undefined ? raw.buyPrice : raw.sell_price) || 0;
    const coords = raw.coords || raw.location || raw.id || '0, 64, 0';
    return {
        location: coords,
        owner,
        item: raw.item || 'minecraft:stone',
        stock: Number(raw.stock) || 0,
        buy_price: buyPrice,
        sell_price: sellPrice,
        custom_name: raw.customName || raw.custom_name || undefined
    };
}
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
        const response = await (0, wsClient_1.sendWsQuery)('shops_query', {}, 300);
        if (response && response.success && Array.isArray(response.shops) && response.shops.length > 0) {
            shops = response.shops.map(normalizeShop).filter(Boolean);
            fetchedViaWs = true;
        }
    }
    catch (wsErr) {
        console.warn('[Shops Route] WebSocket query failed, falling back to local file:', wsErr);
    }
    if (fetchedViaWs && shops.length > 0) {
        (0, wsClient_1.setCachedData)(cacheKey, shops, 10000);
        return res.json({ success: true, shops, totalSalesTax: wsClient_1.accumulatedSalesTax });
    }
    // Fallback to MCSManager / local JSON file reading when WS is disconnected
    try {
        const shopsMap = (0, configLoader_1.loadConfigJson)('shops.json');
        if (shopsMap && typeof shopsMap === 'object') {
            const shopsArray = Object.values(shopsMap).map(normalizeShop).filter(Boolean);
            (0, wsClient_1.setCachedData)(cacheKey, shopsArray, 10000);
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
    const username = user.mc_username;
    const cleanUsername = (username || '').replace(/^\./, '').toLowerCase();
    // Validate shop ownership against local shops.json cache before forwarding to WS
    try {
        const shopsMap = (0, configLoader_1.loadConfigJson)('shops.json');
        if (shopsMap && typeof shopsMap === 'object') {
            const targetShop = Object.values(shopsMap).find((s) => {
                const sCoords = s.coords || s.location || s.id;
                return sCoords === coords;
            });
            if (targetShop) {
                const shopOwner = (targetShop.player || targetShop.owner || '').replace(/^\./, '').toLowerCase();
                const isAdmin = Boolean(user.isAdmin || user.profile?.isAdmin);
                if (shopOwner !== cleanUsername && !isAdmin) {
                    return res.status(403).json({ success: false, message: '安全性拒絕：您並非該箱子商店的店主，無權提領他人營收！' });
                }
            }
        }
    }
    catch (e) { }
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
