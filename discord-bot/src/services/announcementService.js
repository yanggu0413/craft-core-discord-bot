const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { isUserAdmin } = require('./adminService');
const discordQueue = require('../utils/discordQueue');
const logger = require('../utils/logger');

const ANNOUNCEMENT_CHANNEL_ID = '1524353292183011379';
const ANNOUNCEMENT_PING_ROLE_ID = '1370660181360246784';

function formatChannelIds(text) {
  if (!text) return '';
  return text.replace(/#(\d{17,20})/g, '<#$1>');
}

async function showAnnouncementModal(interaction) {
  if (!isUserAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ 您沒有權限執行此操作。', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('admin_announcement_modal')
    .setTitle('📢 發布公告');

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('標題 (Title - 必填)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const introInput = new TextInputBuilder()
    .setCustomId('intro')
    .setLabel('前言 (Intro - 選填)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  const scopeInput = new TextInputBuilder()
    .setCustomId('scope')
    .setLabel('影響範圍 (Scope - 選填)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  const impactInput = new TextInputBuilder()
    .setCustomId('impact')
    .setLabel('影響程度 (Impact - 選填)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  const detailsInput = new TextInputBuilder()
    .setCustomId('details')
    .setLabel('詳細說明 (Details - 選填)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(introInput),
    new ActionRowBuilder().addComponents(scopeInput),
    new ActionRowBuilder().addComponents(impactInput),
    new ActionRowBuilder().addComponents(detailsInput)
  );

  return interaction.showModal(modal);
}

async function handleAnnouncementModalSubmit(interaction) {
  const title = interaction.fields.getTextInputValue('title').trim();
  const intro = formatChannelIds(interaction.fields.getTextInputValue('intro').trim());
  const scope = formatChannelIds(interaction.fields.getTextInputValue('scope').trim());
  const impact = formatChannelIds(interaction.fields.getTextInputValue('impact').trim());
  const details = formatChannelIds(interaction.fields.getTextInputValue('details').trim());

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor('#f1c40f')
    .setTimestamp();

  if (intro) {
    embed.addFields({ name: '📢 前言', value: intro, inline: false });
  }
  if (scope) {
    embed.addFields({ name: '🔍 影響範圍', value: scope, inline: false });
  }
  if (impact) {
    embed.addFields({ name: '⚠️ 影響程度', value: impact, inline: false });
  }
  if (details) {
    embed.addFields({ name: '📝 詳細說明', value: details, inline: false });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('announce_publish').setLabel('正式發布').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('announce_discard').setLabel('放棄草稿').setStyle(ButtonStyle.Danger)
  );

  // Send preview to the channel where it was triggered (Admin Channel)
  await discordQueue.enqueue(() => interaction.reply({
    content: '⚠️ **以下為公告草稿預覽，請確認內容無誤後發布：**',
    embeds: [embed],
    components: [row],
    allowedMentions: { parse: [] }
  }), { type: 'announcement_preview' });
}

async function handlePublishDraft(interaction) {
  if (!isUserAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ 您沒有權限執行此操作。', ephemeral: true });
  }

  const originalEmbed = interaction.message.embeds[0];
  if (!originalEmbed) {
    return interaction.reply({ content: '❌ 找不到公告內容，請重新操作。', ephemeral: true });
  }

  const embed = EmbedBuilder.from(originalEmbed);

  try {
    const channel = await interaction.client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) {
      return interaction.reply({ content: '❌ 找不到公告頻道，請確認頻道設定。', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    // Send final announcement with ping
    await discordQueue.enqueue(() => channel.send({
      content: `<@&${ANNOUNCEMENT_PING_ROLE_ID}>`,
      embeds: [embed],
      allowedMentions: { roles: [ANNOUNCEMENT_PING_ROLE_ID], parse: [] }
    }), { type: 'announcement_publish' });

    // Delete preview message
    await discordQueue.enqueue(() => interaction.message.delete(), { type: 'announcement_preview_delete' });

    return interaction.editReply({ content: '✅ 公告已成功發布！' });
  } catch (error) {
    logger.error('Failed to publish announcement', { error });
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: `❌ 發布公告時發生錯誤：${error.message}` });
    } else {
      return interaction.reply({ content: `❌ 發布公告時發生錯誤：${error.message}`, ephemeral: true });
    }
  }
}

async function handleDiscardDraft(interaction) {
  if (!isUserAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ 您沒有權限執行此操作。', ephemeral: true });
  }

  try {
    await discordQueue.enqueue(() => interaction.message.delete(), { type: 'announcement_preview_delete' });
    return interaction.reply({ content: '🗑️ 公告草稿已放棄並刪除。', ephemeral: true });
  } catch (error) {
    return interaction.reply({ content: `❌ 刪除草稿時發生錯誤：${error.message}`, ephemeral: true });
  }
}

module.exports = {
  showAnnouncementModal,
  handleAnnouncementModalSubmit,
  handlePublishDraft,
  handleDiscardDraft
};
