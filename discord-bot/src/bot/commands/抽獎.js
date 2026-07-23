const { SlashCommandBuilder } = require('discord.js');
const keyService = require('../../services/keyService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('抽獎')
    .setDescription('使用抽獎鑰匙兌換隨機生存物資與獎勵')
    .addStringOption(option =>
      option.setName('count')
        .setDescription('抽獎次數 (例如 5, 10 或 輸入 all 抽完)')
        .setRequired(false)
    ),
  async execute(interaction) {
    const countParam = interaction.options.getString('count') || '1';
    return keyService.handleLottery(interaction, countParam);
  }
};
