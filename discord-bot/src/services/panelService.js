const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');
const discordQueue = require('../utils/discordQueue');

const KEY_PANEL_CHANNEL_ID = '1524920698001297518';
const INTERACTION_PANEL_CHANNEL_ID = '1524368641993474189';
const ADMIN_PANEL_CHANNEL_ID = '1524977578362933419';
const ECONOMY_PANEL_CHANNEL_ID = '1525341244895531018';

function isMessageMatching(msg, targetEmbed, targetRows) {
  if (!msg.embeds || msg.embeds.length !== 1) return false;
  const embed = msg.embeds[0];
  if (embed.title !== targetEmbed.data.title) return false;
  if (embed.description !== targetEmbed.data.description) return false;

  if (!msg.components || msg.components.length !== targetRows.length) return false;
  for (let i = 0; i < targetRows.length; i++) {
    const row = msg.components[i];
    const targetRow = targetRows[i].toJSON();
    if (!row.components || row.components.length !== targetRow.components.length) return false;
    for (let j = 0; j < targetRow.components.length; j++) {
      const targetId = targetRow.components[j].custom_id || targetRow.components[j].customId;
      const targetLabel = targetRow.components[j].label;
      const msgId = row.components[j].customId || row.components[j].custom_id;
      const msgLabel = row.components[j].label;
      if (msgId !== targetId || msgLabel !== targetLabel) return false;
    }
  }
  return true;
}

async function initializePanels(client) {
  logger.info('Initializing interaction, admin, and economy panels...');

  // 1. Key Panel Channel
  try {
    const channel = await client.channels.fetch(KEY_PANEL_CHANNEL_ID);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('🔑 鑰匙與簽到系統')
        .setDescription('歡迎來到鑰匙與簽到控制面板！請使用下方按鈕進行簽到、查詢、抽獎或兌換。')
        .setColor('#3498db');

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('key_panel_checkin').setLabel('📅 每日簽到').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('key_panel_lottery').setLabel('🎰 1 抽').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('key_panel_lottery_10').setLabel('🎰 10 連抽').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('key_panel_lottery_all').setLabel('💥 全部抽完').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('key_panel_query').setLabel('🔑 查詢鑰匙').setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('key_panel_leaderboard').setLabel('🏆 簽到排行榜').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('key_panel_subscribe').setLabel('🔔 訂閱提醒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('key_panel_exchange').setLabel('⏳ 時數兌換').setStyle(ButtonStyle.Secondary)
      );

      const targetRows = [row1, row2];

      const messages = await channel.messages.fetch({ limit: 10 });
      const botMsg = messages.find(m => m.author.id === client.user.id && m.components && m.components.some(row => row.components && row.components.some(c => c.customId === 'key_panel_checkin')));

      if (botMsg) {
        if (!isMessageMatching(botMsg, embed, targetRows)) {
          logger.info('Key Panel is outdated, editing...');
          await discordQueue.enqueue(() => botMsg.edit({ embeds: [embed], components: targetRows }), { type: 'key_panel_edit' });
        } else {
          logger.info('Key Panel is up-to-date, skipping.');
        }
      } else {
        logger.info('Key Panel not found, sending new...');
        await discordQueue.enqueue(() => channel.send({ embeds: [embed], components: targetRows }), { type: 'key_panel_send' });
      }
    }
  } catch (error) {
    logger.error('Failed to initialize Key Panel', { error });
  }

  // 2. Interaction Panel Channel
  try {
    const channel = await client.channels.fetch(INTERACTION_PANEL_CHANNEL_ID);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('📦 玩家快遞與收件箱')
        .setDescription('本頻道提供快遞與收件箱服務。您可以在此寄送包裹給線上/線下玩家，或查詢收件箱。')
        .setColor('#e67e22');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('interaction_panel_express').setLabel('📦 寄送快遞').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('interaction_panel_send_money').setLabel('💰 寄送金幣').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('interaction_panel_query_inbox').setLabel('📬 查詢收件箱').setStyle(ButtonStyle.Secondary)
      );

      const targetRows = [row];

      const messages = await channel.messages.fetch({ limit: 10 });
      const botMsg = messages.find(m => m.author.id === client.user.id && m.components && m.components.some(row => row.components && row.components.some(c => c.customId === 'interaction_panel_express')));

      if (botMsg) {
        if (!isMessageMatching(botMsg, embed, targetRows)) {
          logger.info('Interaction Panel is outdated, editing...');
          await discordQueue.enqueue(() => botMsg.edit({ embeds: [embed], components: targetRows }), { type: 'interaction_panel_edit' });
        } else {
          logger.info('Interaction Panel is up-to-date, skipping.');
        }
      } else {
        logger.info('Interaction Panel not found, sending new...');
        await discordQueue.enqueue(() => channel.send({ embeds: [embed], components: targetRows }), { type: 'interaction_panel_send' });
      }
    }
  } catch (error) {
    logger.error('Failed to initialize Interaction Panel', { error });
  }

  // 3. Admin Panel Channel
  try {
    const channel = await client.channels.fetch(ADMIN_PANEL_CHANNEL_ID);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('🚫 管理員控制面板')
        .setDescription('管理專用頻道。提供封鎖、踢出、發送聯名獎勵、查詢玩家資訊與發布公告。')
        .setColor('#e74c3c');

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_ban').setLabel('🚫 封鎖玩家').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('admin_kick').setLabel('🥾 踢出玩家').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('admin_co_brand').setLabel('🤝 聯名獎勵').setStyle(ButtonStyle.Primary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_search_player').setLabel('🔍 查詢玩家').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('admin_draft_announcement').setLabel('📢 發布公告').setStyle(ButtonStyle.Secondary)
      );

      const targetRows = [row1, row2];

      const messages = await channel.messages.fetch({ limit: 10 });
      const botMsg = messages.find(m => m.author.id === client.user.id && m.components && m.components.some(row => row.components && row.components.some(c => c.customId === 'admin_ban')));

      if (botMsg) {
        if (!isMessageMatching(botMsg, embed, targetRows)) {
          logger.info('Admin Panel is outdated, editing...');
          await discordQueue.enqueue(() => botMsg.edit({ embeds: [embed], components: targetRows }), { type: 'admin_panel_edit' });
        } else {
          logger.info('Admin Panel is up-to-date, skipping.');
        }
      } else {
        logger.info('Admin Panel not found, sending new...');
        await discordQueue.enqueue(() => channel.send({ embeds: [embed], components: targetRows }), { type: 'admin_panel_send' });
      }
    }
  } catch (error) {
    logger.error('Failed to initialize Admin Panel', { error });
  }

  // 4. Economy Panel Channel
  try {
    const channel = await client.channels.fetch(ECONOMY_PANEL_CHANNEL_ID);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('🏦 伺服器經濟與商店控制台')
        .setDescription('本頻道提供伺服器經濟控制與商店統計服務。請使用下方按鈕查詢您的餘額與商店營運狀態。')
        .setColor('#2ecc71');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('economy_query_balance').setLabel('💰 查詢餘額').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('economy_my_shop_stats').setLabel('🏪 我的商店數據').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('economy_rich_list').setLabel('🏆 伺服器富豪榜').setStyle(ButtonStyle.Success)
      );

      const targetRows = [row];

      const messages = await channel.messages.fetch({ limit: 10 });
      const botMsg = messages.find(m => m.author.id === client.user.id && m.components && m.components.some(row => row.components && row.components.some(c => c.customId === 'economy_query_balance')));

      if (botMsg) {
        if (!isMessageMatching(botMsg, embed, targetRows)) {
          logger.info('Economy Panel is outdated, editing...');
          await discordQueue.enqueue(() => botMsg.edit({ embeds: [embed], components: targetRows }), { type: 'economy_panel_edit' });
        } else {
          logger.info('Economy Panel is up-to-date, skipping.');
        }
      } else {
        logger.info('Economy Panel not found, sending new...');
        await discordQueue.enqueue(() => channel.send({ embeds: [embed], components: targetRows }), { type: 'economy_panel_send' });
      }
    }
  } catch (error) {
    logger.error('Failed to initialize Economy Panel', { error });
  }

  // 5. Warp Audit Panel Channel
  try {
    const warpAuditService = require('./warpAuditService');
    await warpAuditService.updateWarpPanel(client);
  } catch (error) {
    logger.error('Failed to initialize Warp Panel', { error });
  }
}

module.exports = {
  initializePanels,
  KEY_PANEL_CHANNEL_ID,
  INTERACTION_PANEL_CHANNEL_ID,
  ADMIN_PANEL_CHANNEL_ID,
  ECONOMY_PANEL_CHANNEL_ID
};
