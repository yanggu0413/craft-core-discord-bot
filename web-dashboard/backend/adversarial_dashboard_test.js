const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');
// @ts-ignore
const { DatabaseSync } = require('node:sqlite');

const PORT = 55432;
const JWT_SECRET = 'adversarial_test_secret_key_999';
const DATABASE_PATH = path.resolve(__dirname, 'temp_adversarial_test.db');

// Cleanup pre-existing test DB
if (fs.existsSync(DATABASE_PATH)) {
  try { fs.unlinkSync(DATABASE_PATH); } catch (e) {}
}

// Create and seed SQLite database
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

  CREATE TABLE IF NOT EXISTS server_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    start_time TEXT,
    end_time TEXT,
    reward_info TEXT,
    status TEXT,
    creator_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    scope TEXT,
    impact TEXT,
    publisher TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS player_titles (
    username TEXT PRIMARY KEY COLLATE NOCASE,
    title_text TEXT,
    color_code TEXT,
    is_bold INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ticket_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT,
    channel_id TEXT,
    channel_name TEXT,
    creator_id TEXT,
    creator_username TEXT,
    closed_by TEXT,
    closed_at TEXT,
    transcript_json TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    shop_coords TEXT,
    buyer TEXT,
    seller TEXT,
    item TEXT,
    quantity INTEGER,
    unit_price REAL,
    tax_deducted REAL,
    net_profit REAL
  );
`);

// Seed test users & data
db.prepare('INSERT INTO bindings (discord_id, mc_uuid, mc_username, keys_count) VALUES (?, ?, ?, ?)').run('1248891236480188517', 'admin-uuid-001', 'AdminPlayer', 50);
db.prepare('INSERT INTO bindings (discord_id, mc_uuid, mc_username, keys_count) VALUES (?, ?, ?, ?)').run('888888888888888888', 'user-uuid-002', 'NormalUser', 5);
db.prepare('INSERT INTO announcements (title, content, scope, impact, publisher) VALUES (?, ?, ?, ?, ?)').run('系統維護公告', '今晚例行維護', '全服', '停機10分鐘', 'AdminPlayer');
db.prepare('INSERT INTO server_events (title, description, status, creator_name) VALUES (?, ?, ?, ?)').run('雙倍經驗週末', '全服經驗雙倍', 'active', 'AdminPlayer');

for (let i = 1; i <= 250; i++) {
  db.prepare('INSERT INTO ticket_history (ticket_id, channel_id, channel_name, creator_id, creator_username, closed_by) VALUES (?, ?, ?, ?, ?, ?)').run(
    `ticket-${i}`, `chan-${i}`, `ticket-user-${i}`, `discord-${i}`, `User_${i}`, 'AdminPlayer'
  );
}

db.close();
console.log('[Test Setup] Initialized and seeded temp_adversarial_test.db');

// Spawn server process
const env = {
  ...process.env,
  PORT: PORT.toString(),
  JWT_SECRET: JWT_SECRET,
  DATABASE_PATH: DATABASE_PATH,
};

const serverProcess = spawn('node', [path.resolve(__dirname, 'dist/server.js')], { env });

serverProcess.stdout.on('data', () => {});
serverProcess.stderr.on('data', () => {});

function request(method, pathStr, headers = {}, body = null, rawStringBody = null) {
  return new Promise((resolve, reject) => {
    const encodedPath = encodeURI(pathStr);
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: encodedPath,
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
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (rawStringBody !== null) {
      req.write(rawStringBody);
    } else if (body !== null) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const testResults = [];

function recordResult(testId, category, name, expected, actualStatus, pass, details = '') {
  testResults.push({
    id: testId,
    category,
    name,
    expected,
    actualStatus,
    pass,
    details
  });
  const symbol = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`[${symbol}] ${testId} - ${category}: ${name} (Status: ${actualStatus}) ${details ? '| ' + details : ''}`);
}

async function runAdversarialTestSuite() {
  await new Promise((res) => setTimeout(res, 2500));
  console.log('\n===============================================================');
  console.log('      Craft-Core Web Dashboard 嚴格極端對抗性測試套件');
  console.log('===============================================================\n');

  // Tokens
  const adminToken = jwt.sign({
    mc_uuid: 'admin-uuid-001',
    mc_username: 'AdminPlayer',
    discord_id: '1248891236480188517',
    roles: ['1360409328175153242'],
    profile: { roles: ['1360409328175153242'], isAdmin: true }
  }, JWT_SECRET, { expiresIn: '1h' });

  const userToken = jwt.sign({
    mc_uuid: 'user-uuid-002',
    mc_username: 'NormalUser',
    discord_id: '888888888888888888',
    roles: ['normal_role'],
    profile: { roles: ['normal_role'], isAdmin: false }
  }, JWT_SECRET, { expiresIn: '1h' });

  const forgedToken = jwt.sign({
    mc_uuid: 'hacker-uuid',
    mc_username: 'Hacker',
    discord_id: '1248891236480188517',
    roles: ['1360409328175153242'],
    profile: { isAdmin: true }
  }, 'hacker_fake_secret', { expiresIn: '1h' });

  const expiredToken = jwt.sign({
    mc_uuid: 'admin-uuid-001',
    mc_username: 'AdminPlayer',
    discord_id: '1248891236480188517',
    profile: { isAdmin: true }
  }, JWT_SECRET, { expiresIn: '-1s' });

  // -------------------------------------------------------------
  // CATEGORY 1: 正常功能測試 (Normal Functional Tests)
  // -------------------------------------------------------------
  console.log('\n>>> CATEGORY 1: 正常功能測試 (Normal Functional Tests) <<<');

  let res = await request('GET', '/api/announcements');
  recordResult('N1.1', 'Normal', '公開讀取公告 GET /api/announcements', '200 OK', res.statusCode, res.statusCode === 200 && res.body.success === true);

  res = await request('GET', '/api/events');
  recordResult('N1.2', 'Normal', '公開讀取活動 GET /api/events', '200 OK', res.statusCode, res.statusCode === 200 && res.body.success === true);

  res = await request('GET', '/api/shops');
  recordResult('N1.3', 'Normal', '公開讀取商店 GET /api/shops', '200 OK', res.statusCode, res.statusCode === 200 && res.body.success === true);

  res = await request('GET', '/api/auth/dev-login?username=AdminPlayer');
  recordResult('N2', 'Normal', '開發者模式登入 GET /api/auth/dev-login', '200 OK', res.statusCode, res.statusCode === 200 && Boolean(res.body.token));

  res = await request('GET', '/api/user/profile', { Authorization: `Bearer ${userToken}` });
  recordResult('N3', 'Normal', '一般使用者讀取 Profile GET /api/user/profile', '200 OK', res.statusCode, res.statusCode === 200 && res.body.user?.mc_username === 'NormalUser');

  res = await request('POST', '/api/user/checkin', { Authorization: `Bearer ${userToken}` });
  recordResult('N4', 'Normal', '一般使用者首次每日簽到 POST /api/user/checkin', '200 OK', res.statusCode, res.statusCode === 200 && res.body.success === true);

  res = await request('GET', '/api/admin/player/NormalUser', { Authorization: `Bearer ${adminToken}` });
  recordResult('N5', 'Normal', '管理員查詢玩家 GET /api/admin/player/:username', '200 OK', res.statusCode, res.statusCode === 200 && res.body.profile?.mc_username === 'NormalUser');

  res = await request('POST', '/api/admin/co-branding', { Authorization: `Bearer ${adminToken}` }, { player: 'NormalUser' });
  recordResult('N6', 'Normal', '管理員發放聯名獎勵 POST /api/admin/co-branding', '200 OK', res.statusCode, res.statusCode === 200 && res.body.success === true);

  // -------------------------------------------------------------
  // CATEGORY 2: 極端正常測試 (Extreme & Boundary Normal Tests)
  // -------------------------------------------------------------
  console.log('\n>>> CATEGORY 2: 極端正常測試 (Extreme & Boundary Normal Tests) <<<');

  res = await request('GET', '/api/admin/tickets?limit=999999&page=1', { Authorization: `Bearer ${adminToken}` });
  const isCapped = res.statusCode === 200 && res.body.tickets && res.body.tickets.length <= 200;
  recordResult('E1', 'Boundary', '分頁上限極端值 limit=999999 (應限制最大200)', '200 OK & limit <= 200', res.statusCode, isCapped, `Returned: ${res.body.tickets?.length} items`);

  res = await request('GET', '/api/admin/tickets?page=-50', { Authorization: `Bearer ${adminToken}` });
  const isPageDefaulted = res.statusCode === 200 && res.body.page === 1;
  recordResult('E2', 'Boundary', '分頁負數極端值 page=-50 (應修正為 page 1)', '200 OK & page=1', res.statusCode, isPageDefaulted, `Returned page: ${res.body.page}`);

  res = await request('GET', '/api/admin/transactions?search=', { Authorization: `Bearer ${adminToken}` });
  recordResult('E3', 'Boundary', '搜尋空字串 search=""', '200 OK', res.statusCode, res.statusCode === 200 && Array.isArray(res.body.transactions));

  res = await request('GET', '/api/admin/transactions?search=' + encodeURIComponent('🚀_特殊字元_!@#$%^&*()'), { Authorization: `Bearer ${adminToken}` });
  recordResult('E4', 'Boundary', '特殊字元與 Emoji 搜尋', '200 OK', res.statusCode, res.statusCode === 200 && Array.isArray(res.body.transactions));

  res = await request('POST', '/api/user/checkin', { Authorization: `Bearer ${userToken}` });
  recordResult('E5', 'Boundary', '同天二次簽到 (冪等性邊界測試)', '400 Bad Request', res.statusCode, res.statusCode === 400 && res.body.success === false, `Msg: ${res.body.message}`);

  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 'world,100,64,100', rating: 1 });
  const e6_1_pass = res.statusCode === 200 || (res.statusCode === 500 && res.body.message?.includes('連線'));
  recordResult('E6.1', 'Boundary', '商店評分最小邊界 rating=1', '200 OK (或 500 遊戲連線例外)', res.statusCode, e6_1_pass, `Msg: ${res.body.message}`);

  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 'world,100,64,100', rating: 5 });
  const e6_2_pass = res.statusCode === 200 || (res.statusCode === 500 && res.body.message?.includes('連線'));
  recordResult('E6.2', 'Boundary', '商店評分最大邊界 rating=5', '200 OK (或 500 遊戲連線例外)', res.statusCode, e6_2_pass, `Msg: ${res.body.message}`);

  // -------------------------------------------------------------
  // CATEGORY 3: 不正常極端對抗性測試 (Abnormal & Adversarial Attacks)
  // -------------------------------------------------------------
  console.log('\n>>> CATEGORY 3: 不正常極端對抗性測試 (Abnormal & Adversarial Attacks) <<<');

  // A1 ~ A4: Authentication Attacks
  res = await request('GET', '/api/user/profile');
  recordResult('A1', 'Security', '未附帶 Token 存取受保護路由', '401 Unauthorized', res.statusCode, res.statusCode === 401 || res.statusCode === 403);

  res = await request('GET', '/api/user/profile', { Authorization: 'Bearer malformed_token_12345' });
  recordResult('A2', 'Security', '附帶格式錯誤 Token', '403 Forbidden', res.statusCode, res.statusCode === 403);

  res = await request('GET', '/api/user/profile', { Authorization: `Bearer ${forgedToken}` });
  recordResult('A3', 'Security', '附帶偽造簽名 (Forged JWT) Token', '403 Forbidden', res.statusCode, res.statusCode === 403);

  res = await request('GET', '/api/user/profile', { Authorization: `Bearer ${expiredToken}` });
  recordResult('A4', 'Security', '附帶過期 JWT Token', '403 Forbidden', res.statusCode, res.statusCode === 403);

  // A5 ~ A7: Privilege Escalation Attacks
  res = await request('POST', '/api/admin/give-money', { Authorization: `Bearer ${userToken}` }, { username: 'NormalUser', amount: 1000 });
  recordResult('A5', 'Security', '一般使用者越權調用管理員給錢 POST /api/admin/give-money', '403 Forbidden', res.statusCode, res.statusCode === 403);

  res = await request('POST', '/api/admin/events', { Authorization: `Bearer ${userToken}` }, { title: 'Hacked Event', description: 'test' });
  recordResult('A6', 'Security', '一般使用者越權建立伺服器活動 POST /api/admin/events', '403 Forbidden', res.statusCode, res.statusCode === 403);

  res = await request('POST', '/api/admin/backup/trigger', { Authorization: `Bearer ${userToken}` });
  recordResult('A7', 'Security', '一般使用者越權發起備份 POST /api/admin/backup/trigger', '403 Forbidden', res.statusCode, res.statusCode === 403);

  // A8 ~ A9: SQL Injection Attacks
  res = await request('GET', "/api/admin/player/NormalUser' OR '1'='1", { Authorization: `Bearer ${adminToken}` });
  recordResult('A8', 'Security', "SQL 注入攻擊玩家查詢 /api/admin/player/NormalUser' OR '1'='1", '200 / 404 (無 SQL 語法錯誤)', res.statusCode, res.statusCode !== 500, `Result: ${JSON.stringify(res.body)}`);

  res = await request('GET', "/api/admin/tickets?search=" + encodeURIComponent("' UNION SELECT 1,2,3,4,5,6,7,8--"), { Authorization: `Bearer ${adminToken}` });
  recordResult('A9', 'Security', "SQL 注入攻擊 Tickets 搜尋 search=' UNION SELECT...", '200 OK (無 SQL 語法錯誤)', res.statusCode, res.statusCode === 200 && Array.isArray(res.body.tickets));

  // A10 ~ A12: Command Injection & OS Command Traversal
  res = await request('POST', '/api/admin/ban', { Authorization: `Bearer ${adminToken}` }, { player: 'TestPlayer; rm -rf /', reason: 'hacked' });
  recordResult('A10', 'Security', '指令注入封鎖玩家 player="TestPlayer; rm -rf /"', '400 / 500 (系統指令未遭執行)', res.statusCode, res.statusCode === 400 || res.statusCode === 500 || (res.statusCode === 200 && res.body.success === false), `Output: ${res.body.message}`);

  res = await request('POST', '/api/admin/kick', { Authorization: `Bearer ${adminToken}` }, { player: 'TestPlayer && format c:', reason: 'hacked' });
  recordResult('A11', 'Security', '指令注入踢出玩家 player="TestPlayer && format c:"', '400 / 500 (系統指令未遭執行)', res.statusCode, res.statusCode === 400 || res.statusCode === 500 || (res.statusCode === 200 && res.body.success === false));

  res = await request('POST', '/api/user/fakeplayers/action', { Authorization: `Bearer ${userToken}` }, { botName: 'bot1; say HACKED', action: 'spawn' });
  recordResult('A12', 'Security', '指令注入假人動作 botName="bot1; say HACKED"', '400 / 500 (系統指令未遭執行)', res.statusCode, res.statusCode === 400 || res.statusCode === 500);

  // A13 ~ A14: Stored XSS Attacks
  res = await request('POST', '/api/admin/titles', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', title_text: "<script>alert('XSS')</script>" });
  recordResult('A13', 'Security', 'XSS 攻擊設定稱號 title_text="<script>alert(\'XSS\')</script>"', '200 OK (儲存無崩潰)', res.statusCode, res.statusCode === 200);

  res = await request('POST', '/api/admin/announcements', { Authorization: `Bearer ${adminToken}` }, { title: "<img src=x onerror=alert(1)>", content: 'XSS Test' });
  recordResult('A14', 'Security', 'XSS 攻擊公告標題 title="<img src=x onerror=alert(1)>"', '200 OK (儲存無崩潰)', res.statusCode, res.statusCode === 200);

  // A15 ~ A18: Business Logic & Type Confusion Violations
  res = await request('POST', '/api/admin/give-money', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', amount: -5000 });
  recordResult('A15', 'Abnormal', '給予金幣負數金額 amount=-5000', '400 Bad Request', res.statusCode, res.statusCode === 400, `Msg: ${res.body.message}`);

  res = await request('POST', '/api/admin/give-money', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', amount: 0 });
  recordResult('A16', 'Abnormal', '給予金幣零金額 amount=0', '400 Bad Request', res.statusCode, res.statusCode === 400, `Msg: ${res.body.message}`);

  res = await request('POST', '/api/admin/give-keys', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', amount: -10 });
  recordResult('A17', 'Abnormal', '給予鑰匙負數量 amount=-10', '400 Bad Request', res.statusCode, res.statusCode === 400, `Msg: ${res.body.message}`);

  res = await request('POST', '/api/admin/give-money', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', amount: "5000" });
  recordResult('A18', 'Abnormal', '給予金幣型別混淆 (字串金額 amount="5000")', '400 Bad Request', res.statusCode, res.statusCode === 400, `Msg: ${res.body.message}`);

  // A19 ~ A21: Range Violations
  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 'world,100,64,100', rating: 0 });
  recordResult('A19', 'Abnormal', '商店評分超出範圍 rating=0', '400 Bad Request', res.statusCode, res.statusCode === 400, `Msg: ${res.body.message}`);

  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 'world,100,64,100', rating: 6 });
  recordResult('A20', 'Abnormal', '商店評分超出範圍 rating=6', '400 Bad Request', res.statusCode, res.statusCode === 400, `Msg: ${res.body.message}`);

  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 'world,100,64,100', rating: -5 });
  recordResult('A21', 'Abnormal', '商店評分超出範圍 rating=-5', '400 Bad Request', res.statusCode, res.statusCode === 400, `Msg: ${res.body.message}`);

  // A22: Empty Body Attack
  res = await request('POST', '/api/shop/rename', { Authorization: `Bearer ${userToken}` }, {});
  recordResult('A22', 'Abnormal', '發送空 JSON Body {} 至 /api/shop/rename', '400 Bad Request', res.statusCode, res.statusCode === 400, `Msg: ${res.body.message}`);

  // A23: Payload Size DOS Attack (>10KB body limit)
  const hugePayload = {
    username: 'NormalUser',
    title_text: 'A'.repeat(20000)
  };
  res = await request('POST', '/api/admin/titles', { Authorization: `Bearer ${adminToken}` }, hugePayload);
  recordResult('A23', 'Security', '超大 Payload (20KB Body > 10KB Limit) DOS 攻擊', '413 Payload Too Large', res.statusCode, res.statusCode === 413, `Got status: ${res.statusCode}`);

  // A24: Unauthorized Claim Permission Manipulation
  res = await request('POST', '/api/claims/permission', { Authorization: `Bearer ${userToken}` }, {
    claimId: 'claim-999',
    permissionType: 'build',
    player: 'Hacker',
    action: 'grant'
  });
  recordResult('A24', 'Security', '未授權玩家試圖修改他人領地權限', '403 Forbidden', res.statusCode, res.statusCode === 403, `Msg: ${res.body.message}`);

  // A25: Concurrency Race Condition Attack (10 Simultaneous Checkins)
  console.log('\n--- 正在進行 A25: 10個同時並行請求極端簽到併發測試 (Race Condition Attack) ---');
  const user2Token = jwt.sign({
    mc_uuid: 'user-uuid-concurrency',
    mc_username: 'ConcurrencyUser',
    discord_id: '999999999999999999',
    roles: [],
    profile: { isAdmin: false }
  }, JWT_SECRET, { expiresIn: '1h' });

  // Seed ConcurrencyUser into DB
  const dbSync = new DatabaseSync(DATABASE_PATH);
  dbSync.prepare('INSERT INTO bindings (discord_id, mc_uuid, mc_username, keys_count) VALUES (?, ?, ?, ?)').run('999999999999999999', 'user-uuid-concurrency', 'ConcurrencyUser', 0);
  dbSync.close();

  const concurrentRequests = Array.from({ length: 10 }).map(() =>
    request('POST', '/api/user/checkin', { Authorization: `Bearer ${user2Token}` })
  );

  const raceResults = await Promise.all(concurrentRequests);
  const successCount = raceResults.filter(r => r.statusCode === 200 && r.body.success === true).length;
  const blockedCount = raceResults.filter(r => r.statusCode === 400).length;

  recordResult('A25', 'Concurrency', '高併發簽到連發 (10 請求同時抵達)', '僅 1 個成功 (400 阻擋 9 個)', raceResults[0].statusCode, successCount === 1, `成功數: ${successCount}, 阻擋數: ${blockedCount}`);

  // Summary Report
  console.log('\n===============================================================');
  console.log('                     測試結果統計與彙整');
  console.log('===============================================================');

  const total = testResults.length;
  const passed = testResults.filter(r => r.pass).length;
  const failed = testResults.filter(r => !r.pass).length;

  console.log(`總測試案例數 (Total Test Cases): ${total}`);
  console.log(`通過數量 (Passed): ${passed}  (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`未通過/潛在風險數量 (Failed/Risks): ${failed}  (${((failed / total) * 100).toFixed(1)}%)`);

  if (failed > 0) {
    console.log('\n[未通過/建議檢查之測試清單]:');
    testResults.filter(r => !r.pass).forEach(r => {
      console.log(` ❌ [${r.id}] ${r.name} - 預期: ${r.expected}, 實際 Status: ${r.actualStatus} | Details: ${r.details}`);
    });
  }

  // Write structured JSON results report
  const reportPath = path.resolve(__dirname, 'adversarial_test_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total, passed, failed, passRate: `${((passed / total) * 100).toFixed(1)}%` },
    testResults
  }, null, 2), 'utf8');

  console.log(`\n[Report Generated] 詳細報告已寫入: ${reportPath}`);

  serverProcess.kill();
  if (fs.existsSync(DATABASE_PATH)) {
    try { fs.unlinkSync(DATABASE_PATH); } catch (e) {}
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAdversarialTestSuite().catch((err) => {
  console.error('Fatal Test Error:', err);
  if (serverProcess) serverProcess.kill();
  process.exit(1);
});
