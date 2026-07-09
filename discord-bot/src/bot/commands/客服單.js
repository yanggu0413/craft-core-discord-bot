const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const logger = require('../../utils/logger');
const discordQueue = require('../../utils/discordQueue');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('客服單')
    .setDescription('發送客服單建立面板（管理員專用）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.member) {
      return interaction.reply({
        content: '此指令只能在伺服器頻道中使用。',
        ephemeral: true
      });
    }

    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
                    (config.discord.adminRoleIds && config.discord.adminRoleIds.some(rId => interaction.member.roles.cache.has(rId)));

    if (!isAdmin) {
      return interaction.reply({
        content: '您無權限執行此指令。',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('💬 客服支援中心')
      .setDescription('如果您在遊戲內遭遇任何問題、需要舉報玩家或回報 Bug，請點選下方按鈕開啟專屬客服單。')
      .setColor('#5865F2')
      .setFooter({ text: 'Craft-Core Support System' });

    const button = new ButtonBuilder()
      .setCustomId('create_ticket')
      .setLabel('開啟客服單')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    try {
      await discordQueue.enqueue(() => interaction.channel.send({
        embeds: [embed],
        components: [row]
      }), { type: 'ticket_panel_deploy' });

      await interaction.reply({
        content: '客服單發送面板已成功建立。',
        ephemeral: true
      });
    } catch (error) {
      logger.error('Error deploying ticket button panel', { error });
      await interaction.reply({
        content: '建立客服面板時發生錯誤。',
        ephemeral: true
      });
    }
  }
};
