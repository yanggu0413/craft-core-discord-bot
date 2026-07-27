import { Router, Request, Response } from 'express';
import { sendWsQuery, ADMIN_DISCORD_IDS, CustomRequest } from '../websocket/wsClient';
import { authenticateToken } from '../middleware/auth';
import { loadConfigJson, saveConfigJson } from '../utils/configLoader';

const router = Router();

// GET /api/claims
router.get('/', async (req: Request, res: Response) => {
  let claims: any[] = [];
  let fetchedViaWs = false;

  try {
    const response = await sendWsQuery('claims_query', {});
    if (response && response.success && Array.isArray(response.claims) && response.claims.length > 0) {
      claims = response.claims;
      fetchedViaWs = true;
    }
  } catch (wsErr) {
    console.warn('[Claims Route] WebSocket query failed, falling back to local file:', wsErr);
  }

  if (fetchedViaWs) {
    return res.json({ success: true, claims });
  }

  // Fallback: Read claims.json from MCSManager / local paths
  try {
    const claimsMap = loadConfigJson<Record<string, any>>('claims.json');
    if (claimsMap && typeof claimsMap === 'object') {
      const claimsArray = Object.values(claimsMap);
      return res.json({ success: true, claims: claimsArray });
    }
    return res.json({ success: true, claims: [] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/claims/permission
router.post('/permission', authenticateToken, async (req: CustomRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: '尚未登入' });
  const username = user.mc_username;

  const { claimId, permissionType, player, action } = req.body;
  if (!claimId || !permissionType || !player || !action) {
    return res.status(400).json({ success: false, message: '缺少必要參數' });
  }

  const isAdmin = Boolean((user.discord_id && ADMIN_DISCORD_IDS.has(user.discord_id)) || user.profile?.isAdmin);
  let isOwnerOrAdmin = isAdmin;
  if (!isOwnerOrAdmin) {
    try {
      const response = await sendWsQuery('claims_query', {});
      const claims = response.claims || [];
      const targetClaim = claims.find((c: any) => c.id === claimId);
      if (targetClaim && targetClaim.owner.toLowerCase() === username.toLowerCase()) {
        isOwnerOrAdmin = true;
      }
    } catch (err) {
      const claimsMap = loadConfigJson<Record<string, any>>('claims.json');
      if (claimsMap && claimsMap[claimId]) {
        const targetClaim = claimsMap[claimId];
        if (targetClaim && targetClaim.owner.toLowerCase() === username.toLowerCase()) {
          isOwnerOrAdmin = true;
        }
      }
    }
  }

  if (!isOwnerOrAdmin) {
    return res.status(403).json({ success: false, message: '您無權修改此領地的權限（僅限領地擁有者或管理員修改）' });
  }

  try {
    const result = await sendWsQuery('claims_permission_update', {
      claimId,
      permissionType,
      player,
      action
    });
    if (result.success) {
      return res.json({ success: true, message: '權限更新成功' });
    } else {
      return res.status(400).json({ success: false, message: result.message || '更新失敗' });
    }
  } catch (error: any) {
    const claimsMap = loadConfigJson<Record<string, any>>('claims.json') || {};
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
      } else if (action === 'revoke') {
        claim.permissions[key] = claim.permissions[key].filter((p: string) => p !== player);
      }
      saveConfigJson('claims.json', claimsMap);
      return res.json({ success: true, message: '權限更新成功 (離線檔案更新)' });
    }
    return res.status(500).json({ success: false, message: error.message || '遊戲伺服器未連線' });
  }
});

// POST /api/claims/flags
router.post('/flags', authenticateToken, async (req: CustomRequest, res: Response) => {
  try {
    const { claim_id, public_containers, public_interact, public_entry, banned_players } = req.body;
    const username = req.user?.mc_username;
    const isAdmin = Boolean((req.user?.discord_id && ADMIN_DISCORD_IDS.has(req.user.discord_id)) || req.user?.profile?.isAdmin);

    try {
      const wsRes = await sendWsQuery('update_claim_flags', {
        username,
        claim_id,
        public_containers,
        public_interact,
        public_entry,
        banned_players,
        is_admin: isAdmin
      });
      return res.json(wsRes || { success: true, message: '領地權限標籤已設定完成！' });
    } catch (wsErr) {
      let claimsMap = loadConfigJson<Record<string, any>>('claims.json') || {};
      let claim = claimsMap[claim_id];
      if (!claim) {
        claim = {
          id: claim_id,
          owner: username || 'Unknown',
          public_containers: false,
          public_interact: false,
          public_entry: true,
          banned_players: []
        };
        claimsMap[claim_id] = claim;
      }

      if (claim.owner.toLowerCase() === (username || '').toLowerCase() || isAdmin) {
        if (typeof public_containers === 'boolean') claim.public_containers = public_containers;
        if (typeof public_interact === 'boolean') claim.public_interact = public_interact;
        if (typeof public_entry === 'boolean') claim.public_entry = public_entry;
        if (Array.isArray(banned_players)) claim.banned_players = banned_players;
        saveConfigJson('claims.json', claimsMap);
        return res.json({ success: true, message: '領地權限標籤已設定完成 (離線檔案更新)' });
      } else {
        return res.status(403).json({ success: false, message: '您無權修改此領地的標籤 (僅限領地擁有者或管理員)' });
      }
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
