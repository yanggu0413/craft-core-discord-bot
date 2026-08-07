const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database');
const { PERSONA_CONFIGS, getPersonaForUser } = require('../../config/personas');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('人設')
    .setDescription('切換 CloudCat AI 人設模式 (含系統人設與玩家自訂人設)')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('選擇想切換的人設模式')
        .setRequired(false)
        .addChoices(
          { name: '☁️ 雲喵可愛模式 (預設)', value: 'default' },
          { name: '🤖 普通 AI 模式', value: 'normal' },
          { name: '🤪 愛玩梗 / 諧音笑話模式', value: 'joke' },
          { name: '🧧 台灣/中國傳統父母模式', value: 'parent' },
          { name: '❄️ 冷酷工程師模式', value: 'engineer' },
          { name: '🔥 滿口髒話直接開噴模式 (極致破防)', value: 'raging' },
          { name: '🎨 自訂人設 槽位 1', value: 'custom_1' },
          { name: '🎨 自訂人設 槽位 2', value: 'custom_2' },
          { name: '🎨 自訂人設 槽位 3', value: 'custom_3' }
        )
    ),

  async execute(interaction) {
    try {
      const selectedMode = interaction.options.getString('mode');
      const userId = interaction.user.id;

      if (selectedMode) {
        await db.setUserPersona(userId, selectedMode);
        const persona = await getPersonaForUser(userId, selectedMode);

        const embed = new EmbedBuilder()
          .setTitle('🎭 人設切換成功！')
          .setDescription(`你目前的 AI 人設已成功切換為：**${persona.name}**\n\n> ${persona.description}`)
          .setColor('#5865F2')
          .setFooter({ text: 'Craft-Core AI 人設系統 | 隨時使用 /人設 切換模式' })
          .setTimestamp();

        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // If no option provided, present interactive Select Menu
      const currentPersonaKey = await db.getUserPersona(userId);
      const currentPersona = await getPersonaForUser(userId, currentPersonaKey);
      const customPersonas = await db.getUserCustomPersonas(userId);

      const allOptions = [
        ...Object.values(PERSONA_CONFIGS).map(p => ({
          key: p.key,
          name: p.name,
          description: p.description
        }))
      ];

      // Add user's custom personas (slot 1, 2, 3)
      for (const cp of customPersonas) {
        allOptions.push({
          key: `custom_${cp.slot_index}`,
          name: `🎨 自訂人設 ${cp.slot_index}: ${cp.persona_name}`,
          description: `自訂提示詞: ${cp.persona_prompt.slice(0, 40)}...`
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎭 CloudCat AI 人設面板')
        .setDescription(`你當前的專屬 AI 人設為：**${currentPersona.name}**\n\n請從下方下拉選單中選擇想切換的人設 (可使用 \`/製作人設\` 製作專屬於你的 3 個自訂人設！)：`)
        .addFields(
          allOptions.map(p => ({
            name: p.name + (p.key === currentPersonaKey ? ' (當前使用中)' : ''),
            value: p.description,
            inline: false
          }))
        )
        .setColor('#00D26A')
        .setFooter({ text: '提示：也可以直接對 AI 說「切換到自訂人設1」或「切換到滿口髒話模式」喔！' });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_persona')
        .setPlaceholder('選擇你想體驗的 AI 人設...')
        .addOptions(
          allOptions.map(p => ({
            label: p.name.slice(0, 100),
            description: p.description.slice(0, 50),
            value: p.key,
            default: p.key === currentPersonaKey
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });

    } catch (err) {
      logger.error('Error executing /人設 command:', err);
      await interaction.reply({
        content: `❌ 切換人設時發生錯誤：${err.message}`,
        ephemeral: true
      }).catch(() => {});
    }
  }
};
