import { Router, Request, Response } from 'express';
import { db, sendWsQuery, getCachedData, setCachedData, invalidateCachePattern, CustomRequest, accumulatedSalesTax } from '../websocket/wsClient';
import { authenticateToken } from '../middleware/auth';
import { loadConfigJson } from '../utils/configLoader';

const router = Router();

function normalizeShop(raw: any) {
  if (!raw || typeof raw !== 'object') return null;
  const owner = raw.player || raw.owner || raw.username || '伺服器玩家';
  const visitorBuyPrice = Number(raw.sellPrice !== undefined ? raw.sellPrice : (raw.buy_price !== undefined ? raw.buy_price : raw.price)) || 0;
  const visitorSellPrice = Number(raw.buyPrice !== undefined ? raw.buyPrice : raw.sell_price) || 0;
  const coords = raw.coords || raw.location || raw.id || '0, 64, 0';
  return {
    location: coords,
    owner,
    item: raw.item || 'minecraft:stone',
    stock: Number(raw.stock) || 0,
    buy_price: visitorBuyPrice,
    sell_price: visitorSellPrice,
    custom_name: raw.customName || raw.custom_name || undefined
  };
}

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
    const response = await sendWsQuery('shops_query', {}, 300);
    if (response && response.success && Array.isArray(response.shops) && response.shops.length > 0) {
      shops = response.shops.map(normalizeShop).filter(Boolean);
      fetchedViaWs = true;
    }
  } catch (wsErr) {
    console.warn('[Shops Route] WebSocket query failed, falling back to local file:', wsErr);
  }

  if (fetchedViaWs && shops.length > 0) {
    setCachedData(cacheKey, shops, 10000);
    return res.json({ success: true, shops, totalSalesTax: accumulatedSalesTax });
  }

  // Fallback to MCSManager / local JSON file reading when WS is disconnected
  try {
    const shopsMap = loadConfigJson<Record<string, any>>('shops.json');
    if (shopsMap && typeof shopsMap === 'object') {
      const shopsArray = Object.values(shopsMap).map(normalizeShop).filter(Boolean);
      setCachedData(cacheKey, shopsArray, 10000);
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

  const username = user.mc_username;
  const cleanUsername = (username || '').replace(/^\./, '').toLowerCase();

  // Validate shop ownership against local shops.json cache before forwarding to WS
  try {
    const shopsMap = loadConfigJson<Record<string, any>>('shops.json');
    if (shopsMap && typeof shopsMap === 'object') {
      const targetShop: any = Object.values(shopsMap).find((s: any) => {
        const sCoords = s.coords || s.location || s.id;
        return sCoords === coords;
      });
      if (targetShop) {
        const shopOwner = (targetShop.player || targetShop.owner || '').replace(/^\./, '').toLowerCase();
        const isAdmin = Boolean((user as any).isAdmin || user.profile?.isAdmin);
        if (shopOwner !== cleanUsername && !isAdmin) {
          return res.status(403).json({ success: false, message: '安全性拒絕：您並非該箱子商店的店主，無權提領他人營收！' });
        }
      }
    }
  } catch (e) {}

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
