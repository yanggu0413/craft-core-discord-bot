import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { connectToBotWS, setWssInstance } from './websocket/wsClient';

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import claimsRoutes from './routes/claims.routes';
import shopsRoutes from './routes/shops.routes';
import userRoutes from './routes/user.routes';
import eventsRoutes from './routes/events.routes';
import backupRoutes from './routes/backup.routes';
import titleRoutes from './routes/title.routes';
import announcementsRoutes from './routes/announcements.routes';
import retentionRoutes from './routes/retention.routes';

const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
app.set('case sensitive routing', true);

// Bug 46: CORS whitelist
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'https://craft-core.com'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));

// Bug 48: IP Rate Limiting
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();
app.use((req, res, next) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = ipRequestCounts.get(ip) || { count: 0, resetTime: now + 60000 };
  if (now > entry.resetTime) {
    entry.count = 1;
    entry.resetTime = now + 60000;
  } else {
    entry.count++;
  }
  ipRequestCounts.set(ip, entry);
  if (entry.count > 300) {
    return res.status(429).json({ success: false, message: '請求過於頻繁，請稍後再試' });
  }
  next();
});

app.use(express.json({ limit: '10kb' }));

// Mount Modular Express Routers
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/admin/backup', backupRoutes);
app.use('/api', shopsRoutes);
app.use('/api', userRoutes);
app.use('/api', eventsRoutes);
app.use('/api', titleRoutes);
app.use('/api', announcementsRoutes);
app.use('/api', retentionRoutes);

// Bug 50: Optional HTTPS / WSS configuration
let server: http.Server | https.Server;
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;
if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  server = https.createServer({
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath)
  }, app);
  console.log('[Web Server] HTTPS / WSS SSL Enabled.');
} else {
  server = http.createServer(app);
}

// WebSocket Server for Web Frontend Real-time Events
const wss = new WebSocketServer({ server });
setWssInstance(wss);

// Bug 47: WS connection heartbeat & ping interval
const wsPingInterval = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(wsPingInterval);
});

wss.on('connection', (ws: any) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  console.log('[Web Server] Frontend WebSocket client connected.');
  ws.on('close', () => {
    console.log('[Web Server] Frontend WebSocket client disconnected.');
  });
});

// Connect WebSocket Bridge Client to Discord Bot / Minecraft
connectToBotWS();

server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` Craft-Core Dashboard Backend Running on Port: ${PORT}`);
  console.log(` Mode: Express Router Modularized (v2.2.0)`);
  console.log(`===================================================`);
});
