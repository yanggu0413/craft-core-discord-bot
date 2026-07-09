const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('玩家資訊')
    .setDescription('查詢已綁定玩家的詳細資訊（管理員專用）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('查詢內容')
        .setDescription('可輸入 Discord 標記/ID、Minecraft 玩家名稱 或 Minecraft UUID')
        .setRequired(true)
    ),
  async execute(interaction) {
    const isAdmin = interaction.member && (
      (interaction.member.permissions && interaction.member.permissions.has(PermissionFlagsBits.Administrator)) ||
      (config.discord.adminRoleIds && interaction.member.roles && interaction.member.roles.cache && config.discord.adminRoleIds.some(rId => interaction.member.roles.cache.has(rId)))
    );

    if (!isAdmin) {
      return interaction.reply({ content: '您無權限執行此指令。', ephemeral: true });
    }

    const query = interaction.options.getString('查詢內容').trim();
    let binding = null;

    const discordMentionRegex = /^<@!?(\d+)>$/;
    const isDiscordIdOnly = /^\d{17,20}$/;
    const isUuid = /^[0-9a-fA-F]{32}$/.test(query.replace(/-/g, ''));

    let parsedDiscordId = null;
    const mentionMatch = query.match(discordMentionRegex);
    if (mentionMatch) {
      parsedDiscordId = mentionMatch[1];
    } else if (isDiscordIdOnly.test(query)) {
      parsedDiscordId = query;
    }

    if (parsedDiscordId) {
      binding = db.getBindingByDiscordId(parsedDiscordId);
    } else if (isUuid) {
      binding = db.getBindingByMcUuid(query);
    } else {
      binding = db.getBindingByMcUsername(query);
    }

    if (!binding) {
      return interaction.reply({
        content: `找不到關於 \`${query}\` 的任何綁定資料。`,
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    let onlineStatus = '🔴 離線 (Offline)';
    let lastOnline = '未知 (Unknown)';
    let location = '無 (N/A)';

    const session = require('../../websocket/session');
    if (session && session.isActive()) {
      try {
        const result = await session.executeCommand(`playerinfo ${binding.mc_username}`, interaction.user.tag);
        if (result.success) {
          const output = result.output;
          const isOnline = output.includes('Online: true');
          const lastOnlineMatch = output.match(/LastOnline:\s*([^,\n]+)/);
          if (lastOnlineMatch) {
            lastOnline = lastOnlineMatch[1].trim();
          }
          if (isOnline) {
            onlineStatus = '🟢 線上 (Online)';
            const coordsMatch = output.match(/Coords:\s*(.*?)(?=\s*,?\s*Dimension:|$)/);
            const dimMatch = output.match(/Dimension:\s*([^,\n]+)/);
            if (coordsMatch && dimMatch) {
              location = `${coordsMatch[1].trim()} (${dimMatch[1].trim()})`;
            }
          }
        }
      } catch (error) {
        console.error('Failed to query player info:', error);
      }
    } else {
      onlineStatus = '🔴 離線 (遊戲伺服器未連線)';
    }

    const fields = [
      { name: 'Minecraft 玩家名', value: `\`${binding.mc_username}\``, inline: true },
      { name: '在線狀態', value: onlineStatus, inline: true },
      { name: '最後上線時間', value: `\`${lastOnline}\``, inline: false }
    ];

    if (onlineStatus.includes('線上') && location !== '無 (N/A)') {
      fields.push({ name: '目前位置', value: `\`${location}\``, inline: false });
    }

    const embed = new EmbedBuilder()
      .setTitle('玩家詳細資訊')
      .setColor('#3498db')
      .addFields(fields)
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed]
    });
  }
};
