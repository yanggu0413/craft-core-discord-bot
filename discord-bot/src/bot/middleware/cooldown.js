const { RateLimitError } = require('../../utils/AppError');
const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

// Memory cache for active cooldowns: commandName -> Map(userId -> expirationTimestamp)
const cooldowns = new Map();

/**
 * Enforces per-command rate limiting / cooldowns.
 * Bypasses administrators or users with admin roles.
 */
async function cooldownMiddleware(interaction, command, next) {
  const cooldownSeconds = command.cooldown || 0;
  
  if (cooldownSeconds <= 0) {
    await next();
    return;
  }

  const member = interaction.member;
  const userId = interaction.user.id;

  // Bypass check: Guild administrators do not get rate-limited
  const isAdmin = member && (
    (member.permissions && typeof member.permissions.has === 'function' && member.permissions.has(PermissionFlagsBits.Administrator)) ||
    (config.discord.adminRoleIds && member.roles && member.roles.cache && config.discord.adminRoleIds.some(rId => member.roles.cache.has(rId)))
  );

  if (isAdmin) {
    await next();
    return;
  }

  const commandName = command.data?.name || command.name || interaction.commandName;
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Map());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(commandName);
  const cooldownAmount = cooldownSeconds * 1000;

  if (timestamps.has(userId)) {
    const expirationTime = timestamps.get(userId) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      throw new RateLimitError(`請稍候 ${timeLeft.toFixed(1)} 秒後再使用此指令。`);
    }
  }

  // Set cooldown timestamp
  timestamps.set(userId, now);
  
  // Clear cooldown key after expiry to prevent memory leaks
  setTimeout(() => {
    if (timestamps.get(userId) === now) {
      timestamps.delete(userId);
    }
  }, cooldownAmount);

  await next();
}

module.exports = cooldownMiddleware;
