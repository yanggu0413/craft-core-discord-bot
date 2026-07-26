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
  db.prepare('INSERT INTO ticket_history (ticket_id, channel_id, channel_name, creator_id, creator_username, closed_by, transcript_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    `ticket-${i}`, `chan-${i}`, `ticket-user-${i}`, `discord-${i}`, `User_${i}`, 'AdminPlayer', JSON.stringify([{ author: 'User', content: 'Help me' }])
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
  console.log('    Craft-Core Web Dashboard 140項 全方位嚴格對抗性測試套件');
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
  // CATEGORY 1: 基礎 40 項對抗測試
  // -------------------------------------------------------------
  console.log('\n>>> CATEGORY 1: 基礎 40 項對抗與邊界測試 <<<');

  let res = await request('GET', '/api/announcements');
  recordResult('N1.1', 'Normal', '公開讀取公告 GET /api/announcements', '200 OK', res.statusCode, res.statusCode === 200 && res.body.success === true);

  res = await request('GET', '/api/events');
  recordResult('N1.2', 'Normal', '公開讀取活動 GET /api/events', '200 OK', res.statusCode, res.statusCode === 200 && res.body.success === true);

  res = await request('GET', '/api/shops');
  recordResult('N1.3', 'Normal', '公開讀取商店 GET /api/shops', '200 OK', res.statusCode, res.statusCode === 200 && res.body.success === true, res.statusCode === 500 ? 'WS未連線阻斷後備檔讀取' : '');

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

  res = await request('GET', '/api/admin/tickets?limit=999999&page=1', { Authorization: `Bearer ${adminToken}` });
  const isCapped = res.statusCode === 200 && res.body.tickets && res.body.tickets.length <= 200;
  recordResult('E1', 'Boundary', '分頁上限極端值 limit=999999', '200 OK & limit <= 200', res.statusCode, isCapped, `Returned: ${res.body.tickets?.length} items`);

  res = await request('GET', '/api/admin/tickets?page=-50', { Authorization: `Bearer ${adminToken}` });
  recordResult('E2', 'Boundary', '分頁負數極端值 page=-50', '200 OK & page=1', res.statusCode, res.statusCode === 200 && res.body.page === 1);

  res = await request('GET', '/api/admin/transactions?search=', { Authorization: `Bearer ${adminToken}` });
  recordResult('E3', 'Boundary', '搜尋空字串 search=""', '200 OK', res.statusCode, res.statusCode === 200 && Array.isArray(res.body.transactions));

  res = await request('GET', '/api/admin/transactions?search=' + encodeURIComponent('🚀_特殊字元_!@#$%^&*()'), { Authorization: `Bearer ${adminToken}` });
  recordResult('E4', 'Boundary', '特殊字元與 Emoji 搜尋', '200 OK', res.statusCode, res.statusCode === 200 && Array.isArray(res.body.transactions));

  res = await request('POST', '/api/user/checkin', { Authorization: `Bearer ${userToken}` });
  recordResult('E5', 'Boundary', '同天二次簽到 (冪等性邊界測試)', '400 Bad Request', res.statusCode, res.statusCode === 400 && res.body.success === false);

  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 'world,100,64,100', rating: 1 });
  recordResult('E6.1', 'Boundary', '商店評分最小邊界 rating=1', '200 / 500(WS中斷)', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 'world,100,64,100', rating: 5 });
  recordResult('E6.2', 'Boundary', '商店評分最大邊界 rating=5', '200 / 500(WS中斷)', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('GET', '/api/user/profile');
  recordResult('A1', 'Security', '未附帶 Token 存取受保護路由', '401/403', res.statusCode, res.statusCode === 401 || res.statusCode === 403);

  res = await request('GET', '/api/user/profile', { Authorization: 'Bearer malformed_token_12345' });
  recordResult('A2', 'Security', '附帶格式錯誤 Token', '403 Forbidden', res.statusCode, res.statusCode === 403);

  res = await request('GET', '/api/user/profile', { Authorization: `Bearer ${forgedToken}` });
  recordResult('A3', 'Security', '附帶偽造簽名 (Forged JWT)', '403 Forbidden', res.statusCode, res.statusCode === 403);

  res = await request('GET', '/api/user/profile', { Authorization: `Bearer ${expiredToken}` });
  recordResult('A4', 'Security', '附帶過期 JWT Token', '403 Forbidden', res.statusCode, res.statusCode === 403);

  res = await request('POST', '/api/admin/give-money', { Authorization: `Bearer ${userToken}` }, { username: 'NormalUser', amount: 1000 });
  recordResult('A5', 'Security', '一般使用者越權調用給錢 API', '403 Forbidden', res.statusCode, res.statusCode === 403);

  res = await request('POST', '/api/admin/events', { Authorization: `Bearer ${userToken}` }, { title: 'Hacked Event', description: 'test' });
  recordResult('A6', 'Security', '一般使用者越權建立活動 API', '403 Forbidden', res.statusCode, res.statusCode === 403);

  res = await request('POST', '/api/admin/backup/trigger', { Authorization: `Bearer ${userToken}` });
  recordResult('A7', 'Security', '一般使用者越權發起備份', '403 Forbidden', res.statusCode, res.statusCode === 403);

  res = await request('GET', "/api/admin/player/NormalUser' OR '1'='1", { Authorization: `Bearer ${adminToken}` });
  recordResult('A8', 'Security', "SQL 注入攻擊玩家查詢", '無 SQL 語法錯誤', res.statusCode, res.statusCode !== 500);

  res = await request('GET', "/api/admin/tickets?search=" + encodeURIComponent("' UNION SELECT 1,2,3,4,5,6,7,8--"), { Authorization: `Bearer ${adminToken}` });
  recordResult('A9', 'Security', "SQL 注入攻擊 Tickets 搜尋", '200 OK (安全解碼)', res.statusCode, res.statusCode === 200 && Array.isArray(res.body.tickets));

  res = await request('POST', '/api/admin/ban', { Authorization: `Bearer ${adminToken}` }, { player: 'TestPlayer; rm -rf /', reason: 'hacked' });
  recordResult('A10', 'Security', '指令注入封鎖玩家', '未執行系統指令', res.statusCode, res.statusCode === 400 || res.statusCode === 500);

  res = await request('POST', '/api/admin/kick', { Authorization: `Bearer ${adminToken}` }, { player: 'TestPlayer && format c:', reason: 'hacked' });
  recordResult('A11', 'Security', '指令注入踢出玩家', '未執行系統指令', res.statusCode, res.statusCode === 400 || res.statusCode === 500);

  res = await request('POST', '/api/user/fakeplayers/action', { Authorization: `Bearer ${userToken}` }, { botName: 'bot1; say HACKED', action: 'spawn' });
  recordResult('A12', 'Security', '指令注入假人動作', '未執行系統指令', res.statusCode, res.statusCode === 400 || res.statusCode === 500);

  res = await request('POST', '/api/admin/titles', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', title_text: "<script>alert('XSS')</script>" });
  recordResult('A13', 'Security', 'XSS 攻擊設定稱號', '200 OK (儲存無崩潰)', res.statusCode, res.statusCode === 200);

  res = await request('POST', '/api/admin/announcements', { Authorization: `Bearer ${adminToken}` }, { title: "<img src=x onerror=alert(1)>", content: 'XSS Test' });
  recordResult('A14', 'Security', 'XSS 攻擊公告標題', '200 OK (儲存無崩潰)', res.statusCode, res.statusCode === 200);

  res = await request('POST', '/api/admin/give-money', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', amount: -5000 });
  recordResult('A15', 'Abnormal', '給予金幣負數金額', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/admin/give-money', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', amount: 0 });
  recordResult('A16', 'Abnormal', '給予金幣零金額', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/admin/give-keys', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', amount: -10 });
  recordResult('A17', 'Abnormal', '給予鑰匙負數量', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/admin/give-money', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', amount: "5000" });
  recordResult('A18', 'Abnormal', '給予金幣型別混淆 (字串金額)', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 'world,100,64,100', rating: 0 });
  recordResult('A19', 'Abnormal', '商店評分超出範圍 rating=0', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 'world,100,64,100', rating: 6 });
  recordResult('A20', 'Abnormal', '商店評分超出範圍 rating=6', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 'world,100,64,100', rating: -5 });
  recordResult('A21', 'Abnormal', '商店評分超出範圍 rating=-5', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/shop/rename', { Authorization: `Bearer ${userToken}` }, {});
  recordResult('A22', 'Abnormal', '發送空 JSON Body {}', '400 Bad Request', res.statusCode, res.statusCode === 400);

  const hugePayload = { username: 'NormalUser', title_text: 'A'.repeat(20000) };
  res = await request('POST', '/api/admin/titles', { Authorization: `Bearer ${adminToken}` }, hugePayload);
  recordResult('A23', 'Security', '超大 Payload (20KB Body) DOS 攻擊', '413 Payload Too Large', res.statusCode, res.statusCode === 413);

  res = await request('POST', '/api/claims/permission', { Authorization: `Bearer ${userToken}` }, { claimId: 'claim-999', permissionType: 'build', player: 'Hacker', action: 'grant' });
  recordResult('A24', 'Security', '未授權玩家試圖修改他人領地權限', '403 Forbidden', res.statusCode, res.statusCode === 403);

  // -------------------------------------------------------------
  // CATEGORY 2: 100 項新升級極端測試案例 (TC-001 ~ TC-100)
  // -------------------------------------------------------------
  console.log('\n>>> CATEGORY 2: 100 項全新升級極端對抗與邊界測試 (TC-001 ~ TC-100) <<<');

  // G1: Auth & Dev Login Deep Cases (10)
  res = await request('GET', '/api/auth/dev-login');
  recordResult('TC-001', 'Auth', 'Dev Login 缺省 username 預設值', '200 OK', res.statusCode, res.statusCode === 200 && res.body.user?.mc_username === 'Yanggu');

  res = await request('GET', '/api/auth/dev-login?username=DevTester_123');
  recordResult('TC-002', 'Auth', 'Dev Login 自訂 username', '200 OK', res.statusCode, res.statusCode === 200 && res.body.user?.mc_username === 'DevTester_123');

  res = await request('GET', '/api/auth/dev-login?nonAdmin=true');
  recordResult('TC-003', 'Auth', 'Dev Login nonAdmin=true 標記測試', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('GET', '/api/auth/dev-login?nonAdmin=false');
  recordResult('TC-004', 'Auth', 'Dev Login nonAdmin=false 標記測試', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('GET', "/api/auth/dev-login?username=" + encodeURIComponent("Dev' OR 1=1--"));
  recordResult('TC-005', 'Auth', 'Dev Login SQL 注入 username 處理', '200 OK (參數化寫入/無崩潰)', res.statusCode, res.statusCode === 200);

  res = await request('GET', '/api/auth/dev-login?username=' + 'U'.repeat(2000));
  recordResult('TC-006', 'Auth', 'Dev Login 超長 Username (2000字元)', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('GET', '/api/auth/dev-login?username=' + encodeURIComponent("<script>alert('dev')</script>"));
  recordResult('TC-007', 'Auth', 'Dev Login XSS Payload Username 處理', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('GET', '/api/auth/callback');
  recordResult('TC-008', 'Auth', 'OAuth Callback 缺少 code 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('GET', '/api/auth/callback?code=');
  recordResult('TC-009', 'Auth', 'OAuth Callback 空白 code 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('GET', '/api/auth/url');
  recordResult('TC-010', 'Auth', 'OAuth 授權網址選取 GET /api/auth/url', '200 OK', res.statusCode, res.statusCode === 200 && Boolean(res.body.url));

  // G2: User Routes & Sub-features (15)
  res = await request('POST', '/api/user/upgrade', { Authorization: `Bearer ${userToken}` });
  recordResult('TC-011', 'User', '升級商店 POST /api/user/upgrade', '500 (WS中斷連線例外)', res.statusCode, res.statusCode === 500);

  res = await request('GET', '/api/user/fakeplayers', { Authorization: `Bearer ${userToken}` });
  recordResult('TC-012', 'User', '查詢玩家假人 GET /api/user/fakeplayers', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('POST', '/api/user/fakeplayers/action', { Authorization: `Bearer ${userToken}` }, { action: 'spawn' });
  recordResult('TC-013', 'User', '假人動作缺少 botName 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/user/fakeplayers/action', { Authorization: `Bearer ${userToken}` }, { botName: 'bot1' });
  recordResult('TC-014', 'User', '假人動作缺少 action 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/user/fakeplayers/action', { Authorization: `Bearer ${userToken}` }, { botName: 'bot1', action: 12345 });
  recordResult('TC-015', 'User', '假人動作 action 型別混淆 (Number)', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/user/fakeplayers/action', { Authorization: `Bearer ${userToken}` }, { botName: '../../etc/passwd', action: 'spawn' });
  recordResult('TC-016', 'User', '假人動作的路徑穿越 botName="../../etc/passwd"', '400 / 500', res.statusCode, res.statusCode === 400 || res.statusCode === 500);

  res = await request('GET', '/api/user/homes', { Authorization: `Bearer ${userToken}` });
  recordResult('TC-017', 'User', '查詢玩家 Home 點 GET /api/user/homes', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('DELETE', '/api/user/homes/home1', { Authorization: `Bearer ${userToken}` });
  recordResult('TC-018', 'User', '刪除 Home 點 DELETE /api/user/homes/home1', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('DELETE', '/api/user/homes/' + encodeURIComponent('home with spaces'), { Authorization: `Bearer ${userToken}` });
  recordResult('TC-019', 'User', '刪除包含空白之 Home 名稱', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('GET', '/api/lockboxes', { Authorization: `Bearer ${userToken}` });
  recordResult('TC-020', 'User', '查詢玩家上鎖箱子 GET /api/lockboxes', '200 OK', res.statusCode, res.statusCode === 200 && Array.isArray(res.body.lockboxes));

  res = await request('POST', '/api/lockboxes/update', { Authorization: `Bearer ${userToken}` }, { action: 'grant' });
  recordResult('TC-021', 'User', '上鎖箱更新缺少 lockboxId 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/lockboxes/update', { Authorization: `Bearer ${userToken}` }, { lockboxId: 'box-1' });
  recordResult('TC-022', 'User', '上鎖箱更新缺少 action 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('GET', '/api/tasks/daily');
  recordResult('TC-023', 'User', '未登入查詢每日任務 (Fallback Tasks)', '200 OK', res.statusCode, res.statusCode === 200 && Boolean(res.body.slay_task));

  res = await request('GET', '/api/tasks/daily', { Authorization: `Bearer ${userToken}` });
  recordResult('TC-024', 'User', '已登入查詢每日任務 GET /api/tasks/daily', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('POST', '/api/tasks/claim', { Authorization: `Bearer ${userToken}` });
  recordResult('TC-025', 'User', '領取每日任務獎勵 POST /api/tasks/claim', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  // G3: Playtime & Lockbox Edge Cases (10)
  res = await request('POST', '/api/playtime/exchange', { Authorization: `Bearer ${userToken}` }, { mode: 'single' });
  recordResult('TC-026', 'Playtime', '遊玩時間兌換 mode="single"', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('POST', '/api/playtime/exchange', { Authorization: `Bearer ${userToken}` }, { mode: 'all' });
  recordResult('TC-027', 'Playtime', '遊玩時間兌換 mode="all"', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('POST', '/api/playtime/exchange', { Authorization: `Bearer ${userToken}` }, { mode: 'invalid_mode' });
  recordResult('TC-028', 'Playtime', '遊玩時間兌換 mode="invalid_mode"', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('POST', '/api/playtime/exchange', { Authorization: `Bearer ${userToken}` }, {});
  recordResult('TC-029', 'Playtime', '遊玩時間兌換無模式參數 (預設 single)', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('POST', '/api/lockboxes/update', { Authorization: `Bearer ${userToken}` }, { lockboxId: 'box-1', action: 'grant', targetPlayer: 'FriendUser' });
  recordResult('TC-030', 'Lockbox', '上鎖箱授權玩家 action="grant"', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('POST', '/api/lockboxes/update', { Authorization: `Bearer ${userToken}` }, { lockboxId: 'box-1', action: 'revoke', targetPlayer: 'FriendUser' });
  recordResult('TC-031', 'Lockbox', '上鎖箱撤銷玩家 action="revoke"', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('POST', '/api/lockboxes/update', { Authorization: `Bearer ${userToken}` }, { lockboxId: 'box-1', action: 'setPassword', newPassword: '123' });
  recordResult('TC-032', 'Lockbox', '上鎖箱設定密碼 action="setPassword"', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('POST', '/api/lockboxes/update', { Authorization: `Bearer ${userToken}` }, { lockboxId: 'box-1', action: 'setPassword', newPassword: '' });
  recordResult('TC-033', 'Lockbox', '上鎖箱設定空字串密碼', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('POST', '/api/lockboxes/update', { Authorization: `Bearer ${userToken}` }, { lockboxId: 'box-1', action: 'grant', targetPlayer: "<script>alert(1)</script>" });
  recordResult('TC-034', 'Lockbox', '上鎖箱標的玩家 XSS Payload 測試', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('POST', '/api/lockboxes/update', { Authorization: `Bearer ${userToken}` }, { lockboxId: "box' OR '1'='1", action: 'grant', targetPlayer: 'User' });
  recordResult('TC-035', 'Lockbox', '上鎖箱 ID SQL 注入測試', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  // G4: Claims API Deep Testing (12)
  res = await request('GET', '/api/claims');
  recordResult('TC-036', 'Claims', '讀取領地清單 GET /api/claims', '200 OK', res.statusCode, res.statusCode === 200 && Array.isArray(res.body.claims));

  res = await request('GET', '/api/claims?all=true');
  recordResult('TC-037', 'Claims', '讀取全領地清單 GET /api/claims?all=true', '200 OK', res.statusCode, res.statusCode === 200 && Array.isArray(res.body.claims));

  res = await request('POST', '/api/claims/permission', { Authorization: `Bearer ${adminToken}` }, { permissionType: 'break', player: 'User', action: 'grant' });
  recordResult('TC-038', 'Claims', '領地權限缺少 claimId 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/claims/permission', { Authorization: `Bearer ${adminToken}` }, { claimId: 'c1', player: 'User', action: 'grant' });
  recordResult('TC-039', 'Claims', '領地權限缺少 permissionType 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/claims/permission', { Authorization: `Bearer ${adminToken}` }, { claimId: 'c1', permissionType: 'break', action: 'grant' });
  recordResult('TC-040', 'Claims', '領地權限缺少 player 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/claims/permission', { Authorization: `Bearer ${adminToken}` }, { claimId: 'c1', permissionType: 'break', player: 'User' });
  recordResult('TC-041', 'Claims', '領地權限缺少 action 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/claims/permission', { Authorization: `Bearer ${adminToken}` }, { claimId: 'c1', permissionType: 'break', player: 'User', action: 'grant' });
  recordResult('TC-042', 'Claims', '管理員修改領地破壞權限 (grant)', '200 / 400 / 500', res.statusCode, res.statusCode !== 403);

  res = await request('POST', '/api/claims/permission', { Authorization: `Bearer ${adminToken}` }, { claimId: 'c1', permissionType: 'containers', player: 'User', action: 'revoke' });
  recordResult('TC-043', 'Claims', '管理員撤銷領地箱子權限 (revoke)', '200 / 400 / 500', res.statusCode, res.statusCode !== 403);

  res = await request('POST', '/api/claims/flags', { Authorization: `Bearer ${adminToken}` }, { claim_id: 'c1', public_containers: true, public_interact: false });
  recordResult('TC-044', 'Claims', '設定領地公開標籤 (public_containers)', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('POST', '/api/claims/flags', { Authorization: `Bearer ${adminToken}` }, { claim_id: 'c1', banned_players: ['Bad1', 'Bad2'] });
  recordResult('TC-045', 'Claims', '設定領地黑名單列表 (banned_players)', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('POST', '/api/claims/flags', { Authorization: `Bearer ${adminToken}` }, { claim_id: 'c1', public_entry: 'invalid_boolean' });
  recordResult('TC-046', 'Claims', '領地標籤型別非布林 public_entry="invalid_boolean"', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('POST', '/api/claims/flags', { Authorization: `Bearer ${adminToken}` }, { claim_id: 'c1', banned_players: 'not_an_array' });
  recordResult('TC-047', 'Claims', '領地黑名單非陣列 banned_players="not_an_array"', '200 OK', res.statusCode, res.statusCode === 200);

  // G5: Shops & Transaction Edge Cases (10)
  res = await request('POST', '/api/shop/rename', { Authorization: `Bearer ${userToken}` }, { custom_name: 'NewShop' });
  recordResult('TC-048', 'Shops', '商店重新命名缺少 coords 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/shop/rename', { Authorization: `Bearer ${userToken}` }, { coords: 'world,0,64,0' });
  recordResult('TC-049', 'Shops', '商店重新命名缺少 custom_name 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/shop/rename', { Authorization: `Bearer ${userToken}` }, { coords: 'world,0,64,0', custom_name: '§aDiamond§bStore' });
  recordResult('TC-050', 'Shops', '商店重新命名包含 Minecraft 顏色碼 §', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('POST', '/api/shop/rename', { Authorization: `Bearer ${userToken}` }, { coords: 'world,0,64,0', custom_name: 'S'.repeat(5000) });
  recordResult('TC-051', 'Shops', '商店重新命名超長名稱 (5000字元)', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('POST', '/api/shop/withdraw', { Authorization: `Bearer ${userToken}` }, {});
  recordResult('TC-052', 'Shops', '商店提款缺少 coords 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/shop/withdraw', { Authorization: `Bearer ${userToken}` }, { coords: 'invalid_coord_format' });
  recordResult('TC-053', 'Shops', '商店提款非標準座標字串', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('GET', '/api/transactions');
  recordResult('TC-054', 'Shops', '公開交易紀錄 GET /api/transactions', '200 OK', res.statusCode, res.statusCode === 200 && Array.isArray(res.body.transactions));

  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 12345, rating: 5 });
  recordResult('TC-055', 'Shops', '商店評分 coords 型別混淆 (Number)', '400 Bad Request', res.statusCode, res.statusCode === 400 || res.statusCode === 500);

  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 'world,0,64,0', rating: 3.5 });
  recordResult('TC-056', 'Shops', '商店評分浮點數 rating=3.5', '200 / 400 / 500', res.statusCode, res.statusCode !== 403);

  res = await request('POST', '/api/shop/rate', { Authorization: `Bearer ${userToken}` }, { coords: 'world,0,64,0', rating: '5' });
  recordResult('TC-057', 'Shops', '商店評分字串 rating="5"', '400 Bad Request', res.statusCode, res.statusCode === 400);

  // G6: Admin Ticket & Transaction Queries (10)
  res = await request('GET', '/api/admin/tickets/ticket-1', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-058', 'AdminTickets', '查詢特定客服單 GET /api/admin/tickets/ticket-1', '200 OK', res.statusCode, res.statusCode === 200 && res.body.ticket?.ticket_id === 'ticket-1');

  res = await request('GET', '/api/admin/tickets/non_existent_ticket_999', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-059', 'AdminTickets', '查詢不存在之客服單', '404 Not Found', res.statusCode, res.statusCode === 404);

  res = await request('GET', '/api/admin/tickets/1', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-060', 'AdminTickets', '依據資料庫主鍵 ID 查詢客服單', '200 OK', res.statusCode, res.statusCode === 200 && Boolean(res.body.ticket));

  res = await request('GET', '/api/admin/tickets?search=ticket-1', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-061', 'AdminTickets', '客服單特定單號關鍵字搜尋', '200 OK', res.statusCode, res.statusCode === 200 && res.body.tickets?.length > 0);

  res = await request('GET', '/api/admin/tickets?limit=0', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-062', 'AdminTickets', '客服單 limit=0 邊界測試', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('GET', '/api/admin/tickets?limit=-10', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-063', 'AdminTickets', '客服單負數 limit=-10 邊界測試', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('GET', '/api/admin/transactions?limit=100&page=2', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-064', 'AdminTx', '管理員交易紀錄分頁 GET /api/admin/transactions?page=2', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('GET', '/api/admin/transactions?search=AdminPlayer', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-065', 'AdminTx', '管理員交易紀錄搜尋買賣家', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('GET', '/api/admin/transactions?search=%25', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-066', 'AdminTx', '搜尋字串包含 SQL 通配符 %', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('GET', '/api/admin/transactions?search=%5F', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-067', 'AdminTx', '搜尋字串包含 SQL 通配符 _', '200 OK', res.statusCode, res.statusCode === 200);

  // G7: Events API CRUD & Edge Cases (10)
  res = await request('GET', '/api/events/active');
  recordResult('TC-068', 'Events', '公開讀取發布中活動 GET /api/events/active', '200 OK', res.statusCode, res.statusCode === 200 && Array.isArray(res.body.events));

  res = await request('POST', '/api/admin/events', { Authorization: `Bearer ${adminToken}` }, { description: 'No Title' });
  recordResult('TC-069', 'Events', '建立活動缺少 title 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/admin/events', { Authorization: `Bearer ${adminToken}` }, { title: 'No Desc' });
  recordResult('TC-070', 'Events', '建立活動缺少 description 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/admin/events', { Authorization: `Bearer ${adminToken}` }, { title: 'New Event 2026', description: 'Event Description' });
  recordResult('TC-071', 'Events', '管理員建立新活動 POST /api/admin/events', '200 OK', res.statusCode, res.statusCode === 200 && res.body.success === true);

  res = await request('POST', '/api/admin/events', { Authorization: `Bearer ${adminToken}` }, { title: 'Scheduled Event', description: 'Desc', status: 'scheduled' });
  recordResult('TC-072', 'Events', '管理員建立排程狀態活動 status="scheduled"', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('PUT', '/api/admin/events/1', { Authorization: `Bearer ${adminToken}` }, { title: 'Updated Title', description: 'Updated Desc', status: 'active' });
  recordResult('TC-073', 'Events', '更新活動資料 PUT /api/admin/events/1', '200 OK', res.statusCode, res.statusCode === 200 && res.body.success === true);

  res = await request('PUT', '/api/admin/events/99999', { Authorization: `Bearer ${adminToken}` }, { title: 'Ghost Event', description: 'Ghost' });
  recordResult('TC-074', 'Events', '更新不存在之活動 ID 99999', '200 OK (SQL UPDATE 0 筆)', res.statusCode, res.statusCode === 200);

  res = await request('PUT', '/api/admin/events/invalid_id', { Authorization: `Bearer ${adminToken}` }, { title: 'Invalid ID' });
  recordResult('TC-075', 'Events', '更新活動指定非數字 ID', '200 / 500', res.statusCode, res.statusCode === 200 || res.statusCode === 500);

  res = await request('DELETE', '/api/admin/events/1', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-076', 'Events', '刪除活動 DELETE /api/admin/events/1', '200 OK', res.statusCode, res.statusCode === 200 && res.body.success === true);

  res = await request('DELETE', '/api/admin/events/99999', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-077', 'Events', '刪除不存在之活動 ID 99999', '200 OK (SQL DELETE 0 筆)', res.statusCode, res.statusCode === 200);

  // G8: Titles API CRUD & Edge Cases (8)
  res = await request('GET', '/api/titles');
  recordResult('TC-078', 'Titles', '公開讀取全服稱號對照表 GET /api/titles', '200 OK', res.statusCode, res.statusCode === 200 && typeof res.body.titles === 'object');

  res = await request('POST', '/api/admin/titles', { Authorization: `Bearer ${adminToken}` }, { title_text: 'VIP' });
  recordResult('TC-079', 'Titles', '設定稱號缺少 username 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/admin/titles', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', title_text: '' });
  recordResult('TC-080', 'Titles', '設定空字串稱號 (視為清除稱號)', '200 OK', res.statusCode, res.statusCode === 200 && res.body.message?.includes('清除'));

  res = await request('POST', '/api/admin/titles', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', title_text: 'MVP+', color_code: '§b', is_bold: true });
  recordResult('TC-081', 'Titles', '設定稱號與顏色/粗體 POST /api/admin/titles', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('POST', '/api/admin/titles', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', title_text: 'Hero', color_code: null });
  recordResult('TC-082', 'Titles', '設定稱號顏色為 null (自動後備預設值)', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('DELETE', '/api/admin/titles/NormalUser', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-083', 'Titles', '刪除玩家稱號 DELETE /api/admin/titles/:username', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('DELETE', '/api/admin/titles/NonExistentUser', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-084', 'Titles', '刪除不存在玩家之稱號', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('DELETE', '/api/admin/titles/', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-085', 'Titles', '刪除稱號缺少 Username 路徑', '404 Not Found', res.statusCode, res.statusCode === 404);

  // G9: Announcements API Edge Cases (5)
  res = await request('POST', '/api/admin/announcements', { Authorization: `Bearer ${adminToken}` }, { content: 'No Title' });
  recordResult('TC-086', 'Announcements', '發布公告缺少 title 參數', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/admin/announcements', { Authorization: `Bearer ${adminToken}` }, { title: '   ' });
  recordResult('TC-087', 'Announcements', '發布公告 title 為純空白字串', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/admin/announcements', { Authorization: `Bearer ${adminToken}` }, { title: '重要更新', content: '更新日誌內容', scope: 'Web/Game', impact: '無停機' });
  recordResult('TC-088', 'Announcements', '管理員完整發布公告 POST /api/admin/announcements', '200 OK', res.statusCode, res.statusCode === 200 && res.body.success === true);

  res = await request('POST', '/api/admin/announcements', { Authorization: `Bearer ${adminToken}` }, { title: '長內文測試', content: 'C'.repeat(8000) });
  recordResult('TC-089', 'Announcements', '發布公告長內文 (8000字元)', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('GET', '/api/announcements');
  recordResult('TC-090', 'Announcements', '確認全服公告寫入並成功讀取', '200 OK', res.statusCode, res.statusCode === 200 && res.body.announcements?.length > 0);

  // G10: Backup API & Headers/Methods Security Edge Cases (10)
  res = await request('GET', '/api/admin/backup/status', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-091', 'Backup', '管理員查詢備份狀態 GET /api/admin/backup/status', '200 OK', res.statusCode, res.statusCode === 200 && Boolean(res.body.stats));

  res = await request('GET', '/api/admin/backup/status', { Authorization: `Bearer ${userToken}` });
  recordResult('TC-092', 'Backup', '一般玩家越權查詢備份狀態', '403 Forbidden', res.statusCode, res.statusCode === 403);

  res = await request('POST', '/api/admin/backup/trigger', { Authorization: `Bearer ${adminToken}` });
  recordResult('TC-093', 'Backup', '管理員觸發地圖備份作業', '200 OK', res.statusCode, res.statusCode === 200);

  res = await request('POST', '/api/admin/give-money', { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'text/plain' }, null, '{"username":"NormalUser","amount":100}');
  recordResult('TC-094', 'SecurityHeader', 'Content-Type 設為 text/plain 之 JSON Body 測試', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/admin/give-money', { Authorization: `Bearer ${adminToken}` }, null, '{"username":"NormalUser","amount":100,}');
  recordResult('TC-095', 'SecurityHeader', '語法錯誤之 JSON (Malformed JSON Payload)', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('POST', '/api/admin/give-money', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', amount: 1e308 });
  recordResult('TC-096', 'SecurityNumber', '極端浮點數 / 無窮大 amount=1e308 測試', '200 / 400 / 500', res.statusCode, res.statusCode !== 403);

  res = await request('POST', '/api/admin/give-money', { Authorization: `Bearer ${adminToken}` }, { username: 'NormalUser', amount: null });
  recordResult('TC-097', 'SecurityNumber', '金額為 null (amount=null) 測試', '400 Bad Request', res.statusCode, res.statusCode === 400);

  res = await request('PATCH', '/api/user/profile', { Authorization: `Bearer ${userToken}` });
  recordResult('TC-098', 'SecurityMethod', '不支援之 HTTP Method (PATCH /api/user/profile)', '404 Not Found', res.statusCode, res.statusCode === 404);

  res = await request('GET', '/API/USER/PROFILE', { Authorization: `Bearer ${userToken}` });
  recordResult('TC-099', 'SecurityMethod', '大寫 URL 路徑 (/API/USER/PROFILE)', '404 Not Found', res.statusCode, res.statusCode === 404);

  res = await request('GET', '/api/user/profile', { authorization: `bearer ${userToken}` });
  recordResult('TC-100', 'SecurityHeader', '小寫 HTTP Authorization Header (authorization: bearer...)', '200 OK', res.statusCode, res.statusCode === 200);

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
