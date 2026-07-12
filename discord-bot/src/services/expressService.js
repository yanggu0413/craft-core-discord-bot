const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const UserRepository = require('../database/repositories/UserRepository');
const OfflineMailRepository = require('../database/repositories/OfflineMailRepository');
const session = require('../websocket/session');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Temporary in-memory session map for Express
const expressSessions = new Map();

function parseInventoryNbt(nbtString) {
  const arrayMatch = nbtString.match(/\[.*\]/);
  if (!arrayMatch) return [];
  const content = arrayMatch[0];
  const items = [];
  let braceCount = 0;
  let currentItemStr = '';
  let insideQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"' && content[i-1] !== '\\') insideQuotes = !insideQuotes;
    if (!insideQuotes) {
      if (char === '{') {
        braceCount++;
        if (braceCount === 1) { currentItemStr = ''; continue; }
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) { items.push(currentItemStr); continue; }
      }
    }
    if (braceCount > 0) currentItemStr += char;
  }

  const parsedItems = [];
  for (const itemStr of items) {
    const slotMatch = itemStr.match(/Slot:\s*(-?\d+)b/);
    const idMatch = itemStr.match(/id:\s*"([^"]+)"/);
    const countMatch = itemStr.match(/count:\s*(\d+)/);
    if (slotMatch && idMatch && countMatch) {
      let components = null;
      const compIndex = itemStr.indexOf('components:');
      if (compIndex !== -1) {
        components = itemStr.substring(compIndex + 'components:'.length).trim();
      } else {
        const tagIndex = itemStr.indexOf('tag:');
        if (tagIndex !== -1) components = itemStr.substring(tagIndex + 'tag:'.length).trim();
      }
      parsedItems.push({
        slot: parseInt(slotMatch[1], 10),
        id: idMatch[1],
        count: parseInt(countMatch[1], 10),
        components
      });
    }
  }
  return parsedItems;
}

async function handleInitiateExpress(interaction) {
  const discordId = interaction.user.id;
  const binding = await UserRepository.getBindingByDiscordId(discordId);

  if (!binding) {
    return interaction.reply({
      content: '❌ 您尚未綁定 Minecraft 帳號！請先在遊戲內輸入 `/discord` 取得驗證碼，並私訊本機器人以完成綁定。',
      ephemeral: true
    });
  }

  if (!session.isActive()) {
    return interaction.reply({
      content: '❌ 遊戲伺服器目前未連線，無法讀取您的背包。',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // 1. Check if player is online
    const info = await session.executeCommand(`playerinfo "${binding.mc_username}"`, interaction.user.tag);
    if (!info.success || !info.output.includes('Online: true')) {
      return interaction.editReply({
        content: `❌ 寄送快遞失敗！您必須處於遊戲線上狀態。`
      });
    }

    // 2. Fetch inventory
    const invData = await session.executeCommand(`data get entity "${binding.mc_username}" Inventory`, interaction.user.tag);
    if (!invData.success) {
      return interaction.editReply({
        content: `❌ 讀取背包失敗！請稍後再試。`
      });
    }

    const parsedItems = parseInventoryNbt(invData.output);
    if (parsedItems.length === 0) {
      return interaction.editReply({
        content: `🎒 您的背包是空的，沒有可以寄送的道具。`
      });
    }

    // 3. Group and unique items (max 25 options for select menu)
    const itemsGrouped = new Map();
    for (const item of parsedItems) {
      const key = item.components ? `${item.id}[${item.components}]` : item.id;
      if (!itemsGrouped.has(key)) {
        itemsGrouped.set(key, { id: item.id, count: 0, components: item.components, key });
      }
      itemsGrouped.get(key).count += item.count;
    }

    const uniqueItemsList = Array.from(itemsGrouped.values()).slice(0, 25);

    // 4. Store session
    const sessionId = crypto.randomUUID();
    expressSessions.set(sessionId, {
      senderDiscordId: discordId,
      senderMcUsername: binding.mc_username,
      items: uniqueItemsList
    });

    // 5. Build Select Menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`express_select:${sessionId}`)
      .setPlaceholder('選擇要寄送的道具')
      .addOptions(
        uniqueItemsList.map((item, index) => ({
          label: `${item.id.replace('minecraft:', '')} x${item.count}`,
          description: item.components ? `附帶 NBT: ${item.components.substring(0, 50)}` : '普通無 NBT 道具',
          value: String(index)
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.editReply({
      content: '📦 **請選擇您想寄送的道具：**',
      components: [row]
    });
  } catch (error) {
    logger.error('Error initiating express', { error });
    return interaction.editReply({
      content: `❌ 初始化快遞時發生錯誤：${error.message}`
    });
  }
}

async function handleSelectExpressItem(interaction) {
  const customId = interaction.customId;
  const sessionId = customId.split(':')[1];
  const sessionData = expressSessions.get(sessionId);

  if (!sessionData) {
    return interaction.reply({
      content: '❌ 郵寄連線已逾時，請重新點擊「寄送快遞」按鈕。',
      ephemeral: true
    });
  }

  const selectedIndex = parseInt(interaction.values[0], 10);
  const selectedItem = sessionData.items[selectedIndex];

  // Open Modal to ask for receiver and quantity
  const modal = new ModalBuilder()
    .setCustomId(`express_modal:${sessionId}:${selectedIndex}`)
    .setTitle('📦 寄送快遞詳情');

  const receiverInput = new TextInputBuilder()
    .setCustomId('receiver_mc')
    .setLabel('收件人 Minecraft 帳號 (Case-Insensitive)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const quantityInput = new TextInputBuilder()
    .setCustomId('quantity')
    .setLabel(`寄送數量 (最多: ${selectedItem.count})`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(receiverInput),
    new ActionRowBuilder().addComponents(quantityInput)
  );

  return interaction.showModal(modal);
}

async function handleExpressModalSubmit(interaction) {
  const customId = interaction.customId;
  const parts = customId.split(':');
  const sessionId = parts[1];
  const selectedIndex = parseInt(parts[2], 10);

  const sessionData = expressSessions.get(sessionId);
  if (!sessionData) {
    return interaction.reply({
      content: '❌ 郵寄連線已逾時，請重新操作。',
      ephemeral: true
    });
  }

  const receiverMc = interaction.fields.getTextInputValue('receiver_mc').trim();
  const quantityStr = interaction.fields.getTextInputValue('quantity').trim();
  const quantity = parseInt(quantityStr, 10);

  const selectedItem = sessionData.items[selectedIndex];

  if (isNaN(quantity) || quantity <= 0) {
    return interaction.reply({
      content: '❌ 請輸入有效的正整數數量！',
      ephemeral: true
    });
  }

  if (quantity > selectedItem.count) {
    return interaction.reply({
      content: `❌ 寄送數量不能超過您擁有的數量 (${selectedItem.count})！`,
      ephemeral: true
    });
  }

  if (!session.isActive()) {
    return interaction.reply({
      content: '❌ 遊戲伺服器目前未連線，無法完成寄送。',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // 1. Verify receiver exists in bindings (warn if not)
    const receiverBinding = await UserRepository.getBindingByMcUsername(receiverMc);
    let warning = '';
    if (!receiverBinding) {
      warning = `\n⚠️ **警示**：玩家 \`${receiverMc}\` 目前尚無 Discord 綁定紀錄，請確認帳號名稱是否拼寫正確！`;
    }

    // 2. Fetch sender's current inventory again to prevent duplicate-exploit
    const invData = await session.executeCommand(`data get entity "${sessionData.senderMcUsername}" Inventory`, interaction.user.tag);
    if (!invData.success) {
      return interaction.editReply({ content: '❌ 驗證背包失敗，請稍後再試。' });
    }

    const currentItems = parseInventoryNbt(invData.output);
    const itemsGrouped = new Map();
    for (const item of currentItems) {
      const key = item.components ? `${item.id}[${item.components}]` : item.id;
      if (!itemsGrouped.has(key)) {
        itemsGrouped.set(key, { id: item.id, count: 0, components: item.components, key });
      }
      itemsGrouped.get(key).count += item.count;
    }

    const currentGrouped = itemsGrouped.get(selectedItem.key);
    if (!currentGrouped || currentGrouped.count < quantity) {
      return interaction.editReply({
        content: `❌ 寄送失敗！您的背包中目前沒有足夠數量的該道具（或位置已被變動）。`
      });
    }

    // 3. Clear from sender's inventory
    // To clear items with components: in MC, `/clear <player> <item>[components] <quantity>`
    const clearSelector = selectedItem.components ? `${selectedItem.id}[${selectedItem.components}]` : selectedItem.id;
    const clearResult = await session.executeCommand(`clear "${sessionData.senderMcUsername}" ${clearSelector} ${quantity}`, 'System');
    
    if (!clearResult.success) {
      return interaction.editReply({
        content: `❌ 扣除道具失敗！伺服器回應：\`${clearResult.output}\``
      });
    }

    const match = clearResult.output.match(/(?:cleared|removed|清除|已清除)[^\d]*(\d+)/i) || clearResult.output.match(/(\d+)\s*(?:items|個物品)/i);
    const clearedCount = match ? parseInt(match[1], 10) : 0;
    if (clearedCount !== quantity) {
      expressSessions.delete(sessionId);
      return interaction.editReply({
        content: `❌ 扣除道具數量不符，已取消寄送。`
      });
    }

    // 4. Create Mail in DB
    await OfflineMailRepository.createMail(
      sessionData.senderDiscordId,
      sessionData.senderMcUsername,
      receiverMc,
      selectedItem.id,
      quantity,
      selectedItem.components || null
    );

    // Clean session
    expressSessions.delete(sessionId);

    return interaction.editReply({
      content: `✅ **快遞寄送成功！**\n- 寄件人：\`${sessionData.senderMcUsername}\`\n- 收件人：\`${receiverMc}\`\n- 道具：\`${selectedItem.id.replace('minecraft:', '')}\` x${quantity}${warning}`
    });
  } catch (error) {
    logger.error('Error submitting express modal', { error });
    return interaction.editReply({
      content: `❌ 處理快遞寄送時發生錯誤：${error.message}`
    });
  }
}

async function handleQueryInbox(interaction) {
  const discordId = interaction.user.id;
  const binding = await UserRepository.getBindingByDiscordId(discordId);

  if (!binding) {
    return interaction.reply({
      content: '❌ 您尚未綁定 Minecraft 帳號！請先在遊戲內輸入 `/discord` 取得驗證碼，並私訊本機器人以完成綁定。',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const allMails = await OfflineMailRepository.getAllMails(binding.mc_username);
    if (allMails.length === 0) {
      return interaction.editReply({
        content: `📬 您的收件箱 (\`${binding.mc_username}\`) 目前沒有任何快遞紀錄。`
      });
    }

    let description = '';
    allMails.forEach((mail) => {
      const statusText = mail.status === 'delivered' ? `🟢 已收件 (${mail.delivered_at})` : '🟡 待收件 (未上線)';
      description += `📦 **快遞 #${mail.id}**\n- 寄件者：\`${mail.sender_username}\`\n- 道具：\`${mail.item_id.replace('minecraft:', '')}\` x${mail.quantity}\n- 狀態：${statusText}\n\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`📬 快遞收件箱 - ${binding.mc_username}`)
      .setColor('#e67e22')
      .setDescription(description)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    return interaction.editReply({
      content: `❌ 查詢收件箱時發生錯誤：${error.message}`
    });
  }
}

async function deliverPendingMails(username) {
  try {
    const pending = await OfflineMailRepository.getPendingMails(username);
    if (pending.length === 0) return;

    logger.info(`Found ${pending.length} pending mails for joining player ${username}. Delivering...`);

    for (const mail of pending) {
      try {
        let giveResult;
        if (mail.item_id === 'craftcore:money') {
          const addMoneyCmd = `addmoney "${username}" ${mail.quantity}`;
          giveResult = await session.executeCommand(addMoneyCmd, 'System');
        } else {
          const itemSelector = mail.nbt ? `${mail.item_id}[${mail.nbt}]` : mail.item_id;
          const giveCmd = `give "${username}" ${itemSelector} ${mail.quantity}`;
          giveResult = await session.executeCommand(giveCmd, 'System');
        }

        if (giveResult.success) {
          await OfflineMailRepository.markMailDelivered(mail.id);
          // Send tellraw notification
          const textMsg = mail.item_id === 'craftcore:money'
            ? `📦 [快遞] 收到來自 ${mail.sender_username} 的快遞金幣：$${mail.quantity} 元！`
            : `📦 [快遞] 收到來自 ${mail.sender_username} 的快遞：${mail.item_id.replace('minecraft:', '')} x${mail.quantity}！`;
          const msgJson = JSON.stringify({
            text: textMsg,
            color: 'gold'
          });
          await session.executeCommand(`tellraw "${username}" ${msgJson}`, 'System');
          logger.info(`Successfully delivered mail #${mail.id} to ${username}`);
        } else {
          logger.error(`Failed to execute delivery command for mail #${mail.id}`, { output: giveResult.output });
        }
      } catch (err) {
        logger.error(`Error delivering mail #${mail.id} to ${username}`, { error: err });
      }
    }
  } catch (error) {
    logger.error(`Error checking/delivering pending mails for ${username}`, { error: error });
  }
}

module.exports = {
  handleInitiateExpress,
  handleSelectExpressItem,
  handleExpressModalSubmit,
  handleQueryInbox,
  deliverPendingMails
};
