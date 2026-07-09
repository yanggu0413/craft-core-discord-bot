const { WebhookClient, EmbedBuilder } = require('discord.js');
const config = require('../config');

function translateDeathMessage(details, username) {
  if (!details) return `${username} 死亡了`;

  const translations = [
    { pattern: /was slain by Zombie/i, replacement: '被 殭屍 殺死了' },
    { pattern: /was slain by Skeleton/i, replacement: '被 骷髏 殺死了' },
    { pattern: /was slain by Spider/i, replacement: '被 蜘蛛 殺死了' },
    { pattern: /was slain by Cave Spider/i, replacement: '被 洞穴蜘蛛 殺死了' },
    { pattern: /was slain by Enderman/i, replacement: '被 安德/末影人 殺死了' },
    { pattern: /was slain by Witch/i, replacement: '被 女巫 殺死了' },
    { pattern: /was slain by Slime/i, replacement: '被 史萊姆 殺死了' },
    { pattern: /was slain by Drowned/i, replacement: '被 溺屍 殺死了' },
    { pattern: /was slain by Phantom/i, replacement: '被 幻翼 殺死了' },
    { pattern: /was slain by Creeper/i, replacement: '被 苦力怕 炸死了' },
    { pattern: /was blown up by Creeper/i, replacement: '被 苦力怕 炸死了' },
    { pattern: /was blown up by/i, replacement: '被 爆炸 炸死了' },
    { pattern: /blew up/i, replacement: '爆炸了' },
    { pattern: /drowned/i, replacement: '淹死了' },
    { pattern: /burned to death/i, replacement: '被燒死了' },
    { pattern: /went up in flames/i, replacement: '燒起來了' },
    { pattern: /hit the ground too hard/i, replacement: '摔得太重了' },
    { pattern: /fell from a high place/i, replacement: '從高處摔了下來' },
    { pattern: /fell off a ladder/i, replacement: '從梯子摔了下來' },
    { pattern: /suffocated in a wall/i, replacement: '在牆中窒息而死' },
    { pattern: /starved to death/i, replacement: '餓死了' },
    { pattern: /was killed by magic/i, replacement: '被魔法殺死了' },
    { pattern: /withered away/i, replacement: '凋零而死' },
    { pattern: /was squashed by a falling anvil/i, replacement: '被鐵砧砸扁了' },
    { pattern: /was pricked to death/i, replacement: '被仙人掌刺死了' },
    { pattern: /died/i, replacement: '死亡了' }
  ];

  let translated = details;
  for (const item of translations) {
    if (item.pattern.test(translated)) {
      translated = translated.replace(item.pattern, item.replacement);
      if (translated.startsWith(username)) {
        translated = translated.replace(username, `**${username}**`);
      }
      return translated;
    }
  }

  return translated.replace(username, `**${username}**`);
}

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
      const embed = new EmbedBuilder()
        .setColor(0x55FF55) // Light green
        .setAuthor({
          name: `${username} 加入了伺服器`,
          iconURL: avatarUrl
        });
      await channel.send({
        embeds: [embed]
      });
    } else if (eventType === 'leave') {
      const embed = new EmbedBuilder()
        .setColor(0xFF5555) // Red
        .setAuthor({
          name: `${username} 離開了伺服器`,
          iconURL: avatarUrl
        });
      await channel.send({
        embeds: [embed]
      });
    } else if (eventType === 'death') {
      const translatedMsg = translateDeathMessage(details, username);
      const embed = new EmbedBuilder()
        .setColor(0xFF5555) // Red
        .setAuthor({
          name: `${username} 死亡了`,
          iconURL: avatarUrl
        })
        .setDescription(`💀 ${translatedMsg}`);
      await channel.send({
        embeds: [embed]
      });
    } else if (eventType === 'advancement') {
      const parts = details.split('|');
      const title = parts[0] || '';
      const desc = parts[1] || '';
      const itemId = parts[2] || '';

      const embed = new EmbedBuilder()
        .setColor(0x55FF55) // Light green
        .setTitle(`${username} 已完成進度 [${title}]`)
        .setDescription(desc);

      if (itemId) {
        const cleanItemId = itemId.replace('minecraft:', '');
        embed.setThumbnail(`https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.21/items/${cleanItemId}.png`);
      }

      await channel.send({
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
