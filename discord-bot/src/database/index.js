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
function init(dbPath) {
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

  bindUserTx = (discordId, mcUuid, mcUsername, code) => {
    db.exec('BEGIN TRANSACTION');
    try {
      const existing = getBindingByMcUuid(mcUuid);
      if (existing) {
        throw new Error('Minecraft account is already bound to another Discord user.');
      }
      addBinding(discordId, mcUuid, mcUsername);
      deleteTempCode(code);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
}

// Wrapper APIs

function addBinding(discordId, mcUuid, mcUsername) {
  return stmts.addBinding.run(discordId, mcUuid, mcUsername);
}

function getBindingByDiscordId(discordId) {
  return stmts.getBindingByDiscordId.get(discordId);
}

function getBindingByMcUuid(mcUuid) {
  return stmts.getBindingByMcUuid.get(mcUuid);
}

function getBindingByMcUsername(mcUsername) {
  return stmts.getBindingByMcUsername.get(mcUsername);
}

function removeBindingByDiscordId(discordId) {
  return stmts.removeBindingByDiscordId.run(discordId);
}

function removeBindingByMcUuid(mcUuid) {
  return stmts.removeBindingByMcUuid.run(mcUuid);
}

function removeBindingByMcUsername(mcUsername) {
  return stmts.removeBindingByMcUsername.run(mcUsername);
}

function createTempCode(mcUuid, mcUsername, code) {
  return stmts.createTempCode.run(mcUuid, mcUsername, code);
}

function getTempCode(code) {
  return stmts.getTempCode.get(code);
}

function deleteTempCode(code) {
  return stmts.deleteTempCode.run(code);
}

function clearExpiredTempCodes() {
  return stmts.clearExpiredTempCodes.run();
}

function createTicket(ticketId, channelId, creatorId) {
  return stmts.createTicket.run(ticketId, channelId, creatorId);
}

function getTicketByChannelId(channelId) {
  return stmts.getTicketByChannelId.get(channelId);
}

function closeTicket(channelId) {
  return stmts.closeTicket.run(channelId);
}

function setSetting(key, value) {
  return stmts.setSetting.run(key, value);
}

function getSetting(key) {
  const result = stmts.getSetting.get(key);
  return result ? result.value : null;
}

function bindUser(discordId, mcUuid, mcUsername, code) {
  if (!bindUserTx) {
    throw new Error('Database not initialized');
  }
  return bindUserTx(discordId, mcUuid, mcUsername, code);
}

function close() {
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
  getSetting
};
