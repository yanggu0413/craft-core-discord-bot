import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
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

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
app.set('case sensitive routing', true);
const server = http.createServer(app);

app.use(cors());
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

// WebSocket Server for Web Frontend Real-time Events
const wss = new WebSocketServer({ server });
setWssInstance(wss);

wss.on('connection', (ws) => {
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
