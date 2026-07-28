const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const imageGenService = require('../../services/imageGenService');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('額度')
    .setDescription('查詢今日 AI 繪圖剩餘配額與使用狀況 (Ephemerally 私密回覆)'),

  async execute(interaction) {
    try {
      const overview = await imageGenService.getUserImageQuotaOverview(interaction.user.id);

      const embed = new EmbedBuilder()
        .setTitle('📊 今日 AI 繪圖額度概況')
        .setDescription(`**查詢使用者**: <@${interaction.user.id}>\n**日期**: \`${overview.todayStr}\` (每日 00:00 自動重置)`)
        .setColor('#00AE86')
        .setTimestamp();

      for (const m of overview.models) {
        const progressBar = '🟦'.repeat(m.used) + '⬜'.repeat(m.remaining);
        embed.addFields({
          name: `${m.name}`,
          value: `已使用: \`${m.used} / ${m.limit}\` 張\n剩餘可用: **${m.remaining}** 張\n${progressBar}`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      logger.error('Slash /額度 command execution error:', err);
      await interaction.reply({ content: `❌ 查詢額度時發生錯誤：${err.message}`, ephemeral: true });
    }
  }
};
