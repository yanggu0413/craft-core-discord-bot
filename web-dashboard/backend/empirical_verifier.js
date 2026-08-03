const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

console.log('====================================================');
console.log('  EMPIRICAL API & DB QUERY VERIFIER (CHALLENGER 2) ');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testName, errorMsg = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName} - ${errorMsg}`);
    failCount++;
  }
}

const dbPath = path.resolve(__dirname, 'temp_verification_chal2.db');
if (fs.existsSync(dbPath)) {
  try { fs.unlinkSync(dbPath); } catch (e) {}
}

const db = new DatabaseSync(dbPath);

console.log('1. Auditing SQLite Table Definitions & Schemas...');

try {
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
      discord_tag TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      shop_coords TEXT,
      buyer TEXT,
      seller TEXT,
      sender TEXT,
      receiver TEXT,
      item TEXT,
      quantity INTEGER,
      unit_price REAL,
      tax_deducted REAL,
      net_profit REAL,
      total_price REAL,
      type TEXT
    );

    CREATE TABLE IF NOT EXISTS offline_mails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_discord_id TEXT,
      sender_username TEXT,
      receiver_username TEXT NOT NULL COLLATE NOCASE,
      item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      nbt TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'delivered')) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      delivered_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS server_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      reward_info TEXT,
      status TEXT DEFAULT 'active',
      creator_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS warp_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      applicant_username TEXT NOT NULL,
      applicant_discord_id TEXT,
      facility_name TEXT NOT NULL,
      function_desc TEXT NOT NULL,
      coords TEXT NOT NULL,
      dimension TEXT DEFAULT 'minecraft:overworld',
      status TEXT DEFAULT 'pending',
      admin_reviewer TEXT,
      warp_name TEXT,
      reject_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      scope TEXT,
      impact TEXT,
      publisher TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS player_titles (
      username TEXT PRIMARY KEY COLLATE NOCASE,
      title_text TEXT NOT NULL,
      color_code TEXT DEFAULT '§c',
      is_bold INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT UNIQUE,
      channel_id TEXT NOT NULL UNIQUE,
      creator_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      creator_username TEXT,
      channel_name TEXT,
      closed_by TEXT,
      transcript_json TEXT,
      transcript_text TEXT
    );
  `);
  assert(true, 'Database table schema initialization');
} catch (e) {
  assert(false, 'Database table schema initialization', e.message);
}

console.log('\n2. Testing SQL Queries from user.routes.ts...');

// Query 1: Sales tax sum
try {
  const row = db.prepare('SELECT SUM(tax_deducted) as total FROM transactions').get();
  assert(row !== undefined, 'user.routes.ts: SELECT SUM(tax_deducted) FROM transactions');
} catch (e) {
  assert(false, 'user.routes.ts: SELECT SUM(tax_deducted) FROM transactions', e.message);
}

// Query 2: Player count
try {
  const row = db.prepare('SELECT COUNT(*) as count FROM bindings').get();
  assert(row !== undefined, 'user.routes.ts: SELECT COUNT(*) FROM bindings');
} catch (e) {
  assert(false, 'user.routes.ts: SELECT COUNT(*) FROM bindings', e.message);
}

// Query 3: Transaction history aggregation
try {
  const rows = db.prepare(`
    SELECT strftime('%Y-%m-%d %H:00', timestamp) as time_slot, SUM(net_profit) as trade_vol
    FROM transactions
    GROUP BY time_slot
    ORDER BY time_slot ASC
    LIMIT 6
  `).all();
  assert(Array.isArray(rows), 'user.routes.ts: Transaction history aggregation query');
} catch (e) {
  assert(false, 'user.routes.ts: Transaction history aggregation query', e.message);
}

// Query 4: Welfare leaderboard
try {
  const rows = db.prepare(`
    SELECT mc_username as username, keys_count, checkin_streak, total_checkins
    FROM bindings
    ORDER BY keys_count DESC, checkin_streak DESC, total_checkins DESC
    LIMIT 10
  `).all();
  assert(Array.isArray(rows), 'user.routes.ts: Welfare leaderboard query');
} catch (e) {
  assert(false, 'user.routes.ts: Welfare leaderboard query', e.message);
}

// Query 5: Market analytics
try {
  const rows = db.prepare(`
    SELECT DATE(timestamp) as trade_date, AVG(unit_price) as avg_price, SUM(quantity) as total_vol
    FROM transactions
    WHERE item = ?
    GROUP BY DATE(timestamp)
    ORDER BY trade_date ASC
    LIMIT 7
  `).all('minecraft:diamond');
  assert(Array.isArray(rows), 'user.routes.ts: Market analytics query');
} catch (e) {
  assert(false, 'user.routes.ts: Market analytics query', e.message);
}

// Query 6: Recent market trades
try {
  const rows = db.prepare(`
    SELECT id, timestamp, shop_coords as coords, buyer, seller, item, quantity, unit_price as price, tax_deducted as tax, net_profit
    FROM transactions
    ORDER BY id DESC
    LIMIT 30
  `).all();
  assert(Array.isArray(rows), 'user.routes.ts: Recent market trades query');
} catch (e) {
  assert(false, 'user.routes.ts: Recent market trades query', e.message);
}

// Query 7: Profile stats query
try {
  const row = db.prepare(`
    SELECT keys_count, checkin_streak, total_checkins, last_checkin, subscribe_reminder, discord_id
    FROM bindings
    WHERE lower(replace(mc_username, '.', '')) = ?
       OR (discord_id IS NOT NULL AND discord_id != '' AND discord_id = ?)
       OR (mc_uuid IS NOT NULL AND mc_uuid != '' AND mc_uuid = ?)
  `).get('testuser', 'disc_123', 'uuid_123');
  assert(row === undefined, 'user.routes.ts: Profile stats query (returns undefined for missing user)');
} catch (e) {
  assert(false, 'user.routes.ts: Profile stats query', e.message);
}

// Query 8: Insert title with expiration
try {
  db.prepare(`
    INSERT INTO player_titles (username, title_text, color_code, is_bold, updated_at, expires_at)
    VALUES (?, ?, '§6', 1, ?, ?)
    ON CONFLICT(username) DO UPDATE SET 
      title_text=excluded.title_text, 
      expires_at=excluded.expires_at, 
      updated_at=excluded.updated_at
  `).run('TestUser', '[幸運歐皇]', new Date().toISOString(), new Date(Date.now() + 172800000).toISOString());
  assert(true, 'user.routes.ts: INSERT player_titles ON CONFLICT');
} catch (e) {
  assert(false, 'user.routes.ts: INSERT player_titles ON CONFLICT', e.message);
}

console.log('\n3. Testing SQL Queries from admin.routes.ts...');

// Query 9: Admin transactions list query with WHERE
try {
  const rows = db.prepare(`
    SELECT id, timestamp, shop_coords as coords, buyer, seller, sender, receiver, item, quantity, unit_price as price, tax_deducted as tax, net_profit, total_price, type
    FROM transactions
    WHERE (sender LIKE ? OR receiver LIKE ? OR buyer LIKE ? OR seller LIKE ? OR item LIKE ? OR shop_coords LIKE ?)
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all('%test%', '%test%', '%test%', '%test%', '%test%', '%test%', 10, 0);
  assert(Array.isArray(rows), 'admin.routes.ts: Admin transactions list query');
} catch (e) {
  assert(false, 'admin.routes.ts: Admin transactions list query', e.message);
}

// Query 10: Admin ticket list query with WHERE
try {
  const rows = db.prepare(`
    SELECT id, ticket_id, channel_id, channel_name, creator_id, creator_username, closed_by, closed_at 
    FROM tickets
    WHERE (ticket_id LIKE ? OR creator_username LIKE ? OR creator_id LIKE ? OR channel_name LIKE ? OR closed_by LIKE ?)
    ORDER BY id DESC LIMIT ? OFFSET ?
  `).all('%t%', '%t%', '%t%', '%t%', '%t%', 10, 0);
  assert(Array.isArray(rows), 'admin.routes.ts: Admin ticket list query');
} catch (e) {
  assert(false, 'admin.routes.ts: Admin ticket list query', e.message);
}

// Query 11: Admin warp submission approve & reject
try {
  db.prepare(`
    INSERT INTO warp_submissions (applicant_username, applicant_discord_id, facility_name, function_desc, coords, dimension)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Applicant', '123', 'Farm', 'XP Farm', '100,64,100', 'minecraft:overworld');
  
  db.prepare('UPDATE warp_submissions SET status = ?, warp_name = ? WHERE id = ?').run('approved', 'xpfarm', 1);
  db.prepare('UPDATE warp_submissions SET status = ?, reject_reason = ? WHERE id = ?').run('rejected', 'invalid coords', 1);
  assert(true, 'admin.routes.ts: Approve/reject warp submissions');
} catch (e) {
  assert(false, 'admin.routes.ts: Approve/reject warp submissions', e.message);
}

console.log('\n4. Auditing Zero-Mock Policy Compliance...');

// Check user.routes.ts for any random mock generators in API endpoints
const userRoutesContent = fs.readFileSync(path.resolve(__dirname, 'src/routes/user.routes.ts'), 'utf8');

// Ensure /market/analytics does not contain Math.random
const marketAnalyticsSection = userRoutesContent.substring(
  userRoutesContent.indexOf("/market/analytics"),
  userRoutesContent.indexOf("/market/recent")
);
assert(!marketAnalyticsSection.includes('Math.random'), 'Zero-Mock Policy: /api/market/analytics does NOT use Math.random');

// Ensure /stats does not contain fake random generator
const statsSection = userRoutesContent.substring(
  userRoutesContent.indexOf("/stats"),
  userRoutesContent.indexOf("/leaderboard")
);
assert(!statsSection.includes('Math.random'), 'Zero-Mock Policy: /api/stats does NOT use Math.random');

// Cleanup
db.close();
if (fs.existsSync(dbPath)) {
  try { fs.unlinkSync(dbPath); } catch (e) {}
}

console.log(`\n====================================================`);
console.log(`Verification Complete: ${passCount} Passed, ${failCount} Failed.`);
console.log(`====================================================`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
