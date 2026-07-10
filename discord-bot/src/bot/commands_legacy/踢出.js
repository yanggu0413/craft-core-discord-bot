const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const session = require('../../websocket/session');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('踢出')
    .setDescription('將 Minecraft 玩家踢出伺服器（管理員專用）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('玩家名稱').setDescription('被踢出的玩家 ID').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('原因').setDescription('原因').setRequired(true)
    ),
  async execute(interaction) {
    const isAdmin = interaction.member && (
      interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
      (config.discord.adminRoleIds && config.discord.adminRoleIds.some(rId => interaction.member.roles.cache.has(rId)))
    );

    if (!isAdmin) {
      return interaction.reply({ content: '您無權限執行此指令。', ephemeral: true });
    }

    const username = interaction.options.getString('玩家名稱');
    const reason = interaction.options.getString('原因');

    if (username.includes('\n') || username.includes('\r') || username.includes('"')) {
      return interaction.reply({ content: '玩家名稱包含無效字元。', ephemeral: true });
    }

    const sanitizedReason = reason.replace(/[\r\n]+/g, ' ');

    if (!session || !session.isActive()) {
      return interaction.reply({ content: 'Minecraft 伺服器目前未連線，無法執行指令。', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const result = await session.executeCommand(`kick "${username}" ${sanitizedReason}`, interaction.user.tag);
      await interaction.editReply({
        content: result.success 
          ? `成功將玩家 \`${username}\` 踢出！\`${result.output}\`` 
          : `踢出玩家 \`${username}\` 失敗：\`${result.output}\``
      });
    } catch (error) {
      await interaction.editReply({ content: `指令執行失敗：${error.message}` });
    }
  }
};
