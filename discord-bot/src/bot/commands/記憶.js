const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('記憶')
    .setDescription('管理 CloudCat AI 對話記憶 (開關對話歷史與一鍵清空記憶)'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const settings = await db.getUserAiSettings(userId);
    const isMemOn = settings.memory_enabled !== 0;

    const embed = new EmbedBuilder()
      .setTitle('🧠 CloudCat AI 對話記憶管理')
      .setDescription(`當前對話記憶狀態：**${isMemOn ? '🟢 已開啟 (保留對話內容)' : '🔴 已關閉 (不保留對話歷史)'}**\n\n您可以使用下方按鈕隨時切換記憶狀態，或立即清空當前頻道的記憶紀錄。`)
      .setColor(isMemOn ? '#00D26A' : '#FF3B30')
      .setFooter({ text: '提示：對 AI 說「清空記憶」或「開啟/關閉記憶」也能設定喔！' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_user_memory')
        .setLabel(isMemOn ? '🔴 關閉對話記憶' : '🟢 開啟對話記憶')
        .setStyle(isMemOn ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('clear_user_memory')
        .setLabel('🧹 一鍵清空當前記憶')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
};
