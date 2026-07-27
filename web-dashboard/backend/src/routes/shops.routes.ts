import { Router, Request, Response } from 'express';
import { db, sendWsQuery, getCachedData, setCachedData, invalidateCachePattern, CustomRequest, accumulatedSalesTax } from '../websocket/wsClient';
import { authenticateToken } from '../middleware/auth';
import { loadConfigJson } from '../utils/configLoader';

const router = Router();

// GET /api/shops
router.get('/shops', async (req: Request, res: Response) => {
  const cacheKey = 'cache:shops:all';
  const cached = getCachedData<any[]>(cacheKey);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return res.json({ success: true, shops: cached, cached: true, totalSalesTax: accumulatedSalesTax });
  }

  let shops: any[] = [];
  let fetchedViaWs = false;

  try {
    const response = await sendWsQuery('shops_query', {});
    if (response && response.success && Array.isArray(response.shops) && response.shops.length > 0) {
      shops = response.shops;
      fetchedViaWs = true;
    }
  } catch (wsErr) {
    console.warn('[Shops Route] WebSocket query failed, falling back to local file:', wsErr);
  }

  if (fetchedViaWs) {
    setCachedData(cacheKey, shops, 3000);
    return res.json({ success: true, shops, totalSalesTax: accumulatedSalesTax });
  }

  // Fallback to MCSManager / local JSON file reading when WS is disconnected
  try {
    const shopsMap = loadConfigJson<Record<string, any>>('shops.json');
    if (shopsMap && typeof shopsMap === 'object') {
      const shopsArray = Object.values(shopsMap);
      setCachedData(cacheKey, shopsArray, 3000);
      return res.json({ success: true, shops: shopsArray, totalSalesTax: accumulatedSalesTax });
    }
    return res.json({ success: true, shops: [], totalSalesTax: accumulatedSalesTax });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/shop/rename
router.post('/shop/rename', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const { coords, custom_name } = req.body;
  if (!coords || !custom_name) {
    return res.status(400).json({ success: false, message: '缺少座標或新名稱參數' });
  }

  try {
    const response = await sendWsQuery('shop_action', {
      action: 'rename',
      username: user.mc_username,
      coords,
      custom_name
    });
    invalidateCachePattern('cache:shops');
    return res.json({ success: response.success, message: response.message });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/shop/withdraw
router.post('/shop/withdraw', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const { coords } = req.body;
  if (!coords) {
    return res.status(400).json({ success: false, message: '缺少商店座標參數' });
  }

  try {
    const response = await sendWsQuery('shop_action', {
      action: 'withdraw',
      username: user.mc_username,
      coords
    });
    invalidateCachePattern('cache:shops');
    return res.json({ success: response.success, message: response.message });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/shop/rate
router.post('/shop/rate', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const { coords, rating } = req.body;
  if (!coords || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: '請提供有效的商店座標與 1~5 評分星等！' });
  }

  try {
    const response = await sendWsQuery('shop_action', {
      action: 'rate',
      username: user.mc_username,
      coords,
      rating
    });
    invalidateCachePattern('cache:shops');
    return res.json({ success: response.success, message: response.message || '評分成功！感謝您的回饋。' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/transactions
router.get('/transactions', (req: Request, res: Response) => {
  const cacheKey = 'cache:transactions:public';
  const cached = getCachedData<any[]>(cacheKey);
  if (cached) {
    return res.json({ success: true, transactions: cached, cached: true });
  }

  if (!db) return res.json({ success: true, transactions: [] });
  try {
    const rows = db.prepare('SELECT id, timestamp, shop_coords, buyer, seller, item, quantity, unit_price, tax_deducted, net_profit FROM transactions ORDER BY id DESC LIMIT 50').all();
    setCachedData(cacheKey, rows, 3000);
    res.json({ success: true, transactions: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
