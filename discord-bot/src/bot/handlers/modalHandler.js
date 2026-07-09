const announceCommand = require('../commands/公告');
const { AppError } = require('../../utils/AppError');
const logger = require('../../utils/logger');

async function modalHandler(interaction) {
  if (!interaction.isModalSubmit()) return;

  try {
    if (interaction.customId === 'announcement_modal') {
      if (announceCommand && announceCommand.handleModalSubmit) {
        await announceCommand.handleModalSubmit(interaction);
      }
    }
  } catch (error) {
    if (error instanceof AppError && error.isOperational) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: error.message, ephemeral: true });
      } else {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
    } else {
      logger.error('Error handling modal interaction', { error });
      const msg = '處理表單提交時發生錯誤！';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  }
}

module.exports = modalHandler;
