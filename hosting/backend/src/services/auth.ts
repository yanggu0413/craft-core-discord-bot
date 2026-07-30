import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/database';

export const ADMIN_DISCORD_ID = '1248891236480188517';

// User specified production JWT secret key
export const JWT_SECRET = process.env.JWT_SECRET || 'AexrbvISDoDxkMWFeNWgGHkKGcgqeZROnAZXsXeZTmg';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    discordId: string;
    username: string;
    avatar: string;
    role: 'USER' | 'ADMIN';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  };
}

// 🔴 Security: Check Instance Ownership (IDOR Prevention)
export function checkInstanceOwnership(instanceId: string, user: any): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const instance = db.prepare('SELECT user_id FROM instances WHERE id = ?').get(instanceId) as any;
  return Boolean(instance && instance.user_id === user.id);
}

export function generateToken(user: any): string {
  return jwt.sign(
    {
      id: user.id,
      discordId: user.discord_id,
      username: user.username,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.token;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/, '') : cookieToken;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // 🔴 Security Fix Issue #4: Query real-time status from DB to invalidate REJECTED/BANNED users
    const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id) as any;
    if (!dbUser || dbUser.status === 'REJECTED') {
      return res.status(403).json({ error: 'Account access has been rejected or revoked' });
    }

    req.user = {
      id: dbUser.id,
      discordId: dbUser.discord_id,
      username: dbUser.username,
      avatar: dbUser.avatar,
      role: dbUser.role,
      status: dbUser.status,
    };
    next();
  } catch (err) {
    const dbUser = db.prepare('SELECT * FROM users WHERE api_token = ?').get(token) as any;
    if (dbUser) {
      if (dbUser.status === 'REJECTED') {
        return res.status(403).json({ error: 'Account access has been rejected or revoked' });
      }

      req.user = {
        id: dbUser.id,
        discordId: dbUser.discord_id,
        username: dbUser.username,
        avatar: dbUser.avatar,
        role: dbUser.role,
        status: dbUser.status,
      };
      return next();
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function handleUserAuthentication(discordProfile: {
  id: string;
  username: string;
  avatar: string;
}) {
  const existing = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordProfile.id) as any;

  if (existing) {
    if (discordProfile.id === ADMIN_DISCORD_ID && (existing.role !== 'ADMIN' || existing.status !== 'APPROVED')) {
      db.prepare("UPDATE users SET role = 'ADMIN', status = 'APPROVED' WHERE id = ?").run(existing.id);
      existing.role = 'ADMIN';
      existing.status = 'APPROVED';
    }
    return existing;
  }

  const userId = `u-${Date.now().toString(36)}`;
  const role = discordProfile.id === ADMIN_DISCORD_ID ? 'ADMIN' : 'USER';
  const status = discordProfile.id === ADMIN_DISCORD_ID ? 'APPROVED' : 'PENDING';
  const avatarUrl = discordProfile.avatar
    ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png`
    : 'https://cdn.discordapp.com/embed/avatars/0.png';

  db.prepare(`
    INSERT INTO users (id, discord_id, username, avatar, role, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, discordProfile.id, discordProfile.username, avatarUrl, role, status, new Date().toISOString());

  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}
