"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const wsClient_1 = require("../websocket/wsClient");
const router = (0, express_1.Router)();
// GET /api/claims
router.get('/', async (req, res) => {
    const isAll = req.query.all === 'true';
    let claims = [];
    let fetchedViaWs = false;
    try {
        const response = await (0, wsClient_1.sendWsQuery)('claims_query', {});
        if (response && response.success) {
            claims = response.claims || [];
            fetchedViaWs = true;
        }
    }
    catch (wsErr) {
        console.warn('[Claims Route] WebSocket query failed, falling back to local file:', wsErr);
    }
    if (fetchedViaWs) {
        return res.json({ success: true, claims });
    }
    // Fallback: Read config/craft-core-shop/claims.json
    try {
        const possiblePaths = [
            path_1.default.resolve(__dirname, '../../../../config/craft-core-shop/claims.json'),
            path_1.default.resolve(__dirname, '../../../../../fabric-mod/config/craft-core-shop/claims.json'),
            path_1.default.resolve('config/craft-core-shop/claims.json')
        ];
        for (const p of possiblePaths) {
            if (fs_1.default.existsSync(p)) {
                const raw = fs_1.default.readFileSync(p, 'utf8');
                const claimsMap = JSON.parse(raw);
                const claimsArray = Object.values(claimsMap);
                return res.json({ success: true, claims: claimsArray });
            }
        }
        return res.json({ success: true, claims: [] });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/claims/permission
router.post('/permission', wsClient_1.authenticateToken, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: '尚未登入' });
    const username = user.mc_username;
    const { claimId, permissionType, player, action } = req.body;
    if (!claimId || !permissionType || !player || !action) {
        return res.status(400).json({ success: false, message: '缺少必要參數' });
    }
    const isAdmin = Boolean((user.discord_id && wsClient_1.ADMIN_DISCORD_IDS.has(user.discord_id)) || user.profile?.isAdmin);
    let isOwnerOrAdmin = isAdmin;
    if (!isOwnerOrAdmin) {
        try {
            const response = await (0, wsClient_1.sendWsQuery)('claims_query', {});
            const claims = response.claims || [];
            const targetClaim = claims.find((c) => c.id === claimId);
            if (targetClaim && targetClaim.owner.toLowerCase() === username.toLowerCase()) {
                isOwnerOrAdmin = true;
            }
        }
        catch (err) {
            try {
                const possiblePaths = [
                    path_1.default.resolve(__dirname, '../../../../config/craft-core-shop/claims.json'),
                    path_1.default.resolve(__dirname, '../../../../../fabric-mod/config/craft-core-shop/claims.json'),
                    path_1.default.resolve('config/craft-core-shop/claims.json')
                ];
                for (const p of possiblePaths) {
                    if (fs_1.default.existsSync(p)) {
                        const raw = fs_1.default.readFileSync(p, 'utf8');
                        const claimsMap = JSON.parse(raw);
                        const targetClaim = claimsMap[claimId];
                        if (targetClaim && targetClaim.owner.toLowerCase() === username.toLowerCase()) {
                            isOwnerOrAdmin = true;
                        }
                    }
                }
            }
            catch (fsErr) { }
        }
    }
    if (!isOwnerOrAdmin) {
        return res.status(403).json({ success: false, message: '您無權修改此領地的權限（僅限領地擁有者或管理員修改）' });
    }
    try {
        const result = await (0, wsClient_1.sendWsQuery)('claims_permission_update', {
            claimId,
            permissionType,
            player,
            action
        });
        if (result.success) {
            res.json({ success: true, message: '權限更新成功' });
        }
        else {
            res.status(400).json({ success: false, message: result.message || '更新失敗' });
        }
    }
    catch (error) {
        try {
            const possiblePaths = [
                path_1.default.resolve(__dirname, '../../../../config/craft-core-shop/claims.json'),
                path_1.default.resolve(__dirname, '../../../../../fabric-mod/config/craft-core-shop/claims.json'),
                path_1.default.resolve('config/craft-core-shop/claims.json')
            ];
            for (const p of possiblePaths) {
                if (fs_1.default.existsSync(p)) {
                    const raw = fs_1.default.readFileSync(p, 'utf8');
                    const claimsMap = JSON.parse(raw);
                    if (claimsMap[claimId]) {
                        const claim = claimsMap[claimId];
                        if (!claim.permissions) {
                            claim.permissions = { build: [], break: [], containers: [], interact: [] };
                        }
                        let key = permissionType === 'break' ? 'break' : permissionType;
                        if (!claim.permissions[key]) {
                            claim.permissions[key] = [];
                        }
                        if (action === 'grant') {
                            if (!claim.permissions[key].includes(player)) {
                                claim.permissions[key].push(player);
                            }
                        }
                        else if (action === 'revoke') {
                            claim.permissions[key] = claim.permissions[key].filter((p) => p !== player);
                        }
                        fs_1.default.writeFileSync(p, JSON.stringify(claimsMap, null, 2), 'utf8');
                        return res.json({ success: true, message: '權限更新成功 (本地備份)' });
                    }
                }
            }
        }
        catch (fsErr) {
            console.error('Failed to update claims fallback:', fsErr);
        }
        res.status(500).json({ success: false, message: error.message || '遊戲伺服器未連線' });
    }
});
// POST /api/claims/flags
router.post('/flags', wsClient_1.authenticateToken, async (req, res) => {
    try {
        const { claim_id, public_containers, public_interact, public_entry, banned_players } = req.body;
        const username = req.user?.mc_username;
        const isAdmin = Boolean((req.user?.discord_id && wsClient_1.ADMIN_DISCORD_IDS.has(req.user.discord_id)) || req.user?.profile?.isAdmin);
        try {
            const wsRes = await (0, wsClient_1.sendWsQuery)('update_claim_flags', {
                username,
                claim_id,
                public_containers,
                public_interact,
                public_entry,
                banned_players,
                is_admin: isAdmin
            });
            return res.json(wsRes || { success: true, message: '領地權限標籤已設定完成！' });
        }
        catch (wsErr) {
            const possiblePaths = [
                path_1.default.resolve(__dirname, '../../../../config/craft-core-shop/claims.json'),
                path_1.default.resolve(__dirname, '../../../../../fabric-mod/config/craft-core-shop/claims.json'),
                path_1.default.resolve('config/craft-core-shop/claims.json')
            ];
            for (const p of possiblePaths) {
                if (fs_1.default.existsSync(p)) {
                    const raw = fs_1.default.readFileSync(p, 'utf8');
                    const claimsMap = JSON.parse(raw);
                    const claim = claimsMap[claim_id];
                    if (claim) {
                        if (claim.owner.toLowerCase() === (username || '').toLowerCase() || isAdmin) {
                            if (typeof public_containers === 'boolean')
                                claim.public_containers = public_containers;
                            if (typeof public_interact === 'boolean')
                                claim.public_interact = public_interact;
                            if (typeof public_entry === 'boolean')
                                claim.public_entry = public_entry;
                            if (Array.isArray(banned_players))
                                claim.banned_players = banned_players;
                            fs_1.default.writeFileSync(p, JSON.stringify(claimsMap, null, 2), 'utf8');
                            return res.json({ success: true, message: '領地權限標籤已設定完成 (檔案更新)' });
                        }
                        else {
                            return res.status(403).json({ success: false, message: '您無權修改此領地的標籤 (僅限領地擁有者或管理員)' });
                        }
                    }
                }
            }
            return res.status(400).json({ success: false, message: '找不到該領地或無法通訊' });
        }
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
exports.default = router;
