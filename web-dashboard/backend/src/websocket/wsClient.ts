import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import WebSocket, { WebSocketServer } from 'ws';
// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

export const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_99881122';
export const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:8080';
export const WEBSOCKET_SECRET = process.env.WEBSOCKET_SECRET || 'c34fc25b90a6ea1d38e2bc79679fbc9d';
export const DATABASE_PATH = process.env.DATABASE_PATH ? path.resolve(__dirname, process.env.DATABASE_PATH) : path.resolve(__dirname, '../../../../discord-bot/src/database/database.db');

export interface CustomRequest extends Request {
  user?: {
    mc_uuid: string;
    mc_username: string;
    discord_id?: string;
    roles?: string[];
    profile?: {
      roles?: string[];
      isAdmin?: boolean;
    };
  };
}

export const ADMIN_DISCORD_IDS = new Set([
  '1248891236480188517',
  '1286603217056174080',
  '988642621834547260',
  '987308805719207966'
]);

// Database connection
export let db: DatabaseSync | null = null;
try {
  if (fs.existsSync(DATABASE_PATH)) {
    db = new DatabaseSync(DATABASE_PATH);
    console.log(`Connected to shared SQLite database at: ${DATABASE_PATH}`);
  } else {
    console.warn(`Database not found at ${DATABASE_PATH}, will fallback to memory DB`);
    db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS bindings (
        discord_id TEXT PRIMARY KEY,
        mc_uuid TEXT NOT NULL UNIQUE,
        mc_username TEXT NOT NULL COLLATE NOCASE,
        keys_count INTEGER DEFAULT 0,
        last_checkin TEXT,
        checkin_streak INTEGER DEFAULT 0,
        total_checkins INTEGER DEFAULT 0,
        subscribe_reminder INTEGER DEFAULT 0,
        exchanged_ticks INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  if (db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS offline_mails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_discord_id TEXT,
        sender_username TEXT,
        receiver_username TEXT,
        item_id TEXT,
        quantity INTEGER,
        nbt TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        shop_coords TEXT,
        buyer TEXT,
        seller TEXT,
        item TEXT,
        quantity INTEGER,
        unit_price REAL,
        tax_deducted REAL,
        net_profit REAL
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS server_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        reward_info TEXT,
        status TEXT DEFAULT 'active',
        creator_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS warp_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        applicant_username TEXT NOT NULL,
        applicant_discord_id TEXT,
        facility_name TEXT NOT NULL,
        function_desc TEXT NOT NULL,
        coords TEXT NOT NULL,
        dimension TEXT DEFAULT 'minecraft:overworld',
        status TEXT DEFAULT 'pending',
        admin_reviewer TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        scope TEXT,
        impact TEXT,
        publisher TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_titles (
        username TEXT PRIMARY KEY COLLATE NOCASE,
        title_text TEXT NOT NULL,
        color_code TEXT DEFAULT '§c',
        is_bold INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try {
      db.prepare(`
        INSERT OR IGNORE INTO player_titles (username, title_text, color_code, is_bold)
        VALUES ('im_little_rory', '[服主]', '§c', 1)
      `).run();
    } catch (e) {}
    try {
      db.exec('ALTER TABLE bindings ADD COLUMN discord_tag TEXT');
    } catch (e) {}
    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_bindings_username ON bindings(mc_username);
        CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer);
        CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller);
        CREATE INDEX IF NOT EXISTS idx_events_status ON server_events(status);
        CREATE INDEX IF NOT EXISTS idx_warp_subs_status ON warp_submissions(status);
      `);
    } catch (e) {}
  }
} catch (error) {
  console.error('Failed to initialize database connection', error);
}

// Global Memory Stats
export let accumulatedSalesTax = 0;
if (db) {
  try {
    const row = db.prepare('SELECT SUM(tax_deducted) as total FROM transactions').get() as any;
    accumulatedSalesTax = row?.total || 0;
  } catch (e) {
    accumulatedSalesTax = 0;
  }
}
export let totalShopsCount = 0;

// Web Frontend WebSocket Server instance
let wssInstance: WebSocketServer | null = null;
export function setWssInstance(wss: WebSocketServer) {
  wssInstance = wss;
}
export function broadcastToWebClients(data: any) {
  if (wssInstance) {
    wssInstance.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

// WebSocket Client to Discord Bot Bridge
export let botWsClient: WebSocket | null = null;
const pendingQueries = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();

export function connectToBotWS() {
  console.log(`Connecting to Discord Bot WS at: ${WEBSOCKET_URL}`);
  botWsClient = new WebSocket(WEBSOCKET_URL);

  botWsClient.on('open', () => {
    console.log('Connected to Discord Bot WS. Authenticating...');
    botWsClient?.send(JSON.stringify({
      type: 'auth',
      payload: {
        secret: WEBSOCKET_SECRET,
        role: 'web-dashboard'
      }
    }));
  });

  botWsClient.on('message', (data) => {
    try {
      const packet = JSON.parse(data.toString());
      const { type, payload } = packet;

      if (type.endsWith('_response') || type === 'error_response') {
        const queryId = payload?.query_id || payload?.command_id;
        if (queryId && pendingQueries.has(queryId)) {
          const pending = pendingQueries.get(queryId);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingQueries.delete(queryId);
            if (type === 'error_response') {
              pending.reject(new Error(payload.message || 'Query failed'));
            } else {
              pending.resolve(payload);
            }
          }
        }
      }

      if (type === 'transaction_log') {
        const log = payload;
        accumulatedSalesTax += log.tax_deducted || 0;

        if (db) {
          try {
            const insertTx = db.prepare('INSERT INTO transactions (shop_coords, buyer, seller, item, quantity, unit_price, tax_deducted, net_profit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            insertTx.run(log.shop_coords || log.coords || '', log.buyer, log.seller, log.item, log.quantity, log.unit_price, log.tax_deducted || 0, log.net_profit || 0);
          } catch (dbErr) {
            console.error('Failed to save transaction log to database:', dbErr);
          }
        }

        broadcastToWebClients({
          type: 'transaction_log',
          payload: log
        });
      }
    } catch (err) {
      console.error('Error parsing packet from Discord Bot WS', err);
    }
  });

  botWsClient.on('close', () => {
    console.warn('Discord Bot WS connection lost. Reconnecting in 3 seconds...');
    setTimeout(connectToBotWS, 3000);
  });

  botWsClient.on('error', (err) => {
    console.error('Discord Bot WS connection error:', err.message);
  });
}

export function sendWsQuery(type: string, payload: any, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!botWsClient || botWsClient.readyState !== WebSocket.OPEN) {
      return reject(new Error('遊戲伺服器連線已中斷'));
    }

    const queryId = payload.query_id || Math.random().toString(36).substring(2, 15);
    payload.query_id = queryId;
    if (type === 'command_request') {
      payload.command_id = queryId;
    }

    const timeout = setTimeout(() => {
      pendingQueries.delete(queryId);
      reject(new Error('查詢伺服器超時'));
    }, timeoutMs);

    pendingQueries.set(queryId, { resolve, reject, timeout });

    botWsClient.send(JSON.stringify({
      type,
      payload
    }));
  });
}

// In-Memory Cache
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const apiMemoryCache = new Map<string, CacheEntry<any>>();

export function getCachedData<T>(key: string): T | null {
  const entry = apiMemoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    apiMemoryCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedData<T>(key: string, data: T, ttlMs: number = 3000): void {
  apiMemoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs
  });
}

export function invalidateCachePattern(pattern: string): void {
  for (const key of apiMemoryCache.keys()) {
    if (key.includes(pattern)) {
      apiMemoryCache.delete(key);
    }
  }
}

// Middlewares re-exported from middleware/auth
export { authenticateToken, requireAdmin } from '../middleware/auth';


export async function sendEventAnnouncementToDiscord(event: any) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
  const roleId = process.env.DISCORD_EVENT_PING_ROLE_ID || '1360409328175153242';

  if (!token || !channelId) return;

  try {
    const payload = {
      content: `<@&${roleId}>`,
      embeds: [
        {
          title: `🎪 限時活動公告：${event.title}`,
          description: event.description,
          color: 15965202,
          fields: [
            { name: '🎁 活動獎勵說明', value: event.reward_info || '登入遊戲查看全服特別獎勵！' },
            { name: '📅 活動起訖時間', value: `${event.start_time || '即刻開始'} ~ ${event.end_time || '永久常駐'}` }
          ],
          footer: { text: `發布者: ${event.creator_name || 'Craft-Core 管理團隊'}` },
          timestamp: new Date().toISOString()
        }
      ],
      allowed_mentions: { roles: [roleId] }
    };

    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err: any) {
    console.error('Failed to send event announcement to Discord channel', err);
  }
}
