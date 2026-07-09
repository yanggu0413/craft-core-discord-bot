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

  // Load and run the schema.sql file located in the same folder
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

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
    INSERT OR REPLACE INTO tickets (ticket_id, channel_id, creator_id, status)
    VALUES (?, ?, ?, 'open')
  `);
  stmts.getTicketByChannelId = db.prepare('SELECT * FROM tickets WHERE channel_id = ?');
  stmts.closeTicket = db.prepare(`
    UPDATE tickets 
    SET status = 'closed', closed_at = datetime('now') 
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
  stmts.getUserKeys = db.prepare('SELECT keys_count, last_checkin, mc_username FROM bindings WHERE discord_id = ?');
  stmts.updateKeys = db.prepare('UPDATE bindings SET keys_count = ? WHERE discord_id = ?');
  stmts.setCheckin = db.prepare('UPDATE bindings SET last_checkin = ?, keys_count = keys_count + ? WHERE discord_id = ?');
  stmts.addKeysByMcUsername = db.prepare('UPDATE bindings SET keys_count = keys_count + ? WHERE mc_username = ? COLLATE NOCASE');
  stmts.addKeysByDiscordId = db.prepare('UPDATE bindings SET keys_count = keys_count + ? WHERE discord_id = ?');

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

async function createTicket(ticketId, channelId, creatorId) {
  return stmts.createTicket.run(ticketId, channelId, creatorId);
}

async function getTicketByChannelId(channelId) {
  return stmts.getTicketByChannelId.get(channelId);
}

async function closeTicket(channelId) {
  return stmts.closeTicket.run(channelId);
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

async function addKeysByMcUsername(mcUsername, keysToAdd = 6) {
  return stmts.addKeysByMcUsername.run(keysToAdd, mcUsername);
}

async function addKeysByDiscordId(discordId, keysToAdd = 6) {
  return stmts.addKeysByDiscordId.run(keysToAdd, discordId);
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

module.exports = {
  init,
  close,
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
  addKeysByMcUsername,
  addKeysByDiscordId
};
