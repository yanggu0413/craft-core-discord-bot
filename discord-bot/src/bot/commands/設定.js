const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database');
const { getPersonaForUser } = require('../../config/personas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('設定')
    .setDescription('管理你的專屬 AI 個人偏好設定 (Tag標記、記憶開關與人設管理)'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const settings = await db.getUserAiSettings(userId);
    const personaKey = await db.getUserPersona(userId);
    const persona = await getPersonaForUser(userId, personaKey);

    const isMemOn = settings.memory_enabled !== 0;
    const isPingOn = settings.ping_user !== 0;

    const embed = new EmbedBuilder()
      .setTitle('⚙️ CloudCat AI 個人偏好設定')
      .setDescription(`以下為您在伺服器中的專屬 AI 設定面板：`)
      .addFields(
        { name: '🔔 回覆 Tag 標記', value: isPingOn ? '🟢 **開啟** (AI 回覆時 Ping 提醒你)' : '🔴 **關閉** (靜音回覆，不 Ping 提醒)', inline: true },
        { name: '🧠 聊天對話記憶', value: isMemOn ? '🟢 **開啟** (連續對話記憶)' : '🔴 **關閉** (單次獨立問答)', inline: true },
        { name: '🎭 當前 AI 人設', value: `**${persona.name}**`, inline: false }
      )
      .setColor('#5865F2')
      .setFooter({ text: '點擊下方按鈕可快速切換設定！' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_user_ping')
        .setLabel(isPingOn ? '🔕 關閉 Tag 標記' : '🔔 開啟 Tag 標記')
        .setStyle(isPingOn ? ButtonStyle.Secondary : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('toggle_user_memory')
        .setLabel(isMemOn ? '🔴 關閉對話記憶' : '🟢 開啟對話記憶')
        .setStyle(isMemOn ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('clear_user_memory')
        .setLabel('🧹 清空對話記憶')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
};
