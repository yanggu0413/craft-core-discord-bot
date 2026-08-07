const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('製作人設')
    .setDescription('自訂與製作你的專屬 AI 人設 (最多可保存 3 個自訂槽位)')
    .addIntegerOption(option =>
      option.setName('slot')
        .setDescription('選擇要儲存的自訂人設槽位 (1 ~ 3，預設為 1)')
        .setRequired(false)
        .addChoices(
          { name: '🎨 自訂人設 槽位 1', value: 1 },
          { name: '🎨 自訂人設 槽位 2', value: 2 },
          { name: '🎨 自訂人設 槽位 3', value: 3 }
        )
    ),

  async execute(interaction) {
    const slot = interaction.options.getInteger('slot') || 1;

    const modal = new ModalBuilder()
      .setCustomId(`custom_persona_modal:${slot}`)
      .setTitle(`🎨 製作個人專屬人設 (槽位 ${slot})`);

    const nameInput = new TextInputBuilder()
      .setCustomId('persona_name')
      .setLabel('人設名稱 (例如: 傲嬌女僕, 中二病魔王)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('請輸入這個人設的簡短名稱')
      .setRequired(true)
      .setMaxLength(30);

    const promptInput = new TextInputBuilder()
      .setCustomId('persona_prompt')
      .setLabel('人設詳細描述與對話風格指令')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('詳細描述說話風格、角色設定、習慣用語與特定規則...')
      .setRequired(true)
      .setMaxLength(1500);

    const firstRow = new ActionRowBuilder().addComponents(nameInput);
    const secondRow = new ActionRowBuilder().addComponents(promptInput);

    modal.addComponents(firstRow, secondRow);

    await interaction.showModal(modal);
  }
};
