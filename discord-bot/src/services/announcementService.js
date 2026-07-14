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
  const title = (interaction.fields.getTextInputValue('title') || '').trim();
  const intro = formatChannelIds((interaction.fields.getTextInputValue('intro') || '').trim());
  const scope = formatChannelIds((interaction.fields.getTextInputValue('scope') || '').trim());
  const impact = formatChannelIds((interaction.fields.getTextInputValue('impact') || '').trim());
  const details = formatChannelIds((interaction.fields.getTextInputValue('details') || '').trim());

  const clock = require('../utils/clock');
  const offset = clock.getOffset();
  const adjustedDate = new Date(Date.now() - offset);
  const year = adjustedDate.getFullYear();
  const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
  const day = String(adjustedDate.getDate()).padStart(2, '0');

  const formattedAnnouncementParts = [
    `<@&${ANNOUNCEMENT_PING_ROLE_ID}>`,
    '',
    `# 📢 ｜ 伺服器公告：${title}`,
    '',
    '親愛的玩家們：',
    ''
  ];

  if (intro) {
    formattedAnnouncementParts.push(intro, '');
  }

  formattedAnnouncementParts.push(
    '---',
    '',
    '## 📌 ｜ 公告核心內容',
    ''
  );

  formattedAnnouncementParts.push(`* 🗓️ **發布時間**：${year} / ${month} / ${day}`);
  if (scope) {
    formattedAnnouncementParts.push(`* ⚙️ **涉及範圍**：${scope}`);
  }
  if (impact) {
    formattedAnnouncementParts.push(`* ⚠️ **重要影響**：${impact}`);
  }

  formattedAnnouncementParts.push('', '---', '');

  if (details) {
    formattedAnnouncementParts.push(
      '## 🛠️ ｜ 詳細調整與更新項目',
      '',
      details,
      '',
      '---',
      ''
    );
  }

  formattedAnnouncementParts.push(
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
  );

  const formattedAnnouncement = formattedAnnouncementParts.join('\n');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('announce_publish').setLabel('正式發布').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('announce_discard').setLabel('放棄草稿').setStyle(ButtonStyle.Danger)
  );

  const banner = '⚠️ **以下為公告草稿預覽，請確認內容無誤後發布：**\n\n';

  // Send preview to the channel where it was triggered (Admin Channel)
  await discordQueue.enqueue(() => interaction.reply({
    content: `${banner}${formattedAnnouncement}`,
    components: [row],
    allowedMentions: { parse: [] }
  }), { type: 'announcement_preview' });
}

async function handlePublishDraft(interaction) {
  if (!isUserAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ 您沒有權限執行此操作。', ephemeral: true });
  }

  const messageContent = interaction.message.content || '';
  const banner = '⚠️ **以下為公告草稿預覽，請確認內容無誤後發布：**\n\n';
  let finalContent = messageContent;
  if (messageContent.startsWith(banner)) {
    finalContent = messageContent.substring(banner.length);
  }

  try {
    const channel = await interaction.client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) {
      return interaction.reply({ content: '❌ 找不到公告頻道，請確認頻道設定。', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    // Send final announcement with ping
    await discordQueue.enqueue(() => channel.send({
      content: finalContent,
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

let lastBroadcastDate = '';

function startDailyBroadcastLoop(client) {
  setInterval(async () => {
    try {
      const now = new Date();
      // Format current hour, minute and date in Taipei
      const formatter = new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      const getVal = (type) => parts.find(p => p.type === type).value;
      
      const year = getVal('year');
      const month = getVal('month');
      const day = getVal('day');
      const hour = getVal('hour');
      const minute = getVal('minute');
      
      const dateStr = `${year}-${month}-${day}`;
      const timeStr = `${hour}:${minute}`;
      
      if (timeStr === '00:00' && lastBroadcastDate !== dateStr) {
        lastBroadcastDate = dateStr;
        await broadcastDailyTasks(client, dateStr);
      }
    } catch (err) {
      logger.error('Error in daily tasks broadcast check loop', err);
    }
  }, 10000); // Check every 10 seconds
}

async function broadcastDailyTasks(client, dateStr) {
  const { getDailyTasksFallback } = require('../utils/dailyTasksHelper');
  const session = require('../websocket/session');

  // Find daily-tasks channel
  const channel = client.channels.cache.find(c => c.name === 'daily-tasks');
  if (!channel) {
    logger.warn('Could not find channel named "daily-tasks" to broadcast daily tasks.');
    return;
  }

  let tasks = null;
  let isOffline = false;

  // Try to query online daily tasks if websocket is active
  if (session.isActive()) {
    try {
      // Query from first online server
      const res = await session.queryDailyTasks('SystemQuery');
      if (res && res.success) {
        tasks = res.tasks;
      }
    } catch (e) {
      logger.warn('Failed to query daily tasks from game server, falling back to local seeded random.', e);
    }
  }

  if (!tasks) {
    tasks = getDailyTasksFallback(dateStr);
    isOffline = true;
  }

  const slayTask = tasks.find(t => t.type === 1);
  const mineTask = tasks.find(t => t.type === 2);

  const embed = new EmbedBuilder()
    .setTitle(`📅 今日每日任務公告 - ${dateStr}`)
    .setColor('#1abc9c')
    .setDescription(
      `今日的冒險者任務已更新！請在遊戲中努力達成目標，賺取豐厚獎金！\n` +
      `💡 *可以使用遊戲內指令 \`/tasks\` 查詢您的個人即時任務進度。*`
    )
    .addFields(
      {
        name: `⚔️ 擊殺任務：${slayTask.target}`,
        value: `* 目標數量：\`${slayTask.count}\`\n* 任務獎勵：\`$${slayTask.reward}\` 元`,
        inline: true
      },
      {
        name: `⛏️ 挖掘任務：${mineTask.target}`,
        value: `* 目標數量：\`${mineTask.count}\`\n* 任務獎勵：\`$${mineTask.reward}\` 元`,
        inline: true
      }
    )
    .setFooter({ text: `Craft-Core 每日任務系統 ${isOffline ? '(離線備用模式)' : ''}` })
    .setTimestamp();

  await discordQueue.enqueue(() => channel.send({ embeds: [embed] }), { type: 'daily_tasks_broadcast' });
  logger.info(`Successfully broadcasted daily tasks for ${dateStr}`);
}

async function publishAnnouncementDirectly(client, title, content, scope, impact) {
  const clock = require('../utils/clock');
  const offset = clock.getOffset();
  const adjustedDate = new Date(Date.now() - offset);
  const year = adjustedDate.getFullYear();
  const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
  const day = String(adjustedDate.getDate()).padStart(2, '0');

  const formattedAnnouncementParts = [
    `<@&${ANNOUNCEMENT_PING_ROLE_ID}>`,
    '',
    `# 📢 ｜ 伺服器公告：${title}`,
    '',
    '親愛的玩家們：',
    ''
  ];

  if (content) {
    formattedAnnouncementParts.push(content, '');
  }

  formattedAnnouncementParts.push(
    '---',
    '',
    '## 📌 ｜ 公告核心內容',
    ''
  );

  formattedAnnouncementParts.push(`* 🗓️ **發布時間**：${year} / ${month} / ${day}`);
  if (scope) {
    formattedAnnouncementParts.push(`* ⚙️ **影響範圍**：${scope}`);
  }
  if (impact) {
    formattedAnnouncementParts.push(`* ⚠️ **重要影響**：${impact}`);
  }

  formattedAnnouncementParts.push(
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
  );

  const finalContent = formattedAnnouncementParts.join('\n');
  const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
  if (!channel) {
    throw new Error('找不到公告頻道');
  }

  await discordQueue.enqueue(() => channel.send({
    content: finalContent,
    allowedMentions: { roles: [ANNOUNCEMENT_PING_ROLE_ID], parse: [] }
  }), { type: 'announcement_publish' });

  return true;
}

module.exports = {
  showAnnouncementModal,
  handleAnnouncementModalSubmit,
  handlePublishDraft,
  handleDiscardDraft,
  startDailyBroadcastLoop,
  broadcastDailyTasks,
  publishAnnouncementDirectly
};
