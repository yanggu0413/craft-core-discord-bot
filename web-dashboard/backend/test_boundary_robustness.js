const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');
// @ts-ignore
const { DatabaseSync } = require('node:sqlite');

const PORT = 54322;
const JWT_SECRET = 'test_secret_key_boundary_123';
process.env.JWT_SECRET = JWT_SECRET;
const DATABASE_PATH = path.resolve(__dirname, 'temp_boundary_test.db');

// Step 1: Unit Test verifyToken directly from dist/services/auth.service
const { verifyToken, signToken } = require(path.resolve(__dirname, 'dist/services/auth.service'));
const { authenticateToken, requireAdmin } = require(path.resolve(__dirname, 'dist/middleware/auth'));

console.log('=== STARTING UNIT TESTS FOR AUTH SERVICE & MIDDLEWARE ===');

const unitTestResults = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    unitTestResults.push({ testName, status: 'PASS', details });
  } else {
    console.error(`[FAIL] ${testName} - ${details}`);
    unitTestResults.push({ testName, status: 'FAIL', details });
  }
}

// Test verifyToken with boundary inputs
assert(verifyToken(null) === null, 'verifyToken(null) returns null');
assert(verifyToken(undefined) === null, 'verifyToken(undefined) returns null');
assert(verifyToken('') === null, 'verifyToken("") returns null');
assert(verifyToken('   ') === null, 'verifyToken("   ") returns null');
assert(verifyToken('invalid.token.format') === null, 'verifyToken("invalid.token.format") returns null');
assert(verifyToken('Bearer invalid') === null, 'verifyToken("Bearer invalid") returns null');

// Test dev tokens (verify bypass is completely removed)
assert(verifyToken('dev-token') === null, 'verifyToken("dev-token") is rejected and returns null');
assert(verifyToken('dev-token-Steve') === null, 'verifyToken("dev-token-Steve") is rejected and returns null');
assert(verifyToken('dev_token') === null, 'verifyToken("dev_token") is rejected and returns null');

// Test valid & expired JWTs
const validToken = signToken({ mc_uuid: 'uuid-123', mc_username: 'Tester' });
const validPayload = verifyToken(validToken);
assert(validPayload && validPayload.mc_username === 'Tester', 'verifyToken(validToken) decodes valid payload');

const expiredToken = jwt.sign({ mc_uuid: 'uuid-123', mc_username: 'Tester' }, JWT_SECRET, { expiresIn: '-1s' });
assert(verifyToken(expiredToken) === null, 'verifyToken(expiredToken) returns null');

// Step 2: Prepare SQLite Test Database
if (fs.existsSync(DATABASE_PATH)) {
  try { fs.unlinkSync(DATABASE_PATH); } catch (e) {}
}

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
  );
  CREATE TABLE IF NOT EXISTS offline_mails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_discord_id TEXT,
    sender_username TEXT,
    receiver_username TEXT,
    item_id TEXT,
    quantity INTEGER,
    nbt TEXT,
    status TEXT DEFAULT 'pending'
  );
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
  );
  CREATE TABLE IF NOT EXISTS warp_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_username TEXT,
    applicant_discord_id TEXT,
    facility_name TEXT,
    function_desc TEXT,
    coords TEXT,
    dimension TEXT
  );
`);

db.prepare('INSERT INTO bindings (discord_id, mc_uuid, mc_username, keys_count) VALUES (?, ?, ?, ?)').run(
  '1248891236480188517', 'dev-uuid-yanggu', 'Yanggu', 10
);
db.close();
console.log('Database initialized successfully.');

// Step 3: Spawn Server Process
const env = {
  ...process.env,
  PORT: PORT.toString(),
  JWT_SECRET: JWT_SECRET,
  DATABASE_PATH: DATABASE_PATH,
  NODE_ENV: 'development',
  ENABLE_DEV_LOGIN: 'true',
};

console.log('Spawning Express Backend Server on port', PORT);
const serverProcess = spawn('node', [path.resolve(__dirname, 'dist/server.js')], { env });

serverProcess.stdout.on('data', (data) => {
  // console.log(`[Server stdout] ${data}`);
});

serverProcess.stderr.on('data', (data) => {
  // console.error(`[Server stderr] ${data}`);
});

function httpRequest(method, reqPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: reqPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json || data
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (body !== null) {
      if (typeof body === 'object') {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

async function runApiTests() {
  // Wait for server to start listening
  await new Promise(r => setTimeout(r, 2000));

  const httpResults = [];

  async function testHttp(name, method, path, headers, body, expectedStatuses, customCheck) {
    try {
      const res = await httpRequest(method, path, headers, body);
      const passStatus = expectedStatuses.includes(res.statusCode);
      let passCheck = passStatus;
      let checkMsg = `Got HTTP ${res.statusCode}`;

      if (customCheck) {
        const customRes = customCheck(res);
        if (customRes !== true) {
          passCheck = false;
          checkMsg += ` | Custom Check Failed: ${customRes}`;
        }
      }

      if (passCheck) {
        console.log(`[PASS] ${name} (Status: ${res.statusCode})`);
        httpResults.push({ name, status: 'PASS', httpCode: res.statusCode, response: res.body });
      } else {
        console.error(`[FAIL] ${name} (${checkMsg}) Response:`, JSON.stringify(res.body));
        httpResults.push({ name, status: 'FAIL', httpCode: res.statusCode, response: res.body, error: checkMsg });
      }
    } catch (err) {
      console.error(`[ERROR] ${name}:`, err.message);
      httpResults.push({ name, status: 'ERROR', error: err.message });
    }
  }

  console.log('\n=== RUNNING AUTH & BOUNDARY HTTP TESTS ===');

  // 1. Auth Middleware Verification Tests
  await testHttp('Protected route without token', 'GET', '/api/user/profile', {}, null, [401], res => res.body?.success === false);
  await testHttp('Protected route with empty Bearer header', 'GET', '/api/user/profile', { 'Authorization': 'Bearer ' }, null, [401], res => res.body?.success === false);
  await testHttp('Protected route with whitespace Bearer header', 'GET', '/api/user/profile', { 'Authorization': 'Bearer    ' }, null, [401], res => res.body?.success === false);
  await testHttp('Protected route with malformed token', 'GET', '/api/user/profile', { 'Authorization': 'Bearer malformed.jwt.token' }, null, [401], res => res.body?.success === false);
  await testHttp('Protected route with dev-token (rejected)', 'GET', '/api/user/profile', { 'Authorization': 'Bearer dev-token' }, null, [401], res => res.body?.success === false);
  await testHttp('Protected route with dev-token in query param (rejected)', 'GET', '/api/user/profile?token=dev-token', {}, null, [401], res => res.body?.success === false);
  await testHttp('Protected route with dev-token in x-access-token header (rejected)', 'GET', '/api/user/profile', { 'x-access-token': 'dev-token' }, null, [401], res => res.body?.success === false);

  // 2. /api/stats Endpoint Tests
  await testHttp('GET /api/stats normal', 'GET', '/api/stats', {}, null, [200], res => res.body?.success === true);
  await testHttp('GET /api/stats with special char query params', 'GET', '/api/stats?param=' + encodeURIComponent('<script>alert(1)</script>') + '&foo=' + encodeURIComponent('bar\' OR \'1\'=\'1'), {}, null, [200], res => res.body?.success === true);

  // 3. /api/leaderboard Endpoint Tests
  await testHttp('GET /api/leaderboard normal', 'GET', '/api/leaderboard', {}, null, [200], res => res.body?.success === true && Array.isArray(res.body?.leaderboard));
  await testHttp('GET /api/user/leaderboard alias', 'GET', '/api/user/leaderboard', {}, null, [200], res => res.body?.success === true && Array.isArray(res.body?.leaderboard));
  await testHttp('GET /api/leaderboard with out-of-range parameters', 'GET', '/api/leaderboard?limit=-10&offset=9999999999', {}, null, [200], res => res.body?.success === true);
  await testHttp('GET /api/leaderboard with special characters', 'GET', '/api/leaderboard?search=Special_%00%01_User', {}, null, [200], res => res.body?.success === true);

  // 4. /api/market & shop Endpoint Tests
  await testHttp('GET /api/market/analytics normal', 'GET', '/api/market/analytics', {}, null, [200], res => res.body?.success === true);
  await testHttp('GET /api/market/recent normal', 'GET', '/api/market/recent', {}, null, [200], res => res.body?.success === true);
  await testHttp('GET /api/shops normal', 'GET', '/api/shops', {}, null, [200], res => res.body?.success === true);
  
  // POST /api/shop/rename
  await testHttp('POST /api/shop/rename unauthenticated', 'POST', '/api/shop/rename', {}, { coords: '100,64,100', custom_name: 'TestShop' }, [401]);
  await testHttp('POST /api/shop/rename empty body', 'POST', '/api/shop/rename', { 'Authorization': `Bearer ${validToken}` }, {}, [400]);
  await testHttp('POST /api/shop/rename missing custom_name', 'POST', '/api/shop/rename', { 'Authorization': `Bearer ${validToken}` }, { coords: '100,64,100' }, [400]);
  await testHttp('POST /api/shop/rename special characters', 'POST', '/api/shop/rename', { 'Authorization': `Bearer ${validToken}` }, { coords: '<script>100,64,100</script>', custom_name: 'Shop\' OR \'1\'=\'1 🎉🚀' }, [200, 500], res => res.body?.success !== undefined);

  // POST /api/shop/withdraw
  await testHttp('POST /api/shop/withdraw unauthenticated', 'POST', '/api/shop/withdraw', {}, { coords: '100,64,100' }, [401]);
  await testHttp('POST /api/shop/withdraw empty body', 'POST', '/api/shop/withdraw', { 'Authorization': `Bearer ${validToken}` }, {}, [400]);

  // POST /api/shop/rate
  await testHttp('POST /api/shop/rate empty body', 'POST', '/api/shop/rate', { 'Authorization': `Bearer ${validToken}` }, {}, [400]);
  await testHttp('POST /api/shop/rate out of range rating (0)', 'POST', '/api/shop/rate', { 'Authorization': `Bearer ${validToken}` }, { coords: '100,64,100', rating: 0 }, [400]);
  await testHttp('POST /api/shop/rate out of range rating (6)', 'POST', '/api/shop/rate', { 'Authorization': `Bearer ${validToken}` }, { coords: '100,64,100', rating: 6 }, [400]);
  await testHttp('POST /api/shop/rate string rating ("five")', 'POST', '/api/shop/rate', { 'Authorization': `Bearer ${validToken}` }, { coords: '100,64,100', rating: 'five' }, [400]);
  await testHttp('POST /api/shop/rate valid rating (5)', 'POST', '/api/shop/rate', { 'Authorization': `Bearer ${validToken}` }, { coords: '100,64,100', rating: 5 }, [200, 500], res => res.body?.success !== undefined);

  // 5. /api/claims Endpoint Tests
  await testHttp('GET /api/claims normal', 'GET', '/api/claims', {}, null, [200], res => res.body?.success === true && Array.isArray(res.body?.claims));
  await testHttp('POST /api/claims/permission unauthenticated', 'POST', '/api/claims/permission', {}, { claimId: 'claim_1', permissionType: 'build', player: 'Steve', action: 'grant' }, [401]);
  await testHttp('POST /api/claims/permission empty body', 'POST', '/api/claims/permission', { 'Authorization': `Bearer ${validToken}` }, {}, [400]);
  await testHttp('POST /api/claims/permission missing parameters', 'POST', '/api/claims/permission', { 'Authorization': `Bearer ${validToken}` }, { claimId: 'claim_1' }, [400]);
  await testHttp('POST /api/claims/permission special character player', 'POST', '/api/claims/permission', { 'Authorization': `Bearer ${validToken}` }, { claimId: 'claim_1', permissionType: 'build', player: '<script>alert(1)</script>\' OR 1=1', action: 'grant' }, [200, 400, 403, 500], res => res.body?.success !== undefined);

  await testHttp('POST /api/claims/flags unauthenticated', 'POST', '/api/claims/flags', {}, { claim_id: 'claim_1' }, [401]);
  await testHttp('POST /api/claims/flags empty body with valid token', 'POST', '/api/claims/flags', { 'Authorization': `Bearer ${validToken}` }, {}, [200, 400, 403, 500], res => res.body?.success !== undefined);
  await testHttp('POST /api/claims/flags boundary values', 'POST', '/api/claims/flags', { 'Authorization': `Bearer ${validToken}` }, { claim_id: 'claim_1', public_containers: 'yes_string', banned_players: 'not_an_array' }, [200, 400, 403, 500], res => res.body?.success !== undefined);

  // 6. /api/fake-players Endpoint Tests
  await testHttp('GET /api/user/fakeplayers unauthenticated', 'GET', '/api/user/fakeplayers', {}, null, [401]);
  await testHttp('GET /api/user/fakeplayers with valid token', 'GET', '/api/user/fakeplayers', { 'Authorization': `Bearer ${validToken}` }, null, [200], res => res.body?.success === true && Array.isArray(res.body?.fakeplayers));
  await testHttp('POST /api/user/fakeplayers/action empty body', 'POST', '/api/user/fakeplayers/action', { 'Authorization': `Bearer ${validToken}` }, {}, [400]);
  await testHttp('POST /api/user/fakeplayers/action missing action', 'POST', '/api/user/fakeplayers/action', { 'Authorization': `Bearer ${validToken}` }, { botName: 'Bot1' }, [400]);
  await testHttp('POST /api/user/fakeplayers/action special char botName', 'POST', '/api/user/fakeplayers/action', { 'Authorization': `Bearer ${validToken}` }, { botName: 'Bot_!@#$%^&*()_<script>', action: 'attack' }, [200, 400, 500], res => res.body?.success !== undefined);

  // 7. /api/tasks Endpoint Tests
  await testHttp('GET /api/tasks/daily unauthenticated', 'GET', '/api/tasks/daily', {}, null, [200], res => res.body?.success === true && Array.isArray(res.body?.tasks));
  await testHttp('GET /api/tasks/daily with valid token', 'GET', '/api/tasks/daily', { 'Authorization': `Bearer ${validToken}` }, null, [200], res => res.body?.success === true);
  await testHttp('POST /api/tasks/claim unauthenticated', 'POST', '/api/tasks/claim', {}, null, [401]);
  await testHttp('POST /api/tasks/claim with valid token', 'POST', '/api/tasks/claim', { 'Authorization': `Bearer ${validToken}` }, {}, [200, 400, 500], res => res.body?.success !== undefined);

  // 8. Other User Boundary Endpoints (buy-key-with-money, mail/send, luckydraw)
  await testHttp('POST /api/user/buy-key-with-money empty body', 'POST', '/api/user/buy-key-with-money', { 'Authorization': `Bearer ${validToken}` }, {}, [200, 400, 500], res => res.body?.success !== undefined);
  await testHttp('POST /api/user/buy-key-with-money negative count (-100)', 'POST', '/api/user/buy-key-with-money', { 'Authorization': `Bearer ${validToken}` }, { count: -100 }, [200, 400, 500], res => res.body?.success !== undefined);
  await testHttp('POST /api/user/buy-key-with-money invalid string count', 'POST', '/api/user/buy-key-with-money', { 'Authorization': `Bearer ${validToken}` }, { count: 'invalid_count' }, [200, 400, 500], res => res.body?.success !== undefined);

  await testHttp('POST /api/mail/send empty body', 'POST', '/api/mail/send', { 'Authorization': `Bearer ${validToken}` }, {}, [400]);
  await testHttp('POST /api/mail/send special character receiver', 'POST', '/api/mail/send', { 'Authorization': `Bearer ${validToken}` }, { receiver_username: 'Player_<script>alert(1)</script>', item_id: 'minecraft:diamond', quantity: 5 }, [200, 500], res => res.body?.success !== undefined);

  serverProcess.kill();
  console.log('\nServer process killed.');

  // Output test summary report
  const summaryReport = {
    timestamp: new Date().toISOString(),
    unitTestResults,
    httpResults,
    passedUnitCount: unitTestResults.filter(u => u.status === 'PASS').length,
    totalUnitCount: unitTestResults.length,
    passedHttpCount: httpResults.filter(h => h.status === 'PASS').length,
    totalHttpCount: httpResults.length
  };

  fs.writeFileSync(path.resolve(__dirname, 'boundary_robustness_report.json'), JSON.stringify(summaryReport, null, 2));
  console.log(`\n=== TEST SUMMARY ===`);
  console.log(`Unit Tests: ${summaryReport.passedUnitCount}/${summaryReport.totalUnitCount} Passed`);
  console.log(`HTTP Endpoints: ${summaryReport.passedHttpCount}/${summaryReport.totalHttpCount} Passed`);
  console.log(`Report written to boundary_robustness_report.json`);
}

runApiTests().catch(err => {
  console.error('Fatal test error:', err);
  if (serverProcess) serverProcess.kill();
  process.exit(1);
});
