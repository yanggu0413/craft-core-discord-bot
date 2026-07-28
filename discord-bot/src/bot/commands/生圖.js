const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const imageGenService = require('../../services/imageGenService');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('生圖')
    .setDescription('使用 AI 生成高畫質圖片 (Nano Banana 2 / Nano Banana Lite)')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('請輸入圖片畫面描述或提示詞')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('model')
        .setDescription('選擇繪圖模型 (每日每模型限 4 張)')
        .setRequired(false)
        .addChoices(
          { name: '🍌 Nano Banana 2 (高畫質/預設)', value: 'nano-banana-2' },
          { name: '⚡ Nano Banana Lite (快速模型)', value: 'nano-banana-lite' }
        )
    ),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');
    const modelKey = interaction.options.getString('model') || 'nano-banana-2';

    await interaction.deferReply();

    try {
      const result = await imageGenService.generateAiImage(interaction.user.id, prompt, modelKey);

      if (!result.success) {
        return await interaction.editReply({
          content: result.error
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎨 AI 繪圖產物 — ${result.modelName}`)
        .setDescription(`**提示詞**: \`${prompt}\``)
        .setColor('#5865F2')
        .setFooter({ text: `今日剩餘配額: ${result.remainingCount}/${result.dailyLimit} 張 | 由 Craft-Core AI 提供` })
        .setTimestamp();

      if (result.imageBuffer) {
        const attachment = new AttachmentBuilder(result.imageBuffer, { name: 'generated_image.png' });
        embed.setImage('attachment://generated_image.png');
        await interaction.editReply({
          embeds: [embed],
          files: [attachment]
        });
      } else if (result.imageUrl) {
        embed.setImage(result.imageUrl);
        await interaction.editReply({
          embeds: [embed]
        });
      }

    } catch (err) {
      logger.error('Slash /生圖 command execution error:', err);
      await interaction.editReply({
        content: `❌ 生成圖片時發生錯誤：${err.message}`
      });
    }
  }
};
