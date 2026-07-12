const { AppError } = require('../../utils/AppError');
const logger = require('../../utils/logger');

/**
 * Centralized error handler middleware.
 * Catches all errors thrown down the line, logs non-operational programmer errors,
 * and replies to Discord interactions with appropriate user-facing messages.
 */
async function errorHandlerMiddleware(interaction, command, next) {
  try {
    await next();
  } catch (error) {
    // 1. Identify operational errors (AppError and subclasses)
    if (error instanceof AppError && error.isOperational) {
      const content = error.message;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content, ephemeral: true });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    } else {
      // 2. Identify programmer/unhandled errors
      // Log with the exact signature required by test assertions: logger.error('Error executing command', { error })
      logger.error('Error executing command', { error });

      const msg = '執行指令時發生錯誤！';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  }
}

module.exports = errorHandlerMiddleware;
