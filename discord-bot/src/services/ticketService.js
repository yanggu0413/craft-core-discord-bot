const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { TicketRepository } = require('../database/repositories');
const config = require('../config');
const logger = require('../utils/logger');
const discordQueue = require('../utils/discordQueue');

async function handleCreateTicket(interaction) {
  const creatorId = interaction.user.id;
  const ticketId = 't-' + Math.floor(1000 + Math.random() * 9000);

  try {
    const channelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    let channel;
    try {
      channel = await interaction.guild.channels.create({
        name: channelName,
        type: 0, // GuildText channel type
        parent: config.discord.channels.ticketCategory || null,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ['ViewChannel']
          },
          {
            id: creatorId,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
          }
        ]
      });
    } catch (createError) {
      if (config.discord.channels.ticketCategory) {
        logger.warn('Failed to create ticket in category, trying without parent category', { error: createError });
        channel = await interaction.guild.channels.create({
          name: channelName,
          type: 0, // GuildText channel type
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: ['ViewChannel']
            },
            {
              id: creatorId,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
            }
          ]
        });
      } else {
        throw createError;
      }
    }

    // Save ticket into database
    await TicketRepository.createTicket(ticketId, channel.id, creatorId);

    // Ephemeral response to ticket creator
    await interaction.reply({
      content: `您的客服單已建立：<#${channel.id}>`,
      ephemeral: true
    });

    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('關閉客服單')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeButton);

    await discordQueue.enqueue(() => channel.send({
      content: '點擊按鈕關閉客服單：',
      components: [row]
    }), { type: 'ticket_close_button', ticketId });

    // Welcome message in ticket channel
    const embed = new EmbedBuilder()
      .setTitle('💬 客服支援單')
      .setDescription(`你好 <@${creatorId}>，感謝您的聯絡！請在此說明您的問題，管理人員將會儘快處理。`)
      .setColor('#5865F2')
      .setTimestamp();

    await discordQueue.enqueue(() => channel.send({
      content: `<@${creatorId}> 您的客服單已開啟！`,
      embeds: [embed]
    }), { type: 'ticket_welcome', ticketId });

  } catch (error) {
    logger.error('Failed to create ticket channel', { error });
    await interaction.reply({
      content: '建立客服單時發生錯誤，請聯絡管理員。',
      ephemeral: true
    });
  }
}

async function handleCloseTicket(interaction) {
  const channel = interaction.channel;
  const ticketInfo = await TicketRepository.getTicketByChannelId(channel.id);

  if (!ticketInfo) {
    return interaction.reply({
      content: '此頻道不屬於有效的客服單。',
      ephemeral: true
    });
  }

  // Defer reply to handle execution time
  await interaction.reply({
    content: '正在關閉客服單並生成記錄...',
    ephemeral: true
  });

  try {
    // 1. Generate Transcript
    let transcriptText = `--- Ticket Transcript for Channel ${channel.name} (${channel.id}) ---\n`;
    transcriptText += `Ticket ID: ${ticketInfo.ticket_id}\n`;
    transcriptText += `Creator ID: ${ticketInfo.creator_id}\n`;
    transcriptText += `Closed by: ${interaction.user.tag} (${interaction.user.id})\n`;
    transcriptText += `Timestamp: ${new Date().toISOString()}\n\n`;

    let messages = [];
    try {
      const fetched = await channel.messages.fetch({ limit: 100 });
      messages = Array.from(fetched.values()).reverse();
    } catch (e) {
      logger.warn('Failed to fetch messages for transcript');
    }

    for (const msg of messages) {
      const authorTag = msg.author ? msg.author.tag : 'Unknown';
      const content = msg.content || '';
      transcriptText += `[${new Date(msg.createdAt || Date.now()).toISOString()}] ${authorTag}: ${content}\n`;
    }

    transcriptText += '\n--- End of Transcript ---\n';

    // 2. Log transcript to ticket logs channel
    if (config.discord.channels.ticketLogs) {
      try {
        const logsChannel = await interaction.guild.channels.fetch(config.discord.channels.ticketLogs);
        if (logsChannel) {
          await discordQueue.enqueue(() => logsChannel.send({
            content: `📁 客服單 **${ticketInfo.ticket_id}** (${channel.name}) 已關閉。`,
            files: [
              {
                attachment: Buffer.from(transcriptText, 'utf-8'),
                name: `transcript-${ticketInfo.ticket_id}.txt`
              }
            ]
          }), { type: 'ticket_log', ticketId: ticketInfo.ticket_id });
        }
      } catch (err) {
        logger.error('Failed to send transcript to logs channel', { error: err });
      }
    }

    // 3. Update status in Database
    await TicketRepository.closeTicket(channel.id);

    // 4. Delete the channel
    await channel.delete();

  } catch (error) {
    logger.error('Failed to close ticket channel', { error });
    await interaction.editReply({
      content: '關閉客服單時發生錯誤。'
    });
  }
}

module.exports = {
  handleCreateTicket,
  handleCloseTicket
};
