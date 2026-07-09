const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('死亡榜')
    .setDescription('查看伺服器的玩家死亡數排行榜')
    .addIntegerOption(option =>
      option.setName('限制名額')
        .setDescription('顯示的排名數量（預設為 10 名）')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(30)
    ),
  async execute(interaction) {
    const limit = interaction.options.getInteger('限制名額') || 10;
    
    let leaderboard = [];
    try {
      leaderboard = db.getDeathLeaderboard(limit);
    } catch (error) {
      console.error('Failed to get death leaderboard:', error);
      return interaction.reply({ content: '讀取死亡排行榜時發生錯誤！', ephemeral: true });
    }

    if (!leaderboard || leaderboard.length === 0) {
      return interaction.reply({ content: '💀 目前伺服器中尚無任何玩家的死亡數據！', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('💀 Craft-Core 玩家死亡排行榜')
      .setColor('#FF5555')
      .setTimestamp();

    const medalEmojis = ['🥇', '🥈', '🥉'];
    let descLines = [];

    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const rankEmoji = i < 3 ? medalEmojis[i] : `${i + 1}.`;
      descLines.push(`${rankEmoji} **${entry.mc_username}** ⟫ \`${entry.deaths}\` 次死亡`);
    }

    embed.setDescription(descLines.join('\n'));

    await interaction.reply({
      embeds: [embed]
    });
  }
};
