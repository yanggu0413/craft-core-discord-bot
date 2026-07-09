-- SQLite Database Schema for Craft-Core

-- 1. Bindings Table (Discord to Minecraft mapping)
CREATE TABLE IF NOT EXISTS bindings (
    discord_id TEXT PRIMARY KEY,
    mc_uuid TEXT NOT NULL UNIQUE,
    mc_username TEXT NOT NULL COLLATE NOCASE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Explicit indexes on discord_id and mc_uuid
CREATE INDEX IF NOT EXISTS idx_bindings_discord_id ON bindings(discord_id);
CREATE INDEX IF NOT EXISTS idx_bindings_mc_uuid ON bindings(mc_uuid);

-- 2. Temporary Verification Codes (Stateless Linking Verification)
CREATE TABLE IF NOT EXISTS temp_codes (
    mc_uuid TEXT PRIMARY KEY,
    mc_username TEXT NOT NULL COLLATE NOCASE,
    code TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Explicit index on code
CREATE INDEX IF NOT EXISTS idx_temp_codes_code ON temp_codes(code);

-- 3. Tickets Table (Support / Ticket logs)
CREATE TABLE IF NOT EXISTS tickets (
    ticket_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL UNIQUE,
    creator_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_tickets_channel_id ON tickets(channel_id);

-- 4. Settings Table (Dynamic persistent configuration)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
