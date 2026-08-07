const { DatabaseSync: Database } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

let db = null;
const stmts = {};
let bindUserTx = null;

/**
 * Initializes the database connection, executes schema, and pre-compiles queries.
 * @param {string} dbPath - Path to the SQLite database file or ':memory:'.
 */
async function init(dbPath) {
  if (db) {
    db.close();
  }
  
  db = new Database(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');

  // Load and run the schema.sql file located in the same folder
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

    db.exec('CREATE INDEX IF NOT EXISTS idx_bindings_username ON bindings(mc_username COLLATE NOCASE)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_bindings_discord_id ON bindings(discord_id)');


    // Migration: add keys_count and last_checkin columns to bindings table if they don't exist
    try {
      db.exec('ALTER TABLE bindings ADD COLUMN keys_count INTEGER DEFAULT 0');
    } catch (e) {
      // Ignore if column already exists
    }
    try {
      db.exec('ALTER TABLE bindings ADD COLUMN last_checkin TEXT');
    } catch (e) {
      // Ignore if column already exists
    }
    try {
      db.exec('ALTER TABLE bindings ADD COLUMN checkin_streak INTEGER DEFAULT 0');
    } catch (e) {
      // Ignore if column already exists
    }
    try {
      db.exec('ALTER TABLE bindings ADD COLUMN total_checkins INTEGER DEFAULT 0');
    } catch (e) {
      // Ignore if column already exists
    }
    try {
      db.exec('ALTER TABLE bindings ADD COLUMN subscribe_reminder INTEGER DEFAULT 0');
    } catch (e) {
      // Ignore if column already exists
    }
    try {
      db.exec('ALTER TABLE bindings ADD COLUMN exchanged_ticks INTEGER DEFAULT 0');
    } catch (e) {
      // Ignore if column already exists
    }
    try {
      db.exec('ALTER TABLE bindings ADD COLUMN discord_tag TEXT');
    } catch (e) {
      // Ignore if column already exists
    }

    // Migration: add ticket backup columns
    try {
      db.exec('ALTER TABLE tickets ADD COLUMN creator_username TEXT');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE tickets ADD COLUMN channel_name TEXT');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE tickets ADD COLUMN closed_by TEXT');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE tickets ADD COLUMN transcript_json TEXT');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE tickets ADD COLUMN transcript_text TEXT');
    } catch (e) {}

    // Migration: ensure warp_submissions table exists
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS warp_submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          applicant_username TEXT,
          applicant_discord_id TEXT,
          facility_name TEXT,
          function_desc TEXT,
          coords TEXT,
          dimension TEXT,
          status TEXT,
          admin_reviewer TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) {}
    // Migration: ensure ai_user_persona table exists
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_user_persona (
          user_id TEXT PRIMARY KEY,
          persona_key TEXT NOT NULL DEFAULT 'default',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) {}

    // Migration: ensure user_custom_personas table exists (up to 3 slots per user)
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_custom_personas (
          user_id TEXT NOT NULL,
          slot_index INTEGER NOT NULL CHECK(slot_index BETWEEN 1 AND 3),
          persona_name TEXT NOT NULL,
          persona_prompt TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, slot_index)
        )
      `);
    } catch (e) {}
  } else {

    throw new Error(`Database initialization failed: schema.sql not found at ${schemaPath}`);
  }

  // Pre-compiled prepared statements for fast execution and query sanitation
  
  // 1. Bindings Operations
  stmts.addBinding = db.prepare(`
    INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username)
    VALUES (?, ?, ?)
  `);
  stmts.getBindingByDiscordId = db.prepare('SELECT * FROM bindings WHERE discord_id = ?');
  stmts.getBindingByMcUuid = db.prepare('SELECT * FROM bindings WHERE mc_uuid = ? COLLATE NOCASE');
  stmts.getBindingByMcUsername = db.prepare('SELECT * FROM bindings WHERE mc_username = ? COLLATE NOCASE');
  stmts.removeBindingByDiscordId = db.prepare('DELETE FROM bindings WHERE discord_id = ?');
  stmts.removeBindingByMcUuid = db.prepare('DELETE FROM bindings WHERE mc_uuid = ? COLLATE NOCASE');
  stmts.removeBindingByMcUsername = db.prepare('DELETE FROM bindings WHERE mc_username = ? COLLATE NOCASE');

  // 2. Temp Codes Operations
  stmts.createTempCode = db.prepare(`
    INSERT OR REPLACE INTO temp_codes (mc_uuid, mc_username, code)
    VALUES (?, ?, ?)
  `);
  stmts.getTempCode = db.prepare('SELECT * FROM temp_codes WHERE code = ?');
  stmts.deleteTempCode = db.prepare('DELETE FROM temp_codes WHERE code = ?');
  stmts.clearExpiredTempCodes = db.prepare(`
    DELETE FROM temp_codes
    WHERE datetime(created_at) < datetime('now', '-5 minutes')
  `);

  // 3. Tickets Operations
  stmts.createTicket = db.prepare(`
    INSERT OR REPLACE INTO tickets (ticket_id, channel_id, creator_id, creator_username, channel_name, status)
    VALUES (?, ?, ?, ?, ?, 'open')
  `);
  stmts.getTicketByChannelId = db.prepare('SELECT * FROM tickets WHERE channel_id = ?');
  stmts.closeTicket = db.prepare(`
    UPDATE tickets 
    SET status = 'closed', closed_at = datetime('now'), closed_by = ?, transcript_json = ?, transcript_text = ? 
    WHERE channel_id = ?
  `);

  // 4. Settings Operations
  stmts.setSetting = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?)
  `);
  stmts.getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');

  // 5. Player Stats Operations
  stmts.incrementDeath = db.prepare(`
    INSERT INTO player_stats (mc_uuid, mc_username, deaths)
    VALUES (?, ?, 1)
    ON CONFLICT(mc_uuid) DO UPDATE SET
      deaths = deaths + 1,
      mc_username = excluded.mc_username,
      updated_at = datetime('now')
  `);
  stmts.getDeathLeaderboard = db.prepare(`
    SELECT mc_username, deaths
    FROM player_stats
    ORDER BY deaths DESC
    LIMIT ?
  `);

  // 6. Checkin & Key Operations
  stmts.getUserKeys = db.prepare('SELECT keys_count, last_checkin, mc_username, checkin_streak, total_checkins, subscribe_reminder, exchanged_ticks FROM bindings WHERE discord_id = ?');
  stmts.updateKeys = db.prepare('UPDATE bindings SET keys_count = ? WHERE discord_id = ?');
  stmts.setCheckin = db.prepare('UPDATE bindings SET last_checkin = ?, keys_count = keys_count + ? WHERE discord_id = ?');
  stmts.setCheckinWithStreak = db.prepare('UPDATE bindings SET last_checkin = ?, checkin_streak = ?, total_checkins = total_checkins + 1, keys_count = keys_count + ? WHERE discord_id = ?');
  stmts.toggleReminderSubscription = db.prepare('UPDATE bindings SET subscribe_reminder = ? WHERE discord_id = ?');
  stmts.updateExchangedTicks = db.prepare('UPDATE bindings SET exchanged_ticks = ?, keys_count = keys_count + ? WHERE discord_id = ?');
  stmts.getCheckinLeaderboard = db.prepare('SELECT mc_username, keys_count, checkin_streak, total_checkins FROM bindings ORDER BY keys_count DESC, checkin_streak DESC LIMIT ?');
  stmts.getKeysLeaderboard = db.prepare('SELECT mc_username, keys_count, checkin_streak, total_checkins FROM bindings ORDER BY keys_count DESC, checkin_streak DESC LIMIT ?');
  stmts.getStreakLeaderboard = db.prepare('SELECT mc_username, keys_count, checkin_streak, total_checkins FROM bindings ORDER BY checkin_streak DESC, total_checkins DESC LIMIT ?');
  stmts.getSubscribedUsers = db.prepare('SELECT discord_id, mc_username FROM bindings WHERE subscribe_reminder = 1');
  stmts.addKeysByMcUsername = db.prepare('UPDATE bindings SET keys_count = keys_count + ? WHERE mc_username = ? COLLATE NOCASE');
  stmts.addKeysByDiscordId = db.prepare('UPDATE bindings SET keys_count = keys_count + ? WHERE discord_id = ?');

  // 7. Offline Mails Operations
  stmts.createMail = db.prepare("INSERT INTO offline_mails (sender_discord_id, sender_username, receiver_username, item_id, quantity, nbt, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')");
  stmts.getPendingMails = db.prepare("SELECT * FROM offline_mails WHERE receiver_username = ? COLLATE NOCASE AND status = 'pending'");
  stmts.getAllMails = db.prepare("SELECT * FROM offline_mails WHERE receiver_username = ? COLLATE NOCASE");
  stmts.markMailDelivered = db.prepare("UPDATE offline_mails SET status = 'delivered', delivered_at = datetime('now') WHERE id = ?");

  // 8. Daily Stats Operations
  stmts.incrementMessage = db.prepare('INSERT INTO daily_stats (date, total_messages) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET total_messages = total_messages + 1');
  stmts.incrementDailyDeath = db.prepare('INSERT INTO daily_stats (date, total_deaths) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET total_deaths = total_deaths + 1');
  stmts.incrementLogin = db.prepare('INSERT INTO daily_stats (date, total_logins) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET total_logins = total_logins + 1');
  stmts.recordLogin = db.prepare('INSERT OR IGNORE INTO daily_logins (date, mc_username) VALUES (?, ?)');
  stmts.updateMaxOnline = db.prepare('INSERT INTO daily_stats (date, max_online) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET max_online = MAX(max_online, excluded.max_online)');
  stmts.getStats = db.prepare('SELECT * FROM daily_stats WHERE date = ?');
  stmts.getLoginCount = db.prepare('SELECT COUNT(*) as count FROM daily_logins WHERE date = ?');

  // 9. Warp Submissions Operations
  stmts.createWarpSubmission = db.prepare(`
    INSERT INTO warp_submissions (applicant_username, applicant_discord_id, facility_name, function_desc, coords, dimension, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `);
  stmts.getWarpSubmissionById = db.prepare('SELECT * FROM warp_submissions WHERE id = ?');
  stmts.updateWarpSubmissionStatus = db.prepare("UPDATE warp_submissions SET status = ?, admin_reviewer = ? WHERE id = ?");
  stmts.getPendingWarpSubmissions = db.prepare("SELECT * FROM warp_submissions WHERE status = 'pending'");
  stmts.getAllWarpSubmissions = db.prepare('SELECT * FROM warp_submissions ORDER BY created_at DESC');


  bindUserTx = (discordId, mcUuid, mcUsername, code) => {
    db.exec('BEGIN TRANSACTION');
    try {
      const existing = stmts.getBindingByMcUuid.get(mcUuid);
      if (existing) {
        throw new Error('Minecraft account is already bound to another Discord user.');
      }
      stmts.addBinding.run(discordId, mcUuid, mcUsername);
      stmts.deleteTempCode.run(code);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
}

// Wrapper APIs

async function addBinding(discordId, mcUuid, mcUsername) {
  return stmts.addBinding.run(discordId, mcUuid, mcUsername);
}

async function getBindingByDiscordId(discordId) {
  return stmts.getBindingByDiscordId.get(discordId);
}

async function getBindingByMcUuid(mcUuid) {
  return stmts.getBindingByMcUuid.get(mcUuid);
}

async function getBindingByMcUsername(mcUsername) {
  return stmts.getBindingByMcUsername.get(mcUsername);
}

async function removeBindingByDiscordId(discordId) {
  return stmts.removeBindingByDiscordId.run(discordId);
}

async function removeBindingByMcUuid(mcUuid) {
  return stmts.removeBindingByMcUuid.run(mcUuid);
}

async function removeBindingByMcUsername(mcUsername) {
  return stmts.removeBindingByMcUsername.run(mcUsername);
}

async function createTempCode(mcUuid, mcUsername, code) {
  return stmts.createTempCode.run(mcUuid, mcUsername, code);
}

async function getTempCode(code) {
  return stmts.getTempCode.get(code);
}

async function deleteTempCode(code) {
  return stmts.deleteTempCode.run(code);
}

async function clearExpiredTempCodes() {
  return stmts.clearExpiredTempCodes.run();
}

async function createTicket(ticketId, channelId, creatorId, creatorUsername = null, channelName = null) {
  return stmts.createTicket.run(ticketId, channelId, creatorId, creatorUsername, channelName);
}

async function getTicketByChannelId(channelId) {
  return stmts.getTicketByChannelId.get(channelId);
}

async function closeTicket(channelId, closedBy = null, transcriptJson = null, transcriptText = null) {
  let safeJson = transcriptJson;
  if (safeJson && safeJson.length > 50000) {
    try {
      const parsed = JSON.parse(safeJson);
      if (Array.isArray(parsed) && parsed.length > 100) {
        safeJson = JSON.stringify(parsed.slice(-100));
      }
    } catch (e) {
      safeJson = safeJson.substring(0, 50000);
    }
  }
  return stmts.closeTicket.run(closedBy, safeJson, transcriptText, channelId);
}

async function setSetting(key, value) {
  return stmts.setSetting.run(key, value);
}

async function getSetting(key) {
  const result = stmts.getSetting.get(key);
  return result ? result.value : null;
}

async function incrementDeath(mcUuid, mcUsername) {
  return stmts.incrementDeath.run(mcUuid, mcUsername);
}

async function getDeathLeaderboard(limit = 10) {
  return stmts.getDeathLeaderboard.all(limit);
}

async function getUserKeys(discordId) {
  return stmts.getUserKeys.get(discordId);
}

async function updateKeys(discordId, newCount) {
  return stmts.updateKeys.run(newCount, discordId);
}

async function setCheckin(discordId, dateStr, keysToAdd = 1) {
  return stmts.setCheckin.run(dateStr, keysToAdd, discordId);
}

async function setCheckinWithStreak(discordId, dateStr, streak, keysToAdd) {
  return stmts.setCheckinWithStreak.run(dateStr, streak, keysToAdd, discordId);
}

async function toggleReminderSubscription(discordId, status) {
  return stmts.toggleReminderSubscription.run(status, discordId);
}

async function updateExchangedTicks(discordId, newExchangedTicks, keysToAdd) {
  return stmts.updateExchangedTicks.run(newExchangedTicks, keysToAdd, discordId);
}

async function getCheckinLeaderboard(limit = 10) {
  return stmts.getCheckinLeaderboard.all(limit);
}

async function getKeysLeaderboard(limit = 10) {
  return stmts.getKeysLeaderboard.all(limit);
}

async function getStreakLeaderboard(limit = 10) {
  return stmts.getStreakLeaderboard.all(limit);
}

async function getSubscribedUsers() {
  return stmts.getSubscribedUsers.all();
}

async function addKeysByMcUsername(mcUsername, keysToAdd = 6) {
  return stmts.addKeysByMcUsername.run(keysToAdd, mcUsername);
}

async function addKeysByDiscordId(discordId, keysToAdd = 6) {
  return stmts.addKeysByDiscordId.run(keysToAdd, discordId);
}

// Mailbox methods
async function createMail(senderDiscordId, senderUsername, receiverUsername, itemId, quantity, nbt) {
  return stmts.createMail.run(senderDiscordId, senderUsername, receiverUsername, itemId, quantity, nbt);
}

async function getPendingMails(receiverUsername) {
  return stmts.getPendingMails.all(receiverUsername);
}

async function getAllMails(receiverUsername) {
  return stmts.getAllMails.all(receiverUsername);
}

async function markMailDelivered(mailId) {
  return stmts.markMailDelivered.run(mailId);
}

// Daily Stats methods
async function incrementMessage(date) {
  return stmts.incrementMessage.run(date);
}

async function incrementDailyDeath(date) {
  return stmts.incrementDailyDeath.run(date);
}

async function incrementLogin(date) {
  return stmts.incrementLogin.run(date);
}

async function recordLogin(date, mcUsername) {
  return stmts.recordLogin.run(date, mcUsername);
}

async function updateMaxOnline(date, count) {
  return stmts.updateMaxOnline.run(date, count);
}

async function getStats(date) {
  const row = stmts.getStats.get(date);
  return row !== undefined ? row : null;
}

async function getLoginCount(date) {
  const row = stmts.getLoginCount.get(date);
  return row !== undefined ? row.count : 0;
}

async function bindUser(discordId, mcUuid, mcUsername, code) {
  if (!bindUserTx) {
    throw new Error('Database not initialized');
  }
  return bindUserTx(discordId, mcUuid, mcUsername, code);
}

async function close() {
  if (db) {
    db.close();
    db = null;
  }
}

async function getImageUsage(userId, modelName, dateStr) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare('SELECT usage_count FROM ai_image_usage WHERE user_id = ? AND model_name = ? AND usage_date = ?');
  const row = stmt.get(userId, modelName, dateStr);
  return row ? row.usage_count : 0;
}

async function incrementImageUsage(userId, modelName, dateStr) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(`
    INSERT INTO ai_image_usage (user_id, model_name, usage_date, usage_count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(user_id, model_name, usage_date) DO UPDATE SET usage_count = usage_count + 1
  `);
  stmt.run(userId, modelName, dateStr);
}

/**
 * 5-hour rolling window chat rate limiter (50 messages max per 5 hours)
 */
async function checkAndRecordChatRateLimit(userId, maxMessages = 50, windowMs = 5 * 60 * 60 * 1000) {
  if (!db) throw new Error('Database not initialized');
  const now = Date.now();
  const cutoff = now - windowMs;

  // Clean old expired chat records
  try {
    db.prepare('DELETE FROM ai_chat_messages WHERE created_at < ?').run(cutoff);
  } catch (e) {}

  // Count user messages in the last 5 hours
  const countRow = db.prepare('SELECT COUNT(*) as count, MIN(created_at) as oldestTime FROM ai_chat_messages WHERE user_id = ? AND created_at >= ?').get(userId, cutoff);
  const count = countRow ? countRow.count : 0;
  const oldestTime = (countRow && countRow.oldestTime) ? countRow.oldestTime : now;

  if (count >= maxMessages) {
    const resetTime = oldestTime + windowMs;
    const remainingMs = Math.max(0, resetTime - now);
    return {
      allowed: false,
      count,
      maxMessages,
      remainingMs,
      resetMinutes: Math.ceil(remainingMs / (60 * 1000))
    };
  }

  // Record this new chat message
  db.prepare('INSERT INTO ai_chat_messages (user_id, created_at) VALUES (?, ?)').run(userId, now);

  return {
    allowed: true,
    count: count + 1,
    maxMessages,
    remainingCount: maxMessages - (count + 1)
  };
}

async function getChatUsageStatus(userId, maxMessages = 50, windowMs = 5 * 60 * 60 * 1000) {
  if (!db) throw new Error('Database not initialized');
  const now = Date.now();
  const cutoff = now - windowMs;
  const countRow = db.prepare('SELECT COUNT(*) as count, MIN(created_at) as oldestTime FROM ai_chat_messages WHERE user_id = ? AND created_at >= ?').get(userId, cutoff);
  const count = countRow ? countRow.count : 0;
  const oldestTime = (countRow && countRow.oldestTime) ? countRow.oldestTime : now;
  const remainingMs = Math.max(0, (oldestTime + windowMs) - now);

  return {
    used: count,
    limit: maxMessages,
    remaining: Math.max(0, maxMessages - count),
    resetMinutes: Math.ceil(remainingMs / (60 * 1000))
  };
}

function prepare(sql) {
  if (!db) throw new Error('Database not initialized');
  return db.prepare(sql);
}

async function createWarpSubmission(applicantUsername, applicantDiscordId, facilityName, functionDesc, coords, dimension) {
  return stmts.createWarpSubmission.run(applicantUsername, applicantDiscordId, facilityName, functionDesc, coords, dimension);
}

async function getWarpSubmissionById(id) {
  return stmts.getWarpSubmissionById.get(id);
}

async function updateWarpSubmissionStatus(id, status, adminReviewer) {
  return stmts.updateWarpSubmissionStatus.run(status, adminReviewer, id);
}

async function getPendingWarpSubmissions() {
  return stmts.getPendingWarpSubmissions.all();
}

async function getAllWarpSubmissions() {
  return stmts.getAllWarpSubmissions.all();
}

async function getUserPersona(userId) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare('SELECT persona_key FROM ai_user_persona WHERE user_id = ?');
  const row = stmt.get(userId);
  return row ? row.persona_key : 'default';
}

async function setUserPersona(userId, personaKey) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(`
    INSERT INTO ai_user_persona (user_id, persona_key, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET persona_key = excluded.persona_key, updated_at = datetime('now')
  `);
  stmt.run(userId, personaKey);
}

async function getUserCustomPersonas(userId) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare('SELECT slot_index, persona_name, persona_prompt, updated_at FROM user_custom_personas WHERE user_id = ? ORDER BY slot_index ASC');
  return stmt.all(userId);
}

async function getCustomPersonaBySlot(userId, slotIndex) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare('SELECT slot_index, persona_name, persona_prompt FROM user_custom_personas WHERE user_id = ? AND slot_index = ?');
  return stmt.get(userId, slotIndex);
}

async function saveUserCustomPersona(userId, slotIndex, personaName, personaPrompt) {
  if (!db) throw new Error('Database not initialized');
  const safeSlot = Math.min(Math.max(parseInt(slotIndex, 10) || 1, 1), 3);
  const stmt = db.prepare(`
    INSERT INTO user_custom_personas (user_id, slot_index, persona_name, persona_prompt, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, slot_index) DO UPDATE SET persona_name = excluded.persona_name, persona_prompt = excluded.persona_prompt, updated_at = datetime('now')
  `);
  stmt.run(userId, safeSlot, personaName, personaPrompt);
}

module.exports = {
  init,
  close,
  prepare,
  bindUser,
  addBinding,
  getBindingByDiscordId,
  getBindingByMcUuid,
  getBindingByMcUsername,
  removeBindingByDiscordId,
  removeBindingByMcUuid,
  removeBindingByMcUsername,
  createTempCode,
  getTempCode,
  deleteTempCode,
  clearExpiredTempCodes,
  createTicket,
  getTicketByChannelId,
  closeTicket,
  setSetting,
  getSetting,
  incrementDeath,
  getDeathLeaderboard,
  getUserKeys,
  updateKeys,
  setCheckin,
  setCheckinWithStreak,
  toggleReminderSubscription,
  updateExchangedTicks,
  getCheckinLeaderboard,
  getKeysLeaderboard,
  getStreakLeaderboard,
  getSubscribedUsers,
  addKeysByMcUsername,
  addKeysByDiscordId,
  createMail,
  getPendingMails,
  getAllMails,
  markMailDelivered,
  incrementMessage,
  incrementDailyDeath,
  incrementLogin,
  recordLogin,
  updateMaxOnline,
  getStats,
  getLoginCount,
  getImageUsage,
  incrementImageUsage,
  checkAndRecordChatRateLimit,
  getChatUsageStatus,
  createWarpSubmission,
  getWarpSubmissionById,
  updateWarpSubmissionStatus,
  getPendingWarpSubmissions,
  getAllWarpSubmissions,
  getUserPersona,
  setUserPersona,
  getUserCustomPersonas,
  getCustomPersonaBySlot,
  saveUserCustomPersona
};


