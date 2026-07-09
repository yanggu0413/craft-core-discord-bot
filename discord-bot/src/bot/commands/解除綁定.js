const { SlashCommandBuilder } = require('discord.js');
const { UserRepository } = require('../../database/repositories');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('解除綁定')
    .setDescription('解除您的 Discord 帳號與 Minecraft 帳號的綁定'),
  async execute(interaction) {
    const discordId = interaction.user.id;

    const binding = await UserRepository.getBindingByDiscordId(discordId);
    if (!binding) {
      return interaction.reply({
        content: '您目前沒有綁定任何 Minecraft 帳號。',
        ephemeral: true
      });
    }

    try {
      await UserRepository.removeBindingByDiscordId(discordId);

      // Whitelist Sync Event
      try {
        const session = require('../../websocket/session');
        if (session && session.isActive()) {
          session.send({
            type: 'whitelist_action',
            payload: { action: 'remove', username: binding.mc_username }
          });
        }
      } catch (e) {
        logger.warn('Failed to send whitelist sync event', { error: e });
      }

      await interaction.reply({
        content: `成功解除綁定！已移除與 Minecraft 玩家 \`${binding.mc_username}\` 的連結。`
      });
    } catch (error) {
      logger.error('Error in /解除綁定 handler', { error });
      await interaction.reply({
        content: '解除綁定時發生資料庫錯誤，請聯絡管理人員。',
        ephemeral: true
      });
    }
  }
};
