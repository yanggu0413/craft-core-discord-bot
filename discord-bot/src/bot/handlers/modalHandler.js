const adminService = require('../../services/adminService');
const expressService = require('../../services/expressService');
const announcementService = require('../../services/announcementService');
const economyService = require('../../services/economyService');
const { AppError } = require('../../utils/AppError');
const logger = require('../../utils/logger');

async function modalHandler(interaction) {
  if (!interaction.isModalSubmit()) return;

  const customId = interaction.customId;

  try {
    if (customId === 'admin_ban_modal') {
      await adminService.handleBanSubmit(interaction);
    } else if (customId === 'admin_kick_modal') {
      await adminService.handleKickSubmit(interaction);
    } else if (customId === 'admin_co_brand_modal') {
      await adminService.handleCoBrandSubmit(interaction);
    } else if (customId === 'admin_search_modal') {
      await adminService.handleSearchSubmit(interaction);
    } else if (customId.startsWith('express_modal:')) {
      await expressService.handleExpressModalSubmit(interaction);
    } else if (customId === 'express_send_money_modal') {
      await economyService.handleSendMoneyModalSubmit(interaction);
    } else if (customId === 'admin_announcement_modal') {
      await announcementService.handleAnnouncementModalSubmit(interaction);
    }
  } catch (error) {
    if (error instanceof AppError && error.isOperational) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: error.message, ephemeral: true });
      } else {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
    } else {
      logger.error('Error handling modal interaction', { error, customId });
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
