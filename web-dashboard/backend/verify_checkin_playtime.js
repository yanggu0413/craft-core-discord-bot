const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');
const WebSocket = require('ws');

const PORT = 54321;
const WS_PORT = 54322;
const JWT_SECRET = 'test_secret_key_123';
const DATABASE_PATH = path.resolve(__dirname, 'temp_test_checkin.db');

// helper function to calculate Taipei date strings
function getTaipeiDateString(date = new Date()) {
  const options = { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('zh-TW', options);
  const formatted = formatter.format(date);
  return formatted.replace(/\//g, '-');
}

function getTaipeiYesterdayDateString(date = new Date()) {
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getTaipeiDateString(yesterday);
}

// Clean any pre-existing temp DB
if (fs.existsSync(DATABASE_PATH)) {
  try {
    fs.unlinkSync(DATABASE_PATH);
  } catch (err) {}
}

// Setup DB schema & Seed player
const db = new DatabaseSync(DATABASE_PATH);
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
db.exec(`
  CREATE TABLE IF NOT EXISTS offline_mails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_discord_id TEXT NOT NULL,
    sender_username TEXT NOT NULL,
    receiver_username TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    nbt TEXT,
    status TEXT DEFAULT 'pending',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const insertStmt = db.prepare('INSERT INTO bindings (discord_id, mc_uuid, mc_username, keys_count) VALUES (?, ?, ?, ?)');
insertStmt.run('123456789012345678', 'test-uuid-1111', 'TestPlayer', 10);
db.close();

console.log('Seeded temp_test_checkin.db with TestPlayer (keys_count = 10)');

// Start Mock WS Server (Bot emulator)
const wss = new WebSocket.Server({ port: WS_PORT });
let mockPlaytime = 1000000; // default playtime tick value
let lastDeductedTicks = 0;
let lastWsClient = null;

wss.on('connection', (ws) => {
  lastWsClient = ws;
  console.log('[Mock WS] Client connected');
  ws.on('message', (message) => {
    try {
      const packet = JSON.parse(message.toString());
      const { type, payload } = packet;
      console.log(`[Mock WS] Received packet: type=${type}`, payload);

      if (type === 'auth') {
        ws.send(JSON.stringify({
          type: 'auth_response',
          payload: { success: true }
        }));
      } else if (type === 'player_status_query') {
        ws.send(JSON.stringify({
          type: 'player_status_response',
          payload: {
            query_id: payload.query_id,
            username: payload.username,
            online: true,
            success: true
          }
        }));
      } else if (type === 'command_request') {
        const cmd = payload.command;
        if (cmd.includes('scoreboard players get')) {
          ws.send(JSON.stringify({
            type: 'command_response',
            payload: {
              query_id: payload.query_id,
              success: true,
              output: `TestPlayer has ${mockPlaytime} play_time`
            }
          }));
        } else if (cmd.includes('scoreboard players remove')) {
          const parts = cmd.split(' ');
          const deductAmount = parseInt(parts[parts.length - 1], 10);
          lastDeductedTicks = deductAmount;
          mockPlaytime -= deductAmount;
          ws.send(JSON.stringify({
            type: 'command_response',
            payload: {
              query_id: payload.query_id,
              success: true,
              output: `Removed ${deductAmount} scoreboard ticks`
            }
          }));
        } else {
          // Other commands (e.g. give, title, playsound)
          ws.send(JSON.stringify({
            type: 'command_response',
            payload: {
              query_id: payload.query_id,
              success: true,
              output: 'Command executed successfully'
            }
          }));
        }
      }
    } catch (err) {
      console.error('[Mock WS] Error parsing message', err);
    }
  });
});

// Spawn the backend server
const env = {
  ...process.env,
  PORT: PORT.toString(),
  JWT_SECRET: JWT_SECRET,
  DATABASE_PATH: DATABASE_PATH,
  WEBSOCKET_URL: `ws://localhost:${WS_PORT}`,
  WEBSOCKET_SECRET: 'secret_test'
};

const serverProcess = spawn('node', [path.resolve(__dirname, 'dist/server.js')], { env });

serverProcess.stdout.on('data', (data) => {
  console.log(`[Server stdout] ${data}`);
});

serverProcess.stderr.on('data', (data) => {
  console.error(`[Server stderr] ${data}`);
});

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data,
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  // Wait 3 seconds for server to spin up & connect to WebSocket
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('\n=========================================');
  console.log('  STARTING CHECK-IN & PLAYTIME VERIFICATION');
  console.log('=========================================');

  let exitCode = 0;

  const playerToken = jwt.sign({
    mc_uuid: 'test-uuid-1111',
    mc_username: 'TestPlayer',
    discord_id: '123456789012345678',
    roles: []
  }, JWT_SECRET, { expiresIn: '1h' });

  try {
    const todayStr = getTaipeiDateString();
    const yesterdayStr = getTaipeiYesterdayDateString();

    // -------------------------------------------------------------
    // TEST 1: Initial check-in (should succeed)
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: First check-in of the day ---');
    const resCheckin1 = await request('POST', '/api/user/checkin', { 'Authorization': `Bearer ${playerToken}` });
    console.log(`Status: ${resCheckin1.statusCode}, Response:`, resCheckin1.body);
    
    if (resCheckin1.statusCode === 200 && resCheckin1.body.success === true) {
      console.log('PASS: Check-in succeeded');
      if (resCheckin1.body.checkin_streak === 1 && resCheckin1.body.keys_count === 11 && resCheckin1.body.last_checkin === todayStr) {
        console.log('PASS: Streak, key count, and last_checkin are correct');
      } else {
        console.error('FAIL: Unexpected streak/keys/last_checkin values', resCheckin1.body);
        exitCode = 1;
      }
    } else {
      console.error('FAIL: Expected 200 OK, got', resCheckin1.statusCode);
      exitCode = 1;
    }

    // Check database state
    const dbCheck1 = new DatabaseSync(DATABASE_PATH);
    const rowCheck1 = dbCheck1.prepare('SELECT last_checkin, checkin_streak, keys_count FROM bindings WHERE mc_username = ?').get('TestPlayer');
    dbCheck1.close();
    console.log('Database state:', rowCheck1);
    if (rowCheck1.last_checkin === todayStr && rowCheck1.checkin_streak === 1 && rowCheck1.keys_count === 11) {
      console.log('PASS: Database state verified');
    } else {
      console.error('FAIL: Database values are mismatching');
      exitCode = 1;
    }

    // -------------------------------------------------------------
    // TEST 2: Second check-in on the same day (should block)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Duplicate check-in on the same day ---');
    const resCheckin2 = await request('POST', '/api/user/checkin', { 'Authorization': `Bearer ${playerToken}` });
    console.log(`Status: ${resCheckin2.statusCode}, Response:`, resCheckin2.body);

    if (resCheckin2.statusCode === 400 && resCheckin2.body.success === false) {
      console.log('PASS: Correctly blocked duplicate check-in');
      if (resCheckin2.body.message.includes('今天已經簽到過囉')) {
        console.log('PASS: Correct block message received');
      } else {
        console.warn('WARNING: Unexpected block message:', resCheckin2.body.message);
      }
    } else {
      console.error('FAIL: Expected 400 Bad Request, got', resCheckin2.statusCode);
      exitCode = 1;
    }

    // -------------------------------------------------------------
    // TEST 3: Consecutive days check-in (simulate rolling to the next day)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Consecutive days check-in ---');
    console.log('Simulating consecutive day roll by updating last_checkin to yesterday...');
    const dbUpdate3 = new DatabaseSync(DATABASE_PATH);
    dbUpdate3.prepare('UPDATE bindings SET last_checkin = ?, checkin_streak = ? WHERE mc_username = ?')
      .run(yesterdayStr, 1, 'TestPlayer');
    dbUpdate3.close();

    const resCheckin3 = await request('POST', '/api/user/checkin', { 'Authorization': `Bearer ${playerToken}` });
    console.log(`Status: ${resCheckin3.statusCode}, Response:`, resCheckin3.body);

    if (resCheckin3.statusCode === 200 && resCheckin3.body.success === true) {
      console.log('PASS: Check-in succeeded on the consecutive day');
      if (resCheckin3.body.checkin_streak === 2 && resCheckin3.body.keys_count === 12 && resCheckin3.body.last_checkin === todayStr) {
        console.log('PASS: Streak correctly incremented to 2, key count incremented to 12');
      } else {
        console.error('FAIL: Unexpected streak/keys values', resCheckin3.body);
        exitCode = 1;
      }
    } else {
      console.error('FAIL: Expected 200 OK, got', resCheckin3.statusCode);
      exitCode = 1;
    }

    // -------------------------------------------------------------
    // TEST 4: Timezone boundary boundary changes / non-consecutive day
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Non-consecutive check-in (streak reset) ---');
    console.log('Simulating date roll to a non-consecutive day by setting last_checkin to 5 days ago...');
    const fiveDaysAgo = getTaipeiDateString(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000));
    const dbUpdate4 = new DatabaseSync(DATABASE_PATH);
    dbUpdate4.prepare('UPDATE bindings SET last_checkin = ?, checkin_streak = ? WHERE mc_username = ?')
      .run(fiveDaysAgo, 2, 'TestPlayer');
    dbUpdate4.close();

    const resCheckin4 = await request('POST', '/api/user/checkin', { 'Authorization': `Bearer ${playerToken}` });
    console.log(`Status: ${resCheckin4.statusCode}, Response:`, resCheckin4.body);

    if (resCheckin4.statusCode === 200 && resCheckin4.body.success === true) {
      console.log('PASS: Check-in succeeded');
      if (resCheckin4.body.checkin_streak === 1 && resCheckin4.body.keys_count === 13) {
        console.log('PASS: Streak correctly reset to 1, key count incremented to 13');
      } else {
        console.error('FAIL: Streak should have reset to 1, got', resCheckin4.body.checkin_streak);
        exitCode = 1;
      }
    } else {
      console.error('FAIL: Expected 200 OK, got', resCheckin4.statusCode);
      exitCode = 1;
    }

    // -------------------------------------------------------------
    // TEST 5: Playtime Exchange - Insufficient playtime (< 360,000 ticks)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Playtime Exchange - Insufficient playtime ---');
    mockPlaytime = 100000; // set player playtime to 100,000 ticks (< 360,000)
    console.log(`Configuring player playtime to ${mockPlaytime} ticks.`);

    const resExchange1 = await request('POST', '/api/user/exchange-playtime', { 'Authorization': `Bearer ${playerToken}` }, { mode: 'single' });
    console.log(`Status: ${resExchange1.statusCode}, Response:`, resExchange1.body);

    if (resExchange1.statusCode === 400 && resExchange1.body.success === false) {
      console.log('PASS: Successfully blocked exchange due to insufficient playtime');
      if (resExchange1.body.message.includes('可用時數不足')) {
        console.log('PASS: Correct insufficient playtime message received');
      }
    } else {
      console.error('FAIL: Expected 400 Bad Request, got', resExchange1.statusCode);
      exitCode = 1;
    }

    // -------------------------------------------------------------
    // TEST 6: Playtime Exchange - Single key exchange (sufficient playtime)
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Playtime Exchange - Single key exchange (400,000 ticks) ---');
    mockPlaytime = 400000; // sufficient playtime
    lastDeductedTicks = 0;
    console.log(`Configuring player playtime to ${mockPlaytime} ticks.`);

    // Current keys count in DB is 13 (from previous check-ins)
    const resExchange2 = await request('POST', '/api/user/exchange-playtime', { 'Authorization': `Bearer ${playerToken}` }, { mode: 'single' });
    console.log(`Status: ${resExchange2.statusCode}, Response:`, resExchange2.body);

    if (resExchange2.statusCode === 200 && resExchange2.body.success === true) {
      console.log('PASS: Successfully exchanged 1 key');
      if (resExchange2.body.keys_count === 14 && lastDeductedTicks === 360000 && mockPlaytime === 40000) {
        console.log('PASS: Exchanged key count (14), deducted ticks (360k) and remaining playtime (40k) are correct');
      } else {
        console.error('FAIL: Unexpected exchange details', {
          response_keys: resExchange2.body.keys_count,
          lastDeductedTicks,
          remainingPlaytime: mockPlaytime
        });
        exitCode = 1;
      }
    } else {
      console.error('FAIL: Expected 200 OK, got', resExchange2.statusCode);
      exitCode = 1;
    }

    // -------------------------------------------------------------
    // TEST 7: Playtime Exchange - All keys exchange (insufficient playtime left)
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Playtime Exchange - Exchange All (insufficient playtime) ---');
    // remaining is 40,000 ticks (< 360,000)
    console.log(`Configuring player playtime to ${mockPlaytime} ticks.`);

    const resExchange3 = await request('POST', '/api/user/exchange-playtime', { 'Authorization': `Bearer ${playerToken}` }, { mode: 'all' });
    console.log(`Status: ${resExchange3.statusCode}, Response:`, resExchange3.body);

    if (resExchange3.statusCode === 400 && resExchange3.body.success === false) {
      console.log('PASS: Successfully blocked exchange all due to insufficient playtime');
    } else {
      console.error('FAIL: Expected 400 Bad Request, got', resExchange3.statusCode);
      exitCode = 1;
    }

    // -------------------------------------------------------------
    // TEST 8: Playtime Exchange - All keys exchange (multiple keys available)
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Playtime Exchange - Exchange All (1,000,000 ticks) ---');
    mockPlaytime = 1000000; // sufficient for 2 keys (720,000 ticks)
    lastDeductedTicks = 0;
    console.log(`Configuring player playtime to ${mockPlaytime} ticks.`);

    // Current keys count in DB is 14
    const resExchange4 = await request('POST', '/api/user/exchange-playtime', { 'Authorization': `Bearer ${playerToken}` }, { mode: 'all' });
    console.log(`Status: ${resExchange4.statusCode}, Response:`, resExchange4.body);

    if (resExchange4.statusCode === 200 && resExchange4.body.success === true) {
      console.log('PASS: Successfully exchanged all available keys (2 keys)');
      if (resExchange4.body.keys_count === 16 && lastDeductedTicks === 720000 && mockPlaytime === 280000) {
        console.log('PASS: Exchanged key count (16), deducted ticks (720k) and remaining playtime (280k) are correct');
      } else {
        console.error('FAIL: Unexpected exchange details', {
          response_keys: resExchange4.body.keys_count,
          lastDeductedTicks,
          remainingPlaytime: mockPlaytime
        });
        exitCode = 1;
      }
    } else {
      console.error('FAIL: Expected 200 OK, got', resExchange4.statusCode);
      exitCode = 1;
    }

  } catch (err) {
    console.error('Test Execution Error:', err);
    exitCode = 1;
  } finally {
    // Kill backend process
    serverProcess.kill();
    // Close Mock WS server
    wss.close();
    // Clean up DB
    if (fs.existsSync(DATABASE_PATH)) {
      try {
        fs.unlinkSync(DATABASE_PATH);
      } catch (err) {
        console.error('Cleanup warning (could not delete temp DB):', err.message);
      }
    }
    console.log('\n=========================================');
    console.log('         VERIFICATION COMPLETED');
    console.log('=========================================');
    process.exit(exitCode);
  }
}

runTests();
