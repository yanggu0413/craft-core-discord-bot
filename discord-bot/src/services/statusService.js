const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const discordQueue = require('../utils/discordQueue');
const DailyStatsRepository = require('../database/repositories/DailyStatsRepository');
const clock = require('../utils/clock');

function getTaipeiDateString(date = new Date()) {
  const options = { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

let lastStatusMessageId = null;

async function updateStatus(payload, discordClient) {
  if (!config.discord.channels.status) return;

  try {
    if (payload.online) {
      const todayStr = getTaipeiDateString();
      try {
        await DailyStatsRepository.updateMaxOnline(todayStr, payload.current_players);
      } catch (err) {
        logger.error('Failed to update max online players statistic', { error: err });
      }
    }

    const channel = await discordClient.channels.fetch(config.discord.channels.status);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('📊 Minecraft 伺服器狀態')
      .setColor(payload.online ? '#2ecc71' : '#e74c3c')
      .addFields(
        { name: '伺服器狀態', value: payload.online ? '🟢 線上 (Online)' : '🔴 離線 (Offline)', inline: true },
        { name: 'TPS', value: payload.online ? `\`${payload.tps.toFixed(2)}\`` : '`N/A`', inline: true },
        { name: '平均延遲 (Ping)', value: payload.online ? `\`${payload.ping}ms\`` : '`N/A`', inline: true },
        { name: '在線人數', value: `\`${payload.current_players} / ${payload.max_players}\``, inline: false }
      )
      .setTimestamp(clock.getCorrectedDate());

    if (payload.online && payload.players && payload.players.length > 0) {
      embed.addFields({ name: '在線玩家', value: payload.players.map(p => `\`${p}\``).join(', '), inline: false });
    }

    // Try to update existing status message in the channel, otherwise send a new one
    let message = null;
    if (lastStatusMessageId) {
      try {
        message = await channel.messages.fetch(lastStatusMessageId);
      } catch (e) {
        // Ignore
      }
    }

    if (!message) {
      try {
        const messages = await channel.messages.fetch({ limit: 10 });
        message = messages.find(m => m.author.id === discordClient.user.id);
      } catch (e) {
        // Ignore
      }
    }

    if (message) {
      await discordQueue.enqueue(() => message.edit({ embeds: [embed] }), { type: 'status_edit' });
      lastStatusMessageId = message.id;
    } else {
      const newMsg = await discordQueue.enqueue(() => channel.send({ embeds: [embed] }), { type: 'status_send' });
      lastStatusMessageId = newMsg.id;
    }
  } catch (err) {
    logger.error('Failed to update status embed', { error: err });
  }
}

module.exports = {
  updateStatus
};
