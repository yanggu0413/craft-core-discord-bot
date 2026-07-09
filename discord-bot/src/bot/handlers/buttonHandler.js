const ticketService = require('../../services/ticketService');
const { AppError } = require('../../utils/AppError');
const logger = require('../../utils/logger');

async function buttonHandler(interaction) {
  if (!interaction.isButton()) return;

  try {
    if (interaction.customId === 'create_ticket') {
      await ticketService.handleCreateTicket(interaction);
    } else if (interaction.customId === 'close_ticket') {
      await ticketService.handleCloseTicket(interaction);
    }
  } catch (error) {
    if (error instanceof AppError && error.isOperational) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: error.message, ephemeral: true });
      } else {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
    } else {
      logger.error('Error handling button interaction', { error });
      const msg = '處理按鈕操作時發生錯誤！';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  }
}

module.exports = buttonHandler;
