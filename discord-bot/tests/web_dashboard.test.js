const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const { DatabaseSync: Database } = require('node:sqlite');
const MockMinecraftClient = require('./e2e/mock-minecraft-client');

const TIER = 'web_dashboard';
const PORT = 8087;
const DB_FILE = path.resolve(__dirname, `../db_${TIER}.db`);
const SCHEMA_FILE = path.resolve(__dirname, '../src/database/schema.sql');

let botProcess;
let mcClient;
let localDb;
let receivedDiscordEvents = [];

function waitForWsMessage(client, type, filterFn = () => true, timeout = 3000) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let timeoutId;
    const listener = (payload) => {
      const isMatch = filterFn(payload);
      if (isMatch) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        client.off(type, listener);
        resolve(payload);
      }
    };
    client.on(type, listener);
    timeoutId = setTimeout(() => {
      if (!resolved) {
        client.off(type, listener);
        reject(new Error(`Timeout waiting for WS packet: ${type}`));
      }
    }, timeout);
  });
}

beforeAll(async () => {
  await new Promise(r => setTimeout(r, 1000));
  if (fs.existsSync(DB_FILE)) {
    try { fs.unlinkSync(DB_FILE); } catch (e) {}
  }
  const db = new Database(DB_FILE);
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  db.exec(schema);
  db.close();

  localDb = new Database(DB_FILE);

  botProcess = spawn('node', [
    '-r', path.resolve(__dirname, './e2e/preload-mock.js'),
    'src/index.js'
  ], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_PATH: DB_FILE,
      WEBSOCKET_PORT: PORT.toString(),
      WEBSOCKET_SECRET: `secret_${TIER}`,
      DISCORD_TOKEN: 'mock_token'
    },
    cwd: path.resolve(__dirname, '../'),
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  });

  botProcess.on('message', (msg) => {
    if (msg && msg.type === 'DISCORD_EVENT') {
      receivedDiscordEvents.push(msg);
    }
  });

  await new Promise((resolve, reject) => {
    const onErr = (data) => {
      console.error('[BOT STARTUP STDERR]', data.toString().trim());
    };
    botProcess.stderr.on('data', onErr);

    let output = '';
    const onData = (data) => {
      output += data.toString();
      if (output.includes('WebSocket server listening')) {
        botProcess.stdout.off('data', onData);
        botProcess.stderr.off('data', onErr);
        resolve();
      }
    };
    botProcess.stdout.on('data', onData);
    botProcess.on('error', reject);
    setTimeout(() => {
      botProcess.stderr.off('data', onErr);
      reject(new Error('Bot failed to start: ' + output));
    }, 10000);
  });

  // Minecraft client connects to bot
  mcClient = new MockMinecraftClient(`ws://localhost:${PORT}`, `secret_${TIER}`);
  await mcClient.connect();
});

afterAll(async () => {
  if (mcClient) mcClient.close();
  if (botProcess) {
    if (botProcess.exitCode === null && !botProcess.killed) {
      botProcess.kill('SIGTERM');
      await new Promise((resolve) => {
        botProcess.on('exit', resolve);
      });
    }
  }
  if (localDb) localDb.close();
  if (fs.existsSync(DB_FILE)) {
    try { fs.unlinkSync(DB_FILE); } catch (e) {}
  }
});

describe('Web Dashboard Integration Bridge Tests', () => {

  test('1. Web Dashboard client can connect and authenticate successfully', async () => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    
    const authPromise = new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          payload: {
            secret: `secret_${TIER}`,
            role: 'web-dashboard'
          }
        }));
      });

      ws.on('message', (data) => {
        const packet = JSON.parse(data.toString());
        if (packet.type === 'auth_response') {
          resolve(packet.payload);
        }
      });

      setTimeout(() => reject(new Error('Timeout waiting for auth response')), 3000);
    });

    const res = await authPromise;
    expect(res.success).toBe(true);
    expect(res.message).toContain('Web Dashboard authenticated');
    ws.close();
  });

  test('2. Bidirectional message forwarding: query forwarded to MC, response forwarded to Web', async () => {
    // 1. Establish web client
    const webWs = new WebSocket(`ws://localhost:${PORT}`);
    await new Promise((resolve) => {
      webWs.on('open', () => {
        webWs.send(JSON.stringify({
          type: 'auth',
          payload: { secret: `secret_${TIER}`, role: 'web-dashboard' }
        }));
      });
      webWs.on('message', (data) => {
        const p = JSON.parse(data.toString());
        if (p.type === 'auth_response') resolve();
      });
    });

    // 2. Setup promises
    const mcQueryPromise = waitForWsMessage(mcClient, 'rich_list_query');
    const webResponsePromise = new Promise((resolve) => {
      webWs.on('message', (data) => {
        const p = JSON.parse(data.toString());
        if (p.type === 'rich_list_response') resolve(p.payload);
      });
    });

    // 3. Send query from web client
    const queryId = 'test-query-uuid-1234';
    webWs.send(JSON.stringify({
      type: 'rich_list_query',
      payload: { query_id: queryId, limit: 10 }
    }));

    // 4. Verify MC receives it
    const mcQuery = await mcQueryPromise;
    expect(mcQuery.query_id).toBe(queryId);
    expect(mcQuery.limit).toBe(10);

    // 5. Send response from MC
    const mockLeaderboard = [{ username: 'Developer', balance: 999999 }];
    mcClient.rich_list_response(queryId, mockLeaderboard, true);

    // 6. Verify web client receives response
    const webRes = await webResponsePromise;
    expect(webRes.success).toBe(true);
    expect(webRes.players[0].username).toBe('Developer');
    expect(webRes.players[0].balance).toBe(999999);

    webWs.close();
  });

  test('3. Real-time transaction_log broadcast is forwarded to Web Dashboard', async () => {
    // 1. Establish web client
    const webWs = new WebSocket(`ws://localhost:${PORT}`);
    await new Promise((resolve) => {
      webWs.on('open', () => {
        webWs.send(JSON.stringify({
          type: 'auth',
          payload: { secret: `secret_${TIER}`, role: 'web-dashboard' }
        }));
      });
      webWs.on('message', (data) => {
        const p = JSON.parse(data.toString());
        if (p.type === 'auth_response') resolve();
      });
    });

    const webBroadcastPromise = new Promise((resolve) => {
      webWs.on('message', (data) => {
        const p = JSON.parse(data.toString());
        if (p.type === 'transaction_log') resolve(p.payload);
      });
    });

    // 2. MC triggers broadcast
    mcClient.send({
      type: 'transaction_log',
      payload: {
        timestamp: Date.now(),
        shop_coords: '100,64,-200',
        buyer: 'BuyerPlayer',
        seller: 'SellerPlayer',
        item: 'minecraft:diamond',
        quantity: 5,
        unit_price: 500,
        tax_deducted: 125,
        net_profit: 2375
      }
    });

    // 3. Verify Web client received it
    const broadcast = await webBroadcastPromise;
    expect(broadcast.buyer).toBe('BuyerPlayer');
    expect(broadcast.seller).toBe('SellerPlayer');
    expect(broadcast.item).toBe('minecraft:diamond');
    expect(broadcast.quantity).toBe(5);

    webWs.close();
  });
});
