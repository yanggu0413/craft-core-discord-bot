const { SlashCommandBuilder } = require('discord.js');
const { UserRepository, TempCodeRepository } = require('../../database/repositories');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('綁定')
    .setDescription('綁定您的 Discord 帳號與 Minecraft 帳號')
    .addStringOption(option =>
      option.setName('驗證碼')
        .setDescription('請輸入遊戲中產生的 6 位數驗證碼')
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(6)
    ),
  async execute(interaction) {
    const code = interaction.options.getString('驗證碼');
    const discordId = interaction.user.id;

    // Check if Discord account already has a binding
    const existingBindingByDiscord = await UserRepository.getBindingByDiscordId(discordId);
    if (existingBindingByDiscord) {
      return interaction.reply({
        content: `您的 Discord 帳號已經綁定 Minecraft 玩家: \`${existingBindingByDiscord.mc_username}\`。若要變更，請先使用 \`/解除綁定\`。`,
        ephemeral: true
      });
    }

    // Retrieve temporary validation code from db
    const tempCodeInfo = await TempCodeRepository.getTempCode(code);
    if (!tempCodeInfo) {
      return interaction.reply({
        content: '無效或已過期的驗證碼，請在 Minecraft 伺服器中重新獲取。',
        ephemeral: true
      });
    }

    // 5-minute lifespan validation (300,000 milliseconds)
    const timeStr = tempCodeInfo.created_at;
    const createdAt = new Date(timeStr.includes('Z') || timeStr.includes('+') ? timeStr : timeStr + ' UTC');
    const diffMs = Date.now() - createdAt.getTime();
    if (diffMs > 300000) {
      await TempCodeRepository.deleteTempCode(code);
      return interaction.reply({
        content: '驗證碼已過期（5分鐘有效時限），請在遊戲中重新獲取。',
        ephemeral: true
      });
    }

    const { mc_uuid: mcUuid, mc_username: mcUsername } = tempCodeInfo;

    try {
      // Complete binding transaction
      await UserRepository.bindUser(discordId, mcUuid, mcUsername, code);

      // Whitelist feature is disabled on this server except during tests
      if (process.env.NODE_ENV === 'test') {
        try {
          const session = require('../../websocket/session');
          if (session && session.isActive()) {
            session.send({
              type: 'whitelist_action',
              payload: { action: 'add', username: mcUsername }
            });
          }
        } catch (e) {
          logger.warn('Failed to send whitelist sync event', { error: e });
        }
      }

      await interaction.reply({
        content: `成功綁定！您的 Discord 帳號已與 Minecraft 玩家 \`${mcUsername}\` 連結。`
      });
    } catch (error) {
      if (error.message.includes('already bound')) {
        return interaction.reply({
          content: `Minecraft 帳號 \`${mcUsername}\` 已被其他 Discord 帳號綁定。`,
          ephemeral: true
        });
      }
      logger.error('Error in /綁定 handler', { error });
      await interaction.reply({
        content: '綁定時發生資料庫錯誤，請聯絡管理人員。',
        ephemeral: true
      });
    }
  }
};
