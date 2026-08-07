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
    } else if (customId === 'modal_submit_warp_audit') {
      const warpAuditService = require('../../services/warpAuditService');
      await warpAuditService.handleWarpModalSubmit(interaction);
    } else if (customId === 'announcement_modal') {
      const command = interaction.client.commands.get('公告');
      if (command && typeof command.handleModalSubmit === 'function') {
        await command.handleModalSubmit(interaction);
      } else {
        throw new Error('找不到公告指令的處理程式');
      }
    } else if (customId.startsWith('custom_persona_modal:')) {
      const slotIndex = parseInt(customId.split(':')[1], 10) || 1;
      const personaName = interaction.fields.getTextInputValue('persona_name');
      const personaPrompt = interaction.fields.getTextInputValue('persona_prompt');
      const db = require('../../database');

      await db.saveUserCustomPersona(interaction.user.id, slotIndex, personaName, personaPrompt);
      const personaKey = `custom_${slotIndex}`;
      await db.setUserPersona(interaction.user.id, personaKey);

      await interaction.reply({
        content: `🎉 成功製作並儲存個人專屬人設！\n\n- **槽位**: 🎨 自訂人設 ${slotIndex}\n- **名稱**: **${personaName}**\n- **目前狀態**: 已自動切換為當前使用中人設！\n\n> **提示詞預覽**: \`${personaPrompt.slice(0, 100)}...\``,
        ephemeral: true
      });
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
