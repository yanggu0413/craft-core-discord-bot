const { WebhookClient } = require('discord.js');
const config = require('../config');

async function sendChat(sender, uuid, message, discordClient) {
  if (config.discord.chatWebhookUrl) {
    try {
      const webhookClient = new WebhookClient({ url: config.discord.chatWebhookUrl });
      const avatarUrl = config.minecraft.avatarProvider.replace('{uuid}', uuid);
      await webhookClient.send({
        content: message,
        username: sender,
        avatarURL: avatarUrl
      });
      return;
    } catch (err) {
      console.warn('Failed to send message via WebhookClient, falling back:', err);
    }
  }

  // Fallback to regular channel message
  if (config.discord.channels.chatSync) {
    try {
      const channel = await discordClient.channels.fetch(config.discord.channels.chatSync);
      if (channel) {
        await channel.send(`<${sender}> ${message}`);
      }
    } catch (err) {
      console.error('Failed to send chat message to Discord:', err);
    }
  }
}

async function sendServerStart(discordClient) {
  if (!config.discord.channels.chatSync) return;
  try {
    const channel = await discordClient.channels.fetch(config.discord.channels.chatSync);
    if (channel) {
      await channel.send('✅ 伺服器已開啟');
    }
  } catch (err) {
    console.error('Failed to send server start status to Discord:', err);
  }
}

async function sendServerStop(discordClient) {
  if (!config.discord.channels.chatSync) return;
  try {
    const channel = await discordClient.channels.fetch(config.discord.channels.chatSync);
    if (channel) {
      await channel.send('❌ 伺服器已關閉');
    }
  } catch (err) {
    console.error('Failed to send server stop status to Discord:', err);
  }
}

async function sendEvent(eventType, username, uuid, details, discordClient) {
  if (!config.discord.channels.chatSync) return;

  try {
    const channel = await discordClient.channels.fetch(config.discord.channels.chatSync);
    if (!channel) return;

    const avatarUrl = config.minecraft.avatarProvider.replace('{uuid}', uuid);

    if (eventType === 'join') {
      const embed = {
        color: 0x55FF55, // Light green
        author: {
          name: `${username} 加入了伺服器`,
          icon_url: avatarUrl
        }
      };
      await channel.send({
        content: `📥 **${username}** 加入了遊戲`,
        embeds: [embed]
      });
    } else if (eventType === 'leave') {
      const embed = {
        color: 0xFF5555, // Red
        author: {
          name: `${username} 離開了伺服器`,
          icon_url: avatarUrl
        }
      };
      await channel.send({
        content: `📤 **${username}** 離開了遊戲`,
        embeds: [embed]
      });
    } else if (eventType === 'death') {
      const embed = {
        color: 0xFF5555, // Red
        author: {
          name: `${username} 死亡了`,
          icon_url: avatarUrl
        },
        description: `💀 ${details}`
      };
      await channel.send({
        content: `💀 ${details}`,
        embeds: [embed]
      });
    } else if (eventType === 'advancement') {
      const parts = details.split('|');
      const title = parts[0] || '';
      const desc = parts[1] || '';
      const itemId = parts[2] || '';

      const embed = {
        color: 0x55FF55, // Light green
        title: `${username} 已完成進度 ${title}`,
        description: desc
      };

      if (itemId) {
        const cleanItemId = itemId.replace('minecraft:', '');
        embed.thumbnail = {
          url: `https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.21/items/${cleanItemId}.png`
        };
      }

      await channel.send({
        content: `🏆 **${username}** 達成了進度 [${title}]`,
        embeds: [embed]
      });
    } else {
      await channel.send(`📢 [${eventType}] **${username}**: ${details}`);
    }
  } catch (err) {
    console.error('Failed to send game event to Discord:', err);
  }
}

module.exports = {
  sendChat,
  sendEvent,
  sendServerStart,
  sendServerStop
};
