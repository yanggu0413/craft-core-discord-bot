import { Request, Response, NextFunction } from 'express';
import { verifyToken, UserPayload } from '../services/auth.service';
import { ADMIN_DISCORD_IDS } from '../websocket/wsClient';

export interface CustomRequest extends Request {
  user?: UserPayload;
}

/**
 * Authentication middleware verifying Bearer tokens
 */
export function authenticateToken(req: CustomRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token: string | undefined;

  if (authHeader) {
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  // Fallback check: query param token or x-access-token header
  if (!token && typeof req.query.token === 'string') {
    token = req.query.token;
  }
  if (!token && typeof req.headers['x-access-token'] === 'string') {
    token = req.headers['x-access-token'] as string;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: '尚未登入，請先進行身份驗證' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ success: false, message: '認證憑證無效或已過期' });
  }

  req.user = user;
  next();
}

/**
 * Authorization middleware ensuring user has admin privileges
 */
export function requireAdmin(req: CustomRequest, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: '尚未登入，請先進行身份驗證' });
  }

  const isAdmin = Boolean(
    user.profile?.isAdmin ||
    (user.discord_id && ADMIN_DISCORD_IDS.has(user.discord_id))
  );

  if (!isAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden: 您不是系統管理員' });
  }

  next();
}
