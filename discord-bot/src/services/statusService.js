const { EmbedBuilder } = require('discord.js');
const config = require('../config');

let lastStatusMessageId = null;

async function updateStatus(payload, discordClient) {
  if (!config.discord.channels.status) return;

  try {
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
      .setTimestamp();

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
      await message.edit({ embeds: [embed] });
      lastStatusMessageId = message.id;
    } else {
      const newMsg = await channel.send({ embeds: [embed] });
      lastStatusMessageId = newMsg.id;
    }
  } catch (err) {
    console.error('Failed to update status embed:', err);
  }
}

module.exports = {
  updateStatus
};
