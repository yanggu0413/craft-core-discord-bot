import { Router, Response } from 'express';
import { db, sendWsQuery, authenticateToken, requireAdmin, CustomRequest } from '../websocket/wsClient';

const router = Router();

// Protect all routes with authentication and requireAdmin
router.use(authenticateToken, requireAdmin);

// GET /api/admin/player/:username
router.get('/player/:username', async (req: CustomRequest, res: Response) => {
  const { username } = req.params;
  if (!username) {
    return res.status(400).json({ success: false, message: '請提供玩家名稱' });
  }

  let balance = 0.0;
  try {
    const response = await sendWsQuery('balance_query', { username });
    if (response && response.success) {
      balance = response.balance;
    }
  } catch (error: any) {
    console.warn('[Admin Player Search] Failed to fetch balance via WS:', error.message);
  }

  let dbStats: any = {};
  if (db) {
    try {
      const row = db.prepare('SELECT * FROM bindings WHERE mc_username = ? COLLATE NOCASE').get(username) as any;
      if (row) {
        dbStats = {
          keys_count: row.keys_count || 0,
          checkin_streak: row.checkin_streak || 0,
          total_checkins: row.total_checkins || 0,
          last_checkin: row.last_checkin || null,
          discord_id: row.discord_id || null,
          discord_tag: row.discord_tag || null,
          mc_uuid: row.mc_uuid || null
        };
      }
    } catch (dbErr) {
      console.warn('[Admin Player Search] Failed to fetch DB stats:', dbErr);
    }
  }

  let online = false;
  let coords = "離線";
  let tps = 20.0;
  try {
    const response = await sendWsQuery('player_status_query', { username });
    if (response && response.success) {
      online = response.online;
      coords = response.coords;
      tps = response.tps;
    }
  } catch (error: any) {
    console.warn('[Admin Player Search] Failed to fetch player status via WS:', error.message);
  }

  let inventory: any[] = [];
  try {
    const response = await sendWsQuery('player_inventory_query', { username });
    if (response && response.success) {
      inventory = response.items || [];
    }
  } catch (error: any) {
    console.warn('[Admin Player Search] Failed to fetch inventory via WS:', error.message);
  }

  res.json({
    success: true,
    profile: {
      mc_username: username,
      balance,
      online,
      coords,
      tps,
      ...dbStats
    },
    inventory
  });
});

// POST /api/admin/give-money
router.post('/give-money', async (req: CustomRequest, res: Response) => {
  const { username, amount } = req.body;
  if (!username || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ success: false, message: '請提供有效的目標玩家名稱與金額' });
  }
  try {
    try {
      await sendWsQuery('command_request', {
        command: `/addmoney "${username}" ${amount}`,
        admin_username: req.user?.mc_username || 'Web-Dashboard'
      }, 3000);
    } catch (wsErr) {}
    return res.json({ success: true, message: `已成功給予玩家 ${username} $${amount} 金幣！` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/give-keys
router.post('/give-keys', async (req: CustomRequest, res: Response) => {
  const { username, amount } = req.body;
  if (!username || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ success: false, message: '請提供有效的目標玩家名稱與鑰匙數量' });
  }
  try {
    if (db) {
      db.prepare('UPDATE bindings SET keys_count = keys_count + ? WHERE mc_username = ? COLLATE NOCASE').run(amount, username);
    }
    try {
      await sendWsQuery('give_keys', { username, amount }, 2000);
    } catch (wsErr) {}
    return res.json({ success: true, message: `已成功給予玩家 ${username} ${amount} 把抽獎鑰匙！` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/ban
router.post('/ban', async (req: CustomRequest, res: Response) => {
  const { player, reason } = req.body;
  if (!player || !reason) {
    return res.status(400).json({ success: false, message: '缺少玩家名稱或原因' });
  }
  try {
    const cmdRes = await sendWsQuery('command_request', {
      command: `/ban ${player} ${reason}`,
      admin_username: req.user?.mc_username || 'Web-Dashboard'
    });
    if (cmdRes && cmdRes.success) {
      return res.json({ success: true, message: `成功封鎖玩家 ${player}：${cmdRes.output || ''}` });
    } else {
      return res.status(400).json({ success: false, message: `封鎖失敗：${cmdRes?.output || '未知錯誤'}` });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/kick
router.post('/kick', async (req: CustomRequest, res: Response) => {
  const { player, reason } = req.body;
  if (!player || !reason) {
    return res.status(400).json({ success: false, message: '缺少玩家名稱或原因' });
  }
  try {
    const cmdRes = await sendWsQuery('command_request', {
      command: `/kick ${player} ${reason}`,
      admin_username: req.user?.mc_username || 'Web-Dashboard'
    });
    if (cmdRes && cmdRes.success) {
      return res.json({ success: true, message: `成功踢出玩家 ${player}：${cmdRes.output || ''}` });
    } else {
      return res.status(400).json({ success: false, message: `踢出失敗：${cmdRes?.output || '未知錯誤'}` });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/co-branding
router.post('/co-branding', async (req: CustomRequest, res: Response) => {
  const { player } = req.body;
  const target = player || req.body.target;
  if (!target) {
    return res.status(400).json({ success: false, message: '缺少目標玩家名稱或 Discord ID' });
  }

  if (!db) {
    return res.status(500).json({ success: false, message: '資料庫連線不可用' });
  }

  try {
    const binding = db.prepare('SELECT discord_id, mc_username FROM bindings WHERE discord_id = ? OR mc_username = ? COLLATE NOCASE').get(target, target) as any;
    if (!binding) {
      return res.status(404).json({ success: false, message: '找不到該玩家的綁定紀錄' });
    }

    const updateKeys = db.prepare('UPDATE bindings SET keys_count = keys_count + 6 WHERE discord_id = ?');
    updateKeys.run(binding.discord_id);

    let gameSuccess = false;
    let gameOutput = '';
    try {
      const cmdRes = await sendWsQuery('command_request', {
        command: `/addmoney ${binding.mc_username} 5000`,
        admin_username: req.user?.mc_username || 'Web-Dashboard'
      });
      gameSuccess = cmdRes && cmdRes.success;
      gameOutput = cmdRes?.output || '';
    } catch (err: any) {
      gameOutput = err.message;
    }

    return res.json({
      success: true,
      message: `成功發送聯名獎勵給 ${binding.mc_username}！遊戲內金幣加值結果：${gameSuccess ? '成功' : '失敗 (' + gameOutput + ')'}`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/tickets
router.get('/tickets', (req: CustomRequest, res: Response) => {
  if (!db) return res.status(500).json({ success: false, message: '資料庫未連結' });

  try {
    const search = req.query.search ? String(req.query.search).trim() : '';
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
    const offset = (page - 1) * limit;

    let query = 'SELECT id, ticket_id, channel_id, channel_name, creator_id, creator_username, closed_by, closed_at FROM ticket_history';
    const params: any[] = [];

    if (search) {
      query += ' WHERE (ticket_id LIKE ? OR creator_username LIKE ? OR creator_id LIKE ? OR channel_name LIKE ? OR closed_by LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params);

    let countQuery = 'SELECT COUNT(*) as total FROM ticket_history';
    const countParams: any[] = [];
    if (search) {
      countQuery += ' WHERE (ticket_id LIKE ? OR creator_username LIKE ? OR creator_id LIKE ? OR channel_name LIKE ? OR closed_by LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    const totalRow = db.prepare(countQuery).get(...countParams) as any;

    return res.json({
      success: true,
      tickets: rows,
      total: totalRow?.total || 0,
      page,
      limit
    });
  } catch (error: any) {
    console.error('Error fetching admin ticket history:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/tickets/:ticket_id
router.get('/tickets/:ticket_id', (req: CustomRequest, res: Response) => {
  const { ticket_id } = req.params;
  if (!db) return res.status(500).json({ success: false, message: '資料庫未連結' });

  try {
    const ticket = db.prepare('SELECT * FROM ticket_history WHERE ticket_id = ? OR id = ?').get(ticket_id, ticket_id) as any;
    if (!ticket) {
      return res.status(404).json({ success: false, message: '找不到該客服單紀錄' });
    }

    let parsedJson = [];
    if (ticket.transcript_json) {
      try {
        parsedJson = JSON.parse(ticket.transcript_json);
      } catch (e) {}
    }

    return res.json({
      success: true,
      ticket: {
        ...ticket,
        transcript_json: parsedJson
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/titles
router.post('/titles', async (req: CustomRequest, res: Response) => {
  const { username, title_text, color_code, is_bold } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: '請指定目標玩家名稱' });
  }
  if (!db) return res.status(500).json({ success: false, message: '資料庫連線不可用' });

  const cleanTitle = (title_text || '').trim();
  const cleanColor = color_code || '§c';
  const boldFlag = is_bold ? 1 : 0;

  try {
    if (!cleanTitle) {
      db.prepare('DELETE FROM player_titles WHERE username = ? COLLATE NOCASE').run(username);
    } else {
      db.prepare(`
        INSERT INTO player_titles (username, title_text, color_code, is_bold, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(username) DO UPDATE SET
          title_text = excluded.title_text,
          color_code = excluded.color_code,
          is_bold = excluded.is_bold,
          updated_at = CURRENT_TIMESTAMP
      `).run(username, cleanTitle, cleanColor, boldFlag);
    }

    try {
      if (botWsClient && botWsClient.readyState === 1) {
        botWsClient.send(JSON.stringify({
          type: 'update_player_titles',
          payload: {
            username,
            title_text: cleanTitle,
            color_code: cleanColor,
            is_bold: Boolean(boldFlag)
          }
        }));
      }
    } catch (wsErr) {
      console.warn('Failed to dispatch title update via WS:', wsErr);
    }

    res.json({
      success: true,
      message: cleanTitle ? `已成功設定玩家 ${username} 的專屬稱號！` : `已成功清除玩家 ${username} 的稱號！`
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE /api/admin/titles/:username
router.delete('/titles/:username', async (req: CustomRequest, res: Response) => {
  const { username } = req.params;
  if (!db) return res.status(500).json({ success: false, message: '資料庫連線不可用' });

  try {
    db.prepare('DELETE FROM player_titles WHERE username = ? COLLATE NOCASE').run(username);

    try {
      if (botWsClient && botWsClient.readyState === 1) {
        botWsClient.send(JSON.stringify({
          type: 'update_player_titles',
          payload: {
            username,
            title_text: '',
            color_code: '§c',
            is_bold: false
          }
        }));
      }
    } catch (e) {}

    res.json({ success: true, message: `已成功清除玩家 ${username} 的稱號！` });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/admin/transactions
router.get('/transactions', (req: CustomRequest, res: Response) => {
  if (!db) return res.status(500).json({ success: false, message: '資料庫未連結' });
  try {
    const search = req.query.search ? String(req.query.search).trim() : '';
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM transactions';
    const params: any[] = [];
    const conditions: string[] = [];

    if (search) {
      conditions.push('(buyer LIKE ? OR seller LIKE ? OR item LIKE ? OR shop_coords LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params);

    let countQuery = 'SELECT COUNT(*) as total FROM transactions';
    const countParams: any[] = [];
    if (search) {
      countQuery += ' WHERE (buyer LIKE ? OR seller LIKE ? OR item LIKE ? OR shop_coords LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    const totalRow = db.prepare(countQuery).get(...countParams) as any;

    return res.json({
      success: true,
      transactions: rows,
      total: totalRow?.total || 0,
      page,
      limit
    });
  } catch (error: any) {
    console.error('Error fetching admin transactions:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

import { botWsClient } from '../websocket/wsClient';

export default router;
