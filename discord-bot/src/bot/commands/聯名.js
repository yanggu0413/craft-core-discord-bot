const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('聯名')
    .setDescription('給予指定玩家 6 把抽獎鑰匙（管理員專用）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('玩家')
        .setDescription('輸入 Discord 標記/ID、Minecraft 玩家名稱 或 Minecraft UUID')
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

    const query = interaction.options.getString('玩家').trim();
    let binding = null;
    let mcUsername = null;
    let discordId = null;

    const discordMentionRegex = /^<@!?(\d+)>$/;
    const isDiscordIdOnly = /^\d{17,20}$/;
    const isUuid = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/.test(query) || /^[0-9a-fA-F]{32}$/.test(query.replace(/-/g, ''));

    let parsedDiscordId = null;
    const mentionMatch = query.match(discordMentionRegex);
    if (mentionMatch) {
      parsedDiscordId = mentionMatch[1];
    } else if (isDiscordIdOnly.test(query)) {
      parsedDiscordId = query;
    }

    if (parsedDiscordId) {
      binding = db.getBindingByDiscordId(parsedDiscordId);
      if (binding) {
        mcUsername = binding.mc_username;
        discordId = binding.discord_id;
      }
    } else if (isUuid) {
      binding = db.getBindingByMcUuid(query);
      if (binding) {
        mcUsername = binding.mc_username;
        discordId = binding.discord_id;
      }
    } else {
      binding = db.getBindingByMcUsername(query);
      if (binding) {
        mcUsername = binding.mc_username;
        discordId = binding.discord_id;
      }
    }

    if (!binding) {
      return interaction.reply({
        content: `❌ 找不到關於 \`${query}\` 的綁定資料。只有已綁定 Discord 的玩家才能獲得抽獎鑰匙！`,
        ephemeral: true
      });
    }

    try {
      db.addKeysByDiscordId(discordId, 6);
    } catch (error) {
      console.error('Failed to add keys for user:', error);
      return interaction.reply({
        content: '❌ 給予鑰匙時發生錯誤，請稍後再試！',
        ephemeral: true
      });
    }

    const updatedUserKeys = db.getUserKeys(discordId);
    const totalKeys = updatedUserKeys ? updatedUserKeys.keys_count : 6;

    const embed = new EmbedBuilder()
      .setTitle('🤝 聯名合作獎勵')
      .setColor('#E67E22') // Orange
      .setDescription(`成功給予玩家 **${mcUsername}** 聯名抽獎鑰匙！\n\n🔑 獲得了 **6** 把抽獎鑰匙！\n該玩家目前共擁有 **${totalKeys}** 把鑰匙。`)
      .setTimestamp();

    await interaction.reply({
      embeds: [embed]
    });
  }
};
