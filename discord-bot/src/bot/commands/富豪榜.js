const { SlashCommandBuilder } = require('discord.js');
const economyService = require('../../services/economyService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('富豪榜')
    .setDescription('查看伺服器的玩家財富排行榜'),
  async execute(interaction) {
    await economyService.handleQueryRichListButton(interaction);
  }
};
