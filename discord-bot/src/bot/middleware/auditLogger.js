const logger = require('../../utils/logger');

/**
 * Logs command execution details including performance latency.
 */
async function auditLoggerMiddleware(interaction, command, next) {
  const startTime = Date.now();
  const commandName = command.data?.name || command.name || interaction.commandName;
  const user = interaction.user || { tag: 'UnknownUser', id: 'unknown_id' };
  
  // Format options for clean logging
  const options = interaction.options?.data?.map(opt => ({
    name: opt.name,
    value: opt.value
  })) || [];

  logger.info(`Command "${commandName}" execution started by ${user.tag} (${user.id})`, {
    commandName,
    userId: user.id,
    userTag: user.tag,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    options
  });

  try {
    await next();
    const duration = Date.now() - startTime;
    logger.info(`Command "${commandName}" executed successfully by ${user.tag} in ${duration}ms`, {
      commandName,
      userId: user.id,
      duration
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.warn(`Command "${commandName}" failed for ${user.tag} after ${duration}ms: ${error.message || error}`, {
      commandName,
      userId: user.id,
      duration,
      errorCode: error.code || 'UNKNOWN_ERROR'
    });
    // Rethrow to let the downstream/upstream error handler intercept
    throw error;
  }
}

module.exports = auditLoggerMiddleware;
