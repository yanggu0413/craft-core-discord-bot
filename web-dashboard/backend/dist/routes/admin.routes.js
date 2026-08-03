"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const configLoader_1 = require("../utils/configLoader");
const wsClient_1 = require("../websocket/wsClient");
const router = (0, express_1.Router)();
function sanitizeCommandArg(val) {
    if (!val)
        return '';
    return String(val).replace(/[\r\n;"]/g, '').trim();
}
// Protect all routes with authentication and requireAdmin
router.use(wsClient_1.authenticateToken, wsClient_1.requireAdmin);
// GET /api/admin/player/:username
router.get('/player/:username', async (req, res) => {
    const { username } = req.params;
    if (!username) {
        return res.status(400).json({ success: false, message: '請提供玩家名稱' });
    }
    let balance = 0.0;
    try {
        const response = await (0, wsClient_1.sendWsQuery)('balance_query', { username });
        if (response && response.success) {
            balance = response.balance;
        }
    }
    catch (error) {
        console.warn('[Admin Player Search] Failed to fetch balance via WS:', error.message);
    }
    let dbStats = {};
    if (wsClient_1.db) {
        try {
            const row = wsClient_1.db.prepare('SELECT * FROM bindings WHERE mc_username = ? COLLATE NOCASE').get(username);
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
        }
        catch (dbErr) {
            console.warn('[Admin Player Search] Failed to fetch DB stats:', dbErr);
        }
    }
    let online = false;
    let coords = "離線";
    let tps = 20.0;
    try {
        const response = await (0, wsClient_1.sendWsQuery)('player_status_query', { username });
        if (response && response.success) {
            online = response.online;
            coords = response.coords;
            tps = response.tps;
        }
    }
    catch (error) {
        console.warn('[Admin Player Search] Failed to fetch player status via WS:', error.message);
    }
    let inventory = [];
    try {
        const response = await (0, wsClient_1.sendWsQuery)('player_inventory_query', { username });
        if (response && response.success) {
            inventory = response.items || [];
        }
    }
    catch (error) {
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
router.post('/give-money', async (req, res) => {
    const { username, amount } = req.body;
    const cleanUsername = sanitizeCommandArg(username);
    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (!cleanUsername || isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, message: '請提供有效的目標玩家名稱與金額' });
    }
    try {
        try {
            await (0, wsClient_1.sendWsQuery)('command_request', {
                command: `/addmoney ${cleanUsername} ${numAmount}`,
                admin_username: req.user?.mc_username || 'Web-Dashboard'
            }, 3000);
        }
        catch (wsErr) { }
        return res.json({ success: true, message: `已成功給予玩家 ${cleanUsername} $${numAmount} 金幣！` });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});
// POST /api/admin/give-keys
router.post('/give-keys', async (req, res) => {
    const { username, amount } = req.body;
    const cleanUsername = sanitizeCommandArg(username);
    const numAmount = typeof amount === 'number' ? amount : parseInt(amount, 10);
    if (!cleanUsername || isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, message: '請提供有效的目標玩家名稱與鑰匙數量' });
    }
    try {
        if (wsClient_1.db) {
            wsClient_1.db.prepare('UPDATE bindings SET keys_count = keys_count + ? WHERE mc_username = ? COLLATE NOCASE').run(numAmount, cleanUsername);
        }
        try {
            await (0, wsClient_1.sendWsQuery)('give_keys', { username: cleanUsername, amount: numAmount }, 2000);
        }
        catch (wsErr) { }
        return res.json({ success: true, message: `已成功給予玩家 ${cleanUsername} ${numAmount} 把抽獎鑰匙！` });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});
// POST /api/admin/ban
router.post('/ban', async (req, res) => {
    const { player, reason } = req.body;
    const cleanPlayer = sanitizeCommandArg(player);
    const cleanReason = sanitizeCommandArg(reason);
    if (!cleanPlayer || !cleanReason) {
        return res.status(400).json({ success: false, message: '缺少玩家名稱或原因' });
    }
    try {
        const cmdRes = await (0, wsClient_1.sendWsQuery)('command_request', {
            command: `/ban ${cleanPlayer} ${cleanReason}`,
            admin_username: req.user?.mc_username || 'Web-Dashboard'
        });
        if (cmdRes && cmdRes.success) {
            return res.json({ success: true, message: `成功封鎖玩家 ${cleanPlayer}：${cmdRes.output || ''}` });
        }
        else {
            return res.status(400).json({ success: false, message: `封鎖失敗：${cmdRes?.output || '未知錯誤'}` });
        }
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});
// POST /api/admin/kick
router.post('/kick', async (req, res) => {
    const { player, reason } = req.body;
    const cleanPlayer = sanitizeCommandArg(player);
    const cleanReason = sanitizeCommandArg(reason);
    if (!cleanPlayer || !cleanReason) {
        return res.status(400).json({ success: false, message: '缺少玩家名稱或原因' });
    }
    try {
        const cmdRes = await (0, wsClient_1.sendWsQuery)('command_request', {
            command: `/kick ${cleanPlayer} ${cleanReason}`,
            admin_username: req.user?.mc_username || 'Web-Dashboard'
        });
        if (cmdRes && cmdRes.success) {
            return res.json({ success: true, message: `成功踢出玩家 ${cleanPlayer}：${cmdRes.output || ''}` });
        }
        else {
            return res.status(400).json({ success: false, message: `踢出失敗：${cmdRes?.output || '未知錯誤'}` });
        }
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});
// POST /api/admin/co-branding
router.post('/co-branding', async (req, res) => {
    const { player } = req.body;
    const target = sanitizeCommandArg(player || req.body.target);
    if (!target) {
        return res.status(400).json({ success: false, message: '缺少目標玩家名稱或 Discord ID' });
    }
    if (!wsClient_1.db) {
        return res.status(500).json({ success: false, message: '資料庫連線不可用' });
    }
    try {
        const binding = wsClient_1.db.prepare('SELECT discord_id, mc_username FROM bindings WHERE discord_id = ? OR mc_username = ? COLLATE NOCASE').get(target, target);
        if (!binding) {
            return res.status(404).json({ success: false, message: '找不到該玩家的綁定紀錄' });
        }
        const updateKeys = wsClient_1.db.prepare('UPDATE bindings SET keys_count = keys_count + 6 WHERE discord_id = ?');
        updateKeys.run(binding.discord_id);
        let gameSuccess = false;
        let gameOutput = '';
        try {
            const cleanMcName = sanitizeCommandArg(binding.mc_username);
            const cmdRes = await (0, wsClient_1.sendWsQuery)('command_request', {
                command: `/addmoney ${cleanMcName} 5000`,
                admin_username: req.user?.mc_username || 'Web-Dashboard'
            });
            gameSuccess = cmdRes && cmdRes.success;
            gameOutput = cmdRes?.output || '';
        }
        catch (err) {
            gameOutput = err.message;
        }
        return res.json({
            success: true,
            message: `成功發送聯名獎勵給 ${binding.mc_username}！遊戲內金幣加值結果：${gameSuccess ? '成功' : '失敗 (' + gameOutput + ')'}`
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});
// GET /api/admin/transactions - Paginated transaction logs for admin audit
router.get('/transactions', (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '50'), 10)));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    if (!wsClient_1.db) {
        return res.json({ success: true, transactions: [], total: 0, page, limit });
    }
    try {
        let whereClause = '';
        let params = [];
        if (search) {
            whereClause = 'WHERE (sender LIKE ? OR receiver LIKE ? OR buyer LIKE ? OR seller LIKE ? OR item LIKE ? OR shop_coords LIKE ?)';
            const term = `%${search}%`;
            params = [term, term, term, term, term, term];
        }
        const countRow = wsClient_1.db.prepare(`SELECT COUNT(*) as cnt FROM transactions ${whereClause}`).get(...params);
        const total = countRow?.cnt || 0;
        const rows = wsClient_1.db.prepare(`
      SELECT id, timestamp, shop_coords as coords, buyer, seller, sender, receiver, item, quantity, unit_price as price, tax_deducted as tax, net_profit, total_price, type
      FROM transactions
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
        return res.json({
            success: true,
            transactions: rows || [],
            total,
            page,
            limit
        });
    }
    catch (error) {
        console.warn('[Admin Transactions] Query error:', error);
        return res.json({ success: true, transactions: [], total: 0, page, limit });
    }
});
// GET /api/admin/tickets
router.get('/tickets', (req, res) => {
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: '資料庫未連結' });
    try {
        const search = req.query.search ? String(req.query.search).trim() : '';
        const limit = Math.max(1, Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200));
        const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
        const offset = (page - 1) * limit;
        let query = 'SELECT id, ticket_id, channel_id, channel_name, creator_id, creator_username, closed_by, closed_at FROM tickets';
        const params = [];
        if (search) {
            query += ' WHERE (ticket_id LIKE ? OR creator_username LIKE ? OR creator_id LIKE ? OR channel_name LIKE ? OR closed_by LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const rows = wsClient_1.db.prepare(query).all(...params);
        let countQuery = 'SELECT COUNT(*) as total FROM tickets';
        const countParams = [];
        if (search) {
            countQuery += ' WHERE (ticket_id LIKE ? OR creator_username LIKE ? OR creator_id LIKE ? OR channel_name LIKE ? OR closed_by LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        const totalRow = wsClient_1.db.prepare(countQuery).get(...countParams);
        return res.json({
            success: true,
            tickets: rows,
            total: totalRow?.total || 0,
            page,
            limit
        });
    }
    catch (error) {
        console.error('Error fetching admin ticket history:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});
// GET /api/admin/tickets/:ticket_id
router.get('/tickets/:ticket_id', (req, res) => {
    const { ticket_id } = req.params;
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: '資料庫未連結' });
    try {
        const ticket = wsClient_1.db.prepare('SELECT * FROM tickets WHERE ticket_id = ? OR id = ?').get(ticket_id, ticket_id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: '找不到該客服單紀錄' });
        }
        let parsedJson = [];
        if (ticket.transcript_json) {
            try {
                parsedJson = JSON.parse(ticket.transcript_json);
            }
            catch (e) { }
        }
        return res.json({
            success: true,
            ticket: {
                ...ticket,
                transcript_json: parsedJson
            }
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/admin/titles
router.post('/titles', async (req, res) => {
    const { username, title_text, color_code, is_bold } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, message: '請指定目標玩家名稱' });
    }
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: '資料庫連線不可用' });
    const cleanTitle = (title_text || '').replace(/§[kr]/gi, '').trim().substring(0, 32);
    const cleanColor = color_code || '§c';
    const boldFlag = is_bold ? 1 : 0;
    try {
        if (!cleanTitle) {
            wsClient_1.db.prepare('DELETE FROM player_titles WHERE username = ? COLLATE NOCASE').run(username);
        }
        else {
            wsClient_1.db.prepare(`
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
            if (wsClient_2.botWsClient && wsClient_2.botWsClient.readyState === 1) {
                wsClient_2.botWsClient.send(JSON.stringify({
                    type: 'update_player_titles',
                    payload: {
                        username,
                        title_text: cleanTitle,
                        color_code: cleanColor,
                        is_bold: Boolean(boldFlag)
                    }
                }));
            }
        }
        catch (wsErr) {
            console.warn('Failed to dispatch title update via WS:', wsErr);
        }
        res.json({
            success: true,
            message: cleanTitle ? `已成功設定玩家 ${username} 的專屬稱號！` : `已成功清除玩家 ${username} 的稱號！`
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// DELETE /api/admin/titles/:username
router.delete('/titles/:username', async (req, res) => {
    const { username } = req.params;
    if (!wsClient_1.db)
        return res.status(500).json({ success: false, message: '資料庫連線不可用' });
    try {
        wsClient_1.db.prepare('DELETE FROM player_titles WHERE username = ? COLLATE NOCASE').run(username);
        try {
            if (wsClient_2.botWsClient && wsClient_2.botWsClient.readyState === 1) {
                wsClient_2.botWsClient.send(JSON.stringify({
                    type: 'update_player_titles',
                    payload: {
                        username,
                        title_text: '',
                        color_code: '§c',
                        is_bold: false
                    }
                }));
            }
        }
        catch (e) { }
        res.json({ success: true, message: `已成功清除玩家 ${username} 的稱號！` });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// DELETE /api/admin/warps/:name
router.delete('/warps/:name', async (req, res) => {
    const { name } = req.params;
    if (!name)
        return res.status(400).json({ success: false, message: '缺少地標名稱' });
    try {
        let warpsMap = (0, configLoader_1.loadConfigJson)('warps.json') || {};
        let foundKey = Object.keys(warpsMap).find(k => k.toLowerCase() === name.toLowerCase());
        if (foundKey) {
            delete warpsMap[foundKey];
            (0, configLoader_1.saveConfigJson)('warps.json', warpsMap);
            (0, wsClient_1.invalidateCachePattern)('warps_cache');
        }
        try {
            await (0, wsClient_1.sendWsQuery)('command_request', {
                command: `/warp remove "${name}"`,
                admin_username: req.user?.mc_username || 'Web-Dashboard'
            }, 3000);
        }
        catch (wsErr) { }
        return res.json({ success: true, message: `已成功刪除地標：「${name}」！` });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});
// POST /api/admin/warps/rename
router.post('/warps/rename', async (req, res) => {
    const { old_name, new_name } = req.body;
    if (!old_name || !new_name) {
        return res.status(400).json({ success: false, message: '缺少原名稱或新名稱' });
    }
    try {
        let warpsMap = (0, configLoader_1.loadConfigJson)('warps.json') || {};
        let foundKey = Object.keys(warpsMap).find(k => k.toLowerCase() === old_name.toLowerCase());
        if (foundKey) {
            const warpObj = warpsMap[foundKey];
            delete warpsMap[foundKey];
            warpObj.name = new_name;
            warpsMap[new_name] = warpObj;
            (0, configLoader_1.saveConfigJson)('warps.json', warpsMap);
            (0, wsClient_1.invalidateCachePattern)('warps_cache');
        }
        try {
            await (0, wsClient_1.sendWsQuery)('command_request', {
                command: `/warp rename "${old_name}" "${new_name}"`,
                admin_username: req.user?.mc_username || 'Web-Dashboard'
            }, 3000);
        }
        catch (wsErr) { }
        return res.json({ success: true, message: `地標已成功由「${old_name}」更名為「${new_name}」！` });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});
// POST /api/admin/warps/type
router.post('/warps/type', async (req, res) => {
    const { name, type } = req.body;
    if (!name || !type) {
        return res.status(400).json({ success: false, message: '缺少地標名稱或類型' });
    }
    try {
        let warpsMap = (0, configLoader_1.loadConfigJson)('warps.json') || {};
        let foundKey = Object.keys(warpsMap).find(k => k.toLowerCase() === name.toLowerCase());
        if (foundKey) {
            warpsMap[foundKey].type = type; // 'machine' vs 'normal'
            (0, configLoader_1.saveConfigJson)('warps.json', warpsMap);
            (0, wsClient_1.invalidateCachePattern)('warps_cache');
        }
        return res.json({ success: true, message: `地標「${name}」類別已設定為 ${type === 'machine' ? '認證機器設施' : '普通公共地標'}！` });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});
// POST /api/admin/warp-submissions/:id/approve & /api/admin/machine-submissions/:id/approve
const handleApproveSubmission = async (req, res) => {
    const { id } = req.params;
    const { warp_name, is_machine } = req.body;
    try {
        let sub = null;
        if (wsClient_1.db) {
            try {
                sub = wsClient_1.db.prepare('SELECT * FROM warp_submissions WHERE id = ?').get(id);
            }
            catch (e) { }
        }
        const finalWarpName = (warp_name || sub?.facility_name || `facility_${id}`).trim();
        const isMachine = is_machine !== undefined ? Boolean(is_machine) : true;
        if (wsClient_1.db) {
            try {
                wsClient_1.db.prepare('UPDATE warp_submissions SET status = ?, warp_name = ? WHERE id = ?').run('approved', finalWarpName, id);
            }
            catch (e) { }
        }
        // Add to warps.json
        let warpsMap = (0, configLoader_1.loadConfigJson)('warps.json') || {};
        warpsMap[finalWarpName] = {
            name: finalWarpName,
            owner: sub?.applicant_username || 'System',
            coords: sub?.coords || '0 64 0',
            dimension: sub?.dimension || 'minecraft:overworld',
            type: isMachine ? 'machine' : 'normal',
            desc: sub?.function_desc || '',
            created_at: new Date().toISOString()
        };
        (0, configLoader_1.saveConfigJson)('warps.json', warpsMap);
        (0, wsClient_1.invalidateCachePattern)('warps_cache');
        // If machine, add to machines.json
        if (isMachine) {
            let machinesMap = (0, configLoader_1.loadConfigJson)('machines.json') || {};
            machinesMap[finalWarpName] = {
                name: finalWarpName,
                owner: sub?.applicant_username || 'System',
                coords: sub?.coords || '0 64 0',
                desc: sub?.function_desc || '',
                verified_at: new Date().toISOString()
            };
            (0, configLoader_1.saveConfigJson)('machines.json', machinesMap);
        }
        try {
            await (0, wsClient_1.sendWsQuery)('command_request', {
                command: `/warp set "${finalWarpName}" ${sub?.coords || ''}`,
                admin_username: req.user?.mc_username || 'Web-Dashboard'
            }, 3000);
        }
        catch (wsErr) { }
        return res.json({ success: true, message: `已成功核准機器/設施申請，並發布為地標：「${finalWarpName}」！` });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
// POST /api/admin/warp-submissions/:id/reject & /api/admin/machine-submissions/:id/reject
const handleRejectSubmission = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
        if (wsClient_1.db) {
            try {
                wsClient_1.db.prepare('UPDATE warp_submissions SET status = ?, reject_reason = ? WHERE id = ?').run('rejected', reason || '未符合設施規範', id);
            }
            catch (e) { }
        }
        return res.json({ success: true, message: `已成功駁回設施/機器申請。` });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
router.post('/warp-submissions/:id/approve', handleApproveSubmission);
router.post('/machine-submissions/:id/approve', handleApproveSubmission);
router.post('/warp-submissions/:id/reject', handleRejectSubmission);
router.post('/machine-submissions/:id/reject', handleRejectSubmission);
const wsClient_2 = require("../websocket/wsClient");
exports.default = router;
