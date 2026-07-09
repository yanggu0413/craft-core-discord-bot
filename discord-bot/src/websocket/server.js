const { WebSocketServer } = require('ws');
const { z } = require('zod');
const config = require('../config');
const handler = require('./handler');
const session = require('./session');
const logger = require('../utils/logger');
const webhookService = require('../services/webhookService');


let wss = null;
let heartbeatInterval = null;
const ipAttempts = new Map();

const authSchema = z.object({
  secret: z.string(),
  serverId: z.string().optional()
});

function start(discordClient) {
  wss = new WebSocketServer({ port: config.websocket.port });
  logger.info(`WebSocket server listening on port ${config.websocket.port}`);

  wss.on('connection', (ws, req) => {
    // 1. Rate Limiting: Max 5 connection attempts per minute per IP
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let attempts = ipAttempts.get(ip) || [];
    attempts = attempts.filter(time => now - time < 60000);
    if (attempts.length >= 5) {
      ws.close(1008, 'Rate limit exceeded');
      logger.info(`Connection rejected from ${ip} due to rate limiting`, { ip });
      return;
    }
    attempts.push(now);
    ipAttempts.set(ip, attempts);

    let authenticated = false;
    ws.isAlive = true;

    // Heartbeat pong listener
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (message) => {
      try {
        const packet = JSON.parse(message.toString());
        const { type, payload } = packet;

        if (!authenticated) {
          if (type === 'auth') {
            const parseResult = authSchema.safeParse(payload);
            if (parseResult.success && parseResult.data.secret === config.websocket.secret) {
              const serverId = parseResult.data.serverId || 'default';
              authenticated = true;
              ws.serverId = serverId;
              ws.isActive = true;
              session.setConnection(serverId, ws);
              ws.send(JSON.stringify({
                type: 'auth_response',
                payload: { success: true, message: 'Authentication successful' }
              }));
              logger.info('Minecraft client authenticated');
              webhookService.sendServerStart(discordClient).catch(err => logger.error('Failed to send server start webhook', { error: err }));
            } else {
              ws.send(JSON.stringify({
                type: 'auth_response',
                payload: { success: false, message: 'Authentication failed' }
              }));
              ws.close();
            }
          } else {
            ws.send(JSON.stringify({
              type: 'auth_response',
              payload: { success: false, message: 'Authentication failed' }
            }));
            ws.close();
          }
          return;
        }
 
        // Route authenticated packets
        await handler.handle(packet, discordClient);
      } catch (error) {
        logger.error('Error handling WebSocket message', { error });
      }
    });
 
    ws.on('close', () => {
      const serverId = ws.serverId || 'default';
      if (session.getConnection(serverId) === ws) {
        session.removeConnection(serverId);
        logger.info('Minecraft client disconnected');
        webhookService.sendServerStop(discordClient).catch(err => logger.error('Failed to send server stop webhook', { error: err }));
      }
    });
  });

  // Ping/Pong Heartbeat on 30s interval
  heartbeatInterval = setInterval(() => {
    if (wss) {
      wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          logger.info('Terminating dead connection...');
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }
    // Clean up ipAttempts Map to prevent memory leaks
    const now = Date.now();
    for (const [ip, attempts] of ipAttempts.entries()) {
      const validAttempts = attempts.filter(time => now - time < 60000);
      if (validAttempts.length === 0) {
        ipAttempts.delete(ip);
      } else {
        ipAttempts.set(ip, validAttempts);
      }
    }
  }, 30000);
  heartbeatInterval.unref();
}

function stop() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  ipAttempts.clear();
  if (wss) {
    // Terminate all active connections to prevent socket leaks during testing/teardown
    wss.clients.forEach((ws) => {
      ws.terminate();
    });
    wss.close();
    wss = null;
  }
}

module.exports = {
  start,
  stop
};
