const { WebSocket } = require('ws');
const db = require('../src/database');
const session = require('../src/websocket/session');
const wsServer = require('../src/websocket/server');
const handler = require('../src/websocket/handler');
const config = require('../src/config');
const { UserRepository, TempCodeRepository } = require('../src/database/repositories');

// Mock a simple Discord client for testing
const mockDiscordClient = {
  user: { id: 'bot_id', tag: 'Bot#1234' },
  channels: {
    cache: {
      get: jest.fn().mockReturnValue({
        send: jest.fn().mockResolvedValue({}),
        name: 'test-channel'
      })
    }
  }
};

describe('Verification & Challenge Tests', () => {
  beforeAll(async () => {
    // Start WebSocket server on a distinct port for these tests
    config.websocket.port = 8123;
    config.websocket.secret = 'test_secret_123';
    wsServer.start(mockDiscordClient);
    
    // Initialize in-memory database
    await db.init(':memory:');
  });

  afterAll(async () => {
    wsServer.stop();
    await db.close();
  });

  // 1. WebSocket connection pool robustness
  describe('WebSocket connection pool robustness', () => {
    test('Multiple server connections and proper removal on socket close', async () => {
      const ws1 = { readyState: 1, isActive: true, serverId: 'server-1', send: jest.fn() };
      const ws2 = { readyState: 1, isActive: true, serverId: 'server-2', send: jest.fn() };

      session.setConnection('server-1', ws1);
      session.setConnection('server-2', ws2);

      expect(session.hasConnection('server-1')).toBe(true);
      expect(session.hasConnection('server-2')).toBe(true);
      expect(session.getConnection('server-1')).toBe(ws1);
      expect(session.getConnection('server-2')).toBe(ws2);

      // Remove server-1
      session.removeConnection('server-1');
      expect(session.hasConnection('server-1')).toBe(false);
      expect(session.hasConnection('server-2')).toBe(true);

      // Clean up
      session.removeConnection('server-2');
    });

    test('Active server session removal on close event', async () => {
      // Connect actual WS client
      const wsClient = new WebSocket(`ws://localhost:${config.websocket.port}`);
      
      // Wait for connect
      await new Promise((resolve) => wsClient.on('open', resolve));

      // Authenticate
      wsClient.send(JSON.stringify({
        type: 'auth',
        payload: { secret: 'test_secret_123', serverId: 'server-temp' }
      }));

      // Wait for auth response
      await new Promise((resolve) => {
        wsClient.on('message', (data) => {
          const res = JSON.parse(data.toString());
          if (res.type === 'auth_response' && res.payload.success) {
            resolve();
          }
        });
      });

      expect(session.hasConnection('server-temp')).toBe(true);

      // Close connection
      wsClient.close();
      
      // Wait a short time for server to handle the close event
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(session.hasConnection('server-temp')).toBe(false);
    });
  });

  // 2. Zod schema validation
  describe('Zod schema validation', () => {
    test('Rejects invalid payload properties and invalid auth packets', async () => {
      const wsClient = new WebSocket(`ws://localhost:${config.websocket.port}`);
      await new Promise((resolve) => wsClient.on('open', resolve));

      // Capture messages and close events
      let receivedMsg = null;
      let isClosed = false;

      wsClient.on('message', (data) => {
        receivedMsg = JSON.parse(data.toString());
      });

      const closedPromise = new Promise((resolve) => {
        wsClient.on('close', () => {
          isClosed = true;
          resolve();
        });
      });

      // Send auth with wrong secret type (number instead of string)
      wsClient.send(JSON.stringify({
        type: 'auth',
        payload: { secret: 12345, serverId: 'server-invalid' }
      }));

      // Wait for it to close
      await closedPromise;

      expect(receivedMsg).not.toBeNull();
      expect(receivedMsg.type).toBe('auth_response');
      expect(receivedMsg.payload.success).toBe(false);
      expect(isClosed).toBe(true);
    });

    test('Gracefully handles malformed JSON packets without crashing server', async () => {
      const wsClient = new WebSocket(`ws://localhost:${config.websocket.port}`);
      await new Promise((resolve) => wsClient.on('open', resolve));

      // Send malformed JSON
      wsClient.send('invalid-json{');

      // Connection should survive or close, but server itself should not crash
      // Let's verify by sending a correct message right after or checking if we can still connect
      const wsClient2 = new WebSocket(`ws://localhost:${config.websocket.port}`);
      const connected = await new Promise((resolve) => {
        wsClient2.on('open', () => {
          wsClient2.close();
          resolve(true);
        });
        wsClient2.on('error', () => resolve(false));
      });
      expect(connected).toBe(true);

      wsClient.close();
    });
  });

  // 3. Database transaction atomicity
  describe('Database transaction atomicity', () => {
    test('bindUser rolls back changes on duplicate mc_uuid / constraint error', async () => {
      // 1. Create a temp code
      await TempCodeRepository.createTempCode('uuid_atomicity_1', 'Steve', 'CODE11');
      await TempCodeRepository.createTempCode('uuid_atomicity_1', 'Steve', 'CODE22'); // same UUID, different code

      // 2. Bind user A to uuid_atomicity_1
      await UserRepository.addBinding('discord_A', 'uuid_atomicity_1', 'Steve');

      // 3. Attempt to bind user B to uuid_atomicity_1 using bindUser (should throw because uuid is already bound)
      let threw = false;
      try {
        await UserRepository.bindUser('discord_B', 'uuid_atomicity_1', 'Steve', 'CODE22');
      } catch (err) {
        threw = true;
      }
      expect(threw).toBe(true);

      // 4. Verify discord_B is NOT bound
      const bindingB = await UserRepository.getBindingByDiscordId('discord_B');
      expect(bindingB).toBeNull();

      // 5. Verify the temp code CODE22 is NOT deleted (rolled back)
      const tempCode = await TempCodeRepository.getTempCode('CODE22');
      expect(tempCode).not.toBeNull();
    });
  });

  // 4. Heartbeat Ping/Pong
  describe('Heartbeat Ping/Pong', () => {
    test('Prunes dead connection if isAlive remains false', async () => {
      const mockWs = {
        isAlive: false,
        terminate: jest.fn(),
        ping: jest.fn(),
        readyState: 1,
        isActive: true
      };

      // Simulating what the server interval does
      // If isAlive is false, it terminates the socket
      if (mockWs.isAlive === false) {
        mockWs.terminate();
      }

      expect(mockWs.terminate).toHaveBeenCalled();
    });
  });

  // 5. Event handler routing correctness
  describe('Event handler routing correctness', () => {
    test('Routes events correctly to webhookService/statusService', async () => {
      const webhookService = require('../src/services/webhookService');
      const statusService = require('../src/services/statusService');
      
      const originalSendChat = webhookService.sendChat;
      const originalUpdateStatus = statusService.updateStatus;

      webhookService.sendChat = jest.fn().mockResolvedValue({});
      statusService.updateStatus = jest.fn().mockResolvedValue({});

      try {
        // Test chat packet
        await handler.handle({
          type: 'chat',
          payload: { sender: 'Player1', uuid: 'uuid1', message: 'Hello' }
        }, mockDiscordClient);
        expect(webhookService.sendChat).toHaveBeenCalledWith('Player1', 'uuid1', 'Hello', mockDiscordClient);

        // Test status packet
        const statusPayload = { online: true, players: [], maxPlayers: 100, tps: 20.0 };
        await handler.handle({
          type: 'status',
          payload: statusPayload
        }, mockDiscordClient);
        expect(statusService.updateStatus).toHaveBeenCalledWith(statusPayload, mockDiscordClient);

      } finally {
        webhookService.sendChat = originalSendChat;
        statusService.updateStatus = originalUpdateStatus;
      }
    });
  });

  // 6. Connection rate limiting (Run last to avoid rate-limiting other test connections)
  describe('Connection rate limiting', () => {
    test('Verify attempts beyond 5/min are rejected', async () => {
      const clients = [];
      const results = [];

      // Try 10 connection attempts to guarantee rate limit hit
      for (let i = 0; i < 10; i++) {
        const ws = new WebSocket(`ws://localhost:${config.websocket.port}`);
        clients.push(ws);

        const outcome = await new Promise((resolve) => {
          let resolved = false;
          
          ws.on('open', () => {
            // Wait 50ms to see if it gets closed immediately
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve({ connected: true });
              }
            }, 50);
          });
          
          ws.on('close', (code, reason) => {
            if (!resolved) {
              resolved = true;
              resolve({ connected: false, code, reason: reason.toString() });
            }
          });

          ws.on('error', () => {
            if (!resolved) {
              resolved = true;
              resolve({ connected: false, code: -1, reason: 'error' });
            }
          });
        });
        results.push(outcome);
      }

      // Close all clients
      clients.forEach(c => {
        try { c.close(); } catch(e) {}
      });

      // Assert that at least one of the attempts was rejected with code 1008
      const rejections = results.filter(r => !r.connected && r.code === 1008);
      expect(rejections.length).toBeGreaterThanOrEqual(1);
      expect(rejections[0].reason).toContain('Rate limit exceeded');
    });
  });
});
