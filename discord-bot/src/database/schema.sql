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

-- 5. Player Stats Table (Tracking deaths, etc.)
CREATE TABLE IF NOT EXISTS player_stats (
    mc_uuid TEXT PRIMARY KEY,
    mc_username TEXT NOT NULL COLLATE NOCASE,
    deaths INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_player_stats_deaths ON player_stats(deaths);

-- 6. Offline Mails Table (R3)
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
CREATE INDEX IF NOT EXISTS idx_offline_mails_receiver ON offline_mails(receiver_username, status);

-- 7. Daily Stats Tables (R5)
CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,
    max_online INTEGER DEFAULT 0,
    total_logins INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    total_deaths INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_logins (
    date TEXT,
    mc_username TEXT,
    PRIMARY KEY (date, mc_username)
);

