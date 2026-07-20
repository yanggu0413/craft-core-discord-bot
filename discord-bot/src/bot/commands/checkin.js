const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { UserRepository } = require('../../database/repositories');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkin')
    .setDescription('進行每日簽到以獲得抽獎鑰匙'),
  async execute(interaction) {
    const discordId = interaction.user.id;
    const binding = await UserRepository.getBindingByDiscordId(discordId);

    if (!binding) {
      return interaction.reply({
        content: '❌ 您尚未綁定 Minecraft 帳號，請先私訊本機器人傳送遊戲中 \`/discord link\` 獲得的驗證碼以完成綁定！',
        ephemeral: true
      });
    }

    const now = new Date();
    // Use local time date string: YYYY-MM-DD
    const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const userKeys = await UserRepository.getUserKeys(discordId);
    if (userKeys && userKeys.last_checkin === localDateStr) {
      return interaction.reply({
        content: '📅 您今天已經簽到過囉！請明天再試。',
        ephemeral: true
      });
    }

    try {
      await UserRepository.setCheckin(discordId, localDateStr, 1);
    } catch (error) {
      logger.error('Failed to set checkin status', { error });
      return interaction.reply({
        content: '❌ 簽到時發生錯誤，請稍後再試！',
        ephemeral: true
      });
    }

    const updatedUserKeys = await UserRepository.getUserKeys(discordId);
    const keysCount = updatedUserKeys ? updatedUserKeys.keys_count : 1;

    const embed = new EmbedBuilder()
      .setTitle('📅 每日簽到成功！')
      .setColor('#55FF55')
      .setDescription(`恭喜 **${binding.mc_username}** 簽到成功！\n\n🔑 獲得了 **1** 把抽獎鑰匙！\n目前您共擁有 **${keysCount}** 把鑰匙。\n\n請登入遊戲並在 Discord 輸入 \`/抽獎\` 進行開獎！`)
      .setTimestamp();

    await interaction.reply({
      embeds: [embed]
    });
  }
};
