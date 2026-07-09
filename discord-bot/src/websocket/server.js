const { WebSocketServer } = require('ws');
const config = require('../config');
const handler = require('./handler');
const session = require('./session');

let wss = null;

function start(discordClient) {
  wss = new WebSocketServer({ port: config.websocket.port });
  console.log(`WebSocket server listening on port ${config.websocket.port}`);

  wss.on('connection', (ws) => {
    let authenticated = false;

    ws.on('message', async (message) => {
      try {
        const packet = JSON.parse(message.toString());
        const { type, payload } = packet;

        if (!authenticated) {
          if (type === 'auth' && payload && payload.secret === config.websocket.secret) {
            authenticated = true;
            ws.isActive = true;
            session.setConnection(ws);
            ws.send(JSON.stringify({
              type: 'auth_response',
              payload: { success: true, message: 'Authentication successful' }
            }));
            console.log('Minecraft client authenticated.');
            const webhookService = require('../services/webhookService');
            webhookService.sendServerStart(discordClient).catch(err => console.error(err));
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
        console.error('Error handling WebSocket message:', error);
      }
    });
 
    ws.on('close', () => {
      if (session.getConnection() === ws) {
        session.setConnection(null);
        console.log('Minecraft client disconnected.');
        const webhookService = require('../services/webhookService');
        webhookService.sendServerStop(discordClient).catch(err => console.error(err));
      }
    });
  });
}

function stop() {
  if (wss) {
    wss.close();
    wss = null;
  }
}

module.exports = {
  start,
  stop
};
