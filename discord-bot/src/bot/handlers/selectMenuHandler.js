const expressService = require('../../services/expressService');
const { AppError } = require('../../utils/AppError');
const logger = require('../../utils/logger');

async function selectMenuHandler(interaction) {
  if (!interaction.isStringSelectMenu()) return;

  const customId = interaction.customId;

  try {
    if (customId.startsWith('express_select:')) {
      await expressService.handleSelectExpressItem(interaction);
    } else if (customId === 'select_persona') {
      const selectedKey = interaction.values[0];
      const db = require('../../database');
      const { PERSONA_CONFIGS } = require('../../config/personas');
      await db.setUserPersona(interaction.user.id, selectedKey);
      const persona = PERSONA_CONFIGS[selectedKey] || PERSONA_CONFIGS.default;

      await interaction.update({
        content: `✅ 人設切換成功！你目前的 AI 人設已切換為：**${persona.name}**\n> ${persona.description}`,
        embeds: [],
        components: []
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
      logger.error('Error handling select menu interaction', { error, customId });
      const msg = '處理選單選擇時發生錯誤！';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  }
}

module.exports = selectMenuHandler;
