const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('公告')
    .setDescription('發布排版精美的伺服器公告（管理員專用）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const isAdmin = interaction.member && (
      (interaction.member.permissions && interaction.member.permissions.has(PermissionFlagsBits.Administrator)) ||
      (config.discord.adminRoleIds && interaction.member.roles && interaction.member.roles.cache && config.discord.adminRoleIds.some(rId => interaction.member.roles.cache.has(rId)))
    );

    if (!isAdmin) {
      return interaction.reply({ content: '您無權限執行此指令。', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('announcement_modal')
      .setTitle('發布伺服器公告');

    const titleInput = new TextInputBuilder()
      .setCustomId('announce_title')
      .setLabel('公告主題')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例如：自製模組更新囉！')
      .setRequired(true);

    const introInput = new TextInputBuilder()
      .setCustomId('announce_intro')
      .setLabel('簡短開場白')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('例如：我們的自製模組更新囉！快來看看有什麼調整...')
      .setRequired(true);

    const scopeInput = new TextInputBuilder()
      .setCustomId('announce_scope')
      .setLabel('涉及範圍')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例如：全服 / Discord 聯動系統')
      .setRequired(true);

    const impactInput = new TextInputBuilder()
      .setCustomId('announce_impact')
      .setLabel('重要影響')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例如：維護期間將無法連線，請玩家注意安全')
      .setRequired(true);

    const detailsInput = new TextInputBuilder()
      .setCustomId('announce_details')
      .setLabel('詳細調整與更新項目')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('1. 項目一：在此輸入詳細說明...\n2. 項目二：在此輸入詳細說明...')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(introInput),
      new ActionRowBuilder().addComponents(scopeInput),
      new ActionRowBuilder().addComponents(impactInput),
      new ActionRowBuilder().addComponents(detailsInput)
    );

    await interaction.showModal(modal);
  },
  async handleModalSubmit(interaction) {
    const title = interaction.fields.getTextInputValue('announce_title');
    const intro = interaction.fields.getTextInputValue('announce_intro');
    const scope = interaction.fields.getTextInputValue('announce_scope');
    const impact = interaction.fields.getTextInputValue('announce_impact');
    const details = interaction.fields.getTextInputValue('announce_details');

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const formattedAnnouncement = [
      `# 📢 ｜ 伺服器公告：${title}`,
      '',
      '親愛的玩家們：',
      '',
      intro,
      '',
      '---',
      '',
      '## 📌 ｜ 公告核心內容',
      '',
      `* 🗓️ **發布時間**：${year} / ${month} / ${day}`,
      `* ⚙️ **涉及範圍**：${scope}`,
      `* ⚠️ **重要影響**：${impact}`,
      '',
      '---',
      '',
      '## 🛠️ ｜ 詳細調整與更新項目',
      '',
      details,
      '',
      '---',
      '',
      '## 💡 ｜ 相關頻道與回報',
      '',
      '如果你對本次公告有任何疑問，或在遊戲內遇到問題，請多加利用以下頻道：',
      '* 💬 想要參與討論、發表心得 ➡️ <#1524353968623583364>',
      '* 🎫 發現任何 BUG 或有緊急申訴 ➡️ <#1524353880169910403>（利用開單系統私密處理）',
      '',
      '感謝大家對 **Craft-Core** 的支持與配合，我們會持續優化，帶給大家更穩定的遊戲體驗！',
      '',
      '**Craft-Core 管理團隊 敬上**',
      `*${year}.${month}.${day}*`
    ].join('\n');

    // Send the announcement to the current channel
    await interaction.reply({
      content: '✅ 公告已發布！',
      ephemeral: true
    });

    await interaction.channel.send({
      content: formattedAnnouncement
    });
  }
};
