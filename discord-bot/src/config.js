require('dotenv').config();
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');
let configJson = {};

if (fs.existsSync(configPath)) {
  try {
    configJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('[WARNING] Failed to parse config.json, using defaults:', error);
  }
}

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID || configJson.discord?.clientId,
    guildId: process.env.DISCORD_GUILD_ID || configJson.discord?.guildId,
    adminRoleId: configJson.discord?.adminRoleId,
    adminRoleIds: Array.isArray(configJson.discord?.adminRoleId)
      ? configJson.discord.adminRoleId
      : (configJson.discord?.adminRoleId
          ? configJson.discord.adminRoleId.toString().split(',').map(s => s.trim())
          : []),
    channels: {
      chatSync: process.env.NODE_ENV === 'test' ? '1111222233334444' : (configJson.discord?.channels?.chatSync || ''),
      status: process.env.NODE_ENV === 'test' ? '5555666677778888' : (configJson.discord?.channels?.status || ''),
      ticketCategory: process.env.NODE_ENV === 'test' ? '9999000011112222' : (configJson.discord?.channels?.ticketCategory || ''),
      ticketLogs: process.env.NODE_ENV === 'test' ? '3333444455556666' : (configJson.discord?.channels?.ticketLogs || ''),
    },
    chatWebhookUrl: configJson.discord?.chatWebhookUrl,
  },
  websocket: {
    port: parseInt(process.env.WEBSOCKET_PORT || configJson.websocket?.port || '8080', 10),
    secret: process.env.WEBSOCKET_SECRET,
  },
  minecraft: {
    avatarProvider: configJson.minecraft?.avatarProvider || 'https://mc-heads.net/avatar/{uuid}',
    statusUpdateIntervalMs: configJson.minecraft?.statusUpdateIntervalMs || 10000,
  },
  database: {
    path: process.env.DATABASE_PATH || path.join(__dirname, 'database/database.db')
  }
};

// Validate critical keys
const missing = [];
if (!config.discord.token) missing.push('DISCORD_TOKEN (Environment Variable)');
if (!config.discord.clientId) missing.push('DISCORD_CLIENT_ID or discord.clientId');
if (!config.discord.guildId) missing.push('DISCORD_GUILD_ID or discord.guildId');
if (!config.websocket.secret) missing.push('WEBSOCKET_SECRET (Environment Variable)');

if (missing.length > 0) {
  console.error('CRITICAL CONFIGURATION ERROR: The following config keys are missing:');
  missing.forEach(key => console.error(`  - ${key}`));
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

module.exports = config;
