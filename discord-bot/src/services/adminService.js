const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const UserRepository = require('../database/repositories/UserRepository');
const session = require('../websocket/session');
const config = require('../config');
const logger = require('../utils/logger');

function isUserAdmin(member) {
  if (!member) return false;
  // Check Administrator permission (8n is PermissionFlagsBits.Administrator)
  if (member.permissions && member.permissions.has(8n)) return true;
  
  const adminRoleIds = config.discord.adminRoleIds || [];
  if (member.roles && member.roles.cache) {
    for (const roleId of adminRoleIds) {
      if (member.roles.cache.has(roleId)) return true;
    }
  }
  return false;
}

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

async function showBanModal(interaction) {
  if (!isUserAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ 您沒有權限執行此操作。', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('admin_ban_modal')
    .setTitle('🚫 封鎖玩家');

  const nameInput = new TextInputBuilder()
    .setCustomId('player_name')
    .setLabel('玩家遊戲名稱 (Minecraft Username)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('封鎖原因 (Reason)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  return interaction.showModal(modal);
}

async function showKickModal(interaction) {
  if (!isUserAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ 您沒有權限執行此操作。', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('admin_kick_modal')
    .setTitle('🥾 踢出玩家');

  const nameInput = new TextInputBuilder()
    .setCustomId('player_name')
    .setLabel('玩家遊戲名稱 (Minecraft Username)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('踢出原因 (Reason)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  return interaction.showModal(modal);
}

async function showCoBrandModal(interaction) {
  if (!isUserAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ 您沒有權限執行此操作。', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('admin_co_brand_modal')
    .setTitle('🤝 聯名獎勵 (發送鑰匙)');

  const targetInput = new TextInputBuilder()
    .setCustomId('target')
    .setLabel('對象 (Discord ID / Mention / MC 帳號)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(targetInput));

  return interaction.showModal(modal);
}

async function showSearchModal(interaction) {
  if (!isUserAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ 您沒有權限執行此操作。', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('admin_search_modal')
    .setTitle('🔍 查詢玩家資訊');

  const queryInput = new TextInputBuilder()
    .setCustomId('player_query')
    .setLabel('查詢對象 (Discord ID / Mention / MC 帳號)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(queryInput));

  return interaction.showModal(modal);
}

async function handleBanSubmit(interaction) {
  const playerName = interaction.fields.getTextInputValue('player_name').trim();
  const reason = interaction.fields.getTextInputValue('reason').trim();

  if (!session.isActive()) {
    return interaction.reply({ content: '❌ 遊戲伺服器目前未連線，無法執行指令。', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await session.executeCommand(`ban "${playerName}" ${reason}`, interaction.user.tag);
    logger.info(`Admin ${interaction.user.tag} banned player ${playerName}. Result: ${result.output}`);
    return interaction.editReply({
      content: `✅ 成功封鎖玩家 \`${playerName}\`！\n- 原因：${reason}\n- 伺服器回應：\`${result.output}\``
    });
  } catch (error) {
    return interaction.editReply({
      content: `❌ 執行封鎖時發生錯誤：${error.message}`
    });
  }
}

async function handleKickSubmit(interaction) {
  const playerName = interaction.fields.getTextInputValue('player_name').trim();
  const reason = interaction.fields.getTextInputValue('reason').trim();

  if (!session.isActive()) {
    return interaction.reply({ content: '❌ 遊戲伺服器目前未連線，無法執行指令。', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await session.executeCommand(`kick "${playerName}" ${reason}`, interaction.user.tag);
    logger.info(`Admin ${interaction.user.tag} kicked player ${playerName}. Result: ${result.output}`);
    return interaction.editReply({
      content: `✅ 成功踢出玩家 \`${playerName}\`！\n- 原因：${reason}\n- 伺服器回應：\`${result.output}\``
    });
  } catch (error) {
    return interaction.editReply({
      content: `❌ 執行踢出時發生錯誤：${error.message}`
    });
  }
}

async function handleCoBrandSubmit(interaction) {
  const target = interaction.fields.getTextInputValue('target').trim();

  await interaction.deferReply({ ephemeral: true });

  let resolvedTarget = target;
  let isDiscord = false;
  let discordId = null;

  const mentionMatch = resolvedTarget.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    discordId = mentionMatch[1];
    isDiscord = true;
  } else if (/^\d{17,20}$/.test(resolvedTarget)) {
    discordId = resolvedTarget;
    isDiscord = true;
  }

  try {
    let mcUsername = resolvedTarget;
    if (isDiscord) {
      const binding = await UserRepository.getBindingByDiscordId(discordId);
      if (binding) {
        mcUsername = binding.mc_username;
      } else {
        throw new Error('該 Discord 用戶尚未綁定 Minecraft 帳號。');
      }
    }

    const finalBinding = await UserRepository.getBindingByMcUsername(mcUsername);
    if (!finalBinding) {
      throw new Error(`找不到玩家 \`${mcUsername}\` 的帳號綁定紀錄。`);
    }

    await UserRepository.addKeysByMcUsername(mcUsername, 6);

    let rconMsg = '';
    if (session.isActive()) {
      try {
        const moneyResult = await session.executeCommand(`addmoney "${mcUsername}" 5000`, 'System');
        rconMsg = `，並於遊戲內發送 5000 元金幣（${moneyResult.output.trim()}）`;
      } catch (e) {
        logger.error('Failed to add co-brand money in game', { error: e, mcUsername });
        rconMsg = '，但遊戲內發送 5000 元金幣失敗（伺服器或指令錯誤）';
      }
    } else {
      rconMsg = '，但由於遊戲伺服器未連線，5000 元金幣未能即時發送';
    }

    return interaction.editReply({
      content: `✅ 成功發送聯名獎勵 (6 把鑰匙) 給 Minecraft 玩家 \`${mcUsername}\`${rconMsg}！`
    });
  } catch (error) {
    return interaction.editReply({
      content: `❌ 發送聯名獎勵時發生錯誤：${error.message}`
    });
  }
}

async function handleSearchSubmit(interaction) {
  const query = interaction.fields.getTextInputValue('player_query').trim();

  await interaction.deferReply({ ephemeral: true });

  let resolvedQuery = query;
  let discordId = null;

  const mentionMatch = resolvedQuery.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    discordId = mentionMatch[1];
  } else if (/^\d{17,20}$/.test(resolvedQuery)) {
    discordId = resolvedQuery;
  }

  try {
    let binding = null;
    if (discordId) {
      binding = await UserRepository.getBindingByDiscordId(discordId);
    } else {
      binding = await UserRepository.getBindingByMcUsername(resolvedQuery);
    }

    let mcUsername = resolvedQuery;
    let boundDiscordId = null;

    if (binding) {
      mcUsername = binding.mc_username;
      boundDiscordId = binding.discord_id;
    }

    if (!session.isActive()) {
      return interaction.editReply({
        content: `⚠️ 遊戲伺服器目前未連線，僅能提供資料庫綁定資訊：\n- Minecraft 帳號：\`${mcUsername}\`\n- 綁定 Discord ID：${boundDiscordId ? `<@${boundDiscordId}>` : '未綁定'}`
      });
    }

    const info = await session.executeCommand(`playerinfo "${mcUsername}"`, interaction.user.tag);
    if (!info.success) {
      return interaction.editReply({
        content: `❌ 查詢失敗！伺服器回應：\`${info.output}\``
      });
    }

    const output = info.output;
    const onlineMatch = output.match(/Online:\s*(true|false)/i);
    const coordsMatch = output.match(/Coords:\s*(.+?)(?:,|$)/i);
    const lastOnlineMatch = output.match(/LastOnline:\s*(.+?)(?:,|$)/i);
    const dimensionMatch = output.match(/Dimension:\s*(.+?)(?:,|$)/i);

    const isOnline = onlineMatch ? (onlineMatch[1].toLowerCase() === 'true') : false;
    const coords = coordsMatch ? coordsMatch[1].trim() : '未知';
    const lastOnline = lastOnlineMatch ? lastOnlineMatch[1].trim() : '未知';
    const dimension = dimensionMatch ? dimensionMatch[1].trim() : '未知';

    const embed = new EmbedBuilder()
      .setTitle('🔍 玩家詳細資訊')
      .setColor('#3498db')
      .addFields(
        { name: 'Minecraft 玩家名', value: `\`${mcUsername}\``, inline: true },
        { name: '綁定 Discord', value: boundDiscordId ? `<@${boundDiscordId}>` : '未綁定', inline: true },
        { name: '在線狀態', value: isOnline ? '🟢 線上' : '🔴 離線', inline: true },
        { name: '最後上線時間', value: lastOnline, inline: false },
        { name: '目前位置', value: `${coords} (${dimension})`, inline: false }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`admin_inspect_inv:${mcUsername}`)
        .setLabel('🔍 查詢背包')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    return interaction.editReply({
      content: `❌ 查詢玩家資訊時發生錯誤：${error.message}`
    });
  }
}

async function handleInspectInventory(interaction) {
  if (!isUserAdmin(interaction.member)) {
    return interaction.reply({ content: '❌ 您沒有權限執行此操作。', ephemeral: true });
  }

  const customId = interaction.customId;
  const username = customId.substring(customId.indexOf(':') + 1);

  if (!session.isActive()) {
    return interaction.reply({ content: '❌ 遊戲伺服器目前未連線，無法查詢背包。', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await session.executeCommand(`data get entity "${username}" Inventory`, interaction.user.tag);
    if (!result.success) {
      return interaction.editReply({
        content: `❌ 查詢背包失敗！伺服器回應：\`${result.output}\``
      });
    }

    const parsedItems = parseInventoryNbt(result.output);

    if (parsedItems.length === 0) {
      return interaction.editReply({
        content: `🎒 玩家 \`${username}\` 的背包是空的。`
      });
    }

    const hotbar = [];
    const inventory = [];
    const armor = { helmet: null, chestplate: null, leggings: null, boots: null };
    let offhand = null;

    for (const item of parsedItems) {
      if (item.slot >= 0 && item.slot <= 8) {
        hotbar.push(item);
      } else if (item.slot >= 9 && item.slot <= 35) {
        inventory.push(item);
      } else if (item.slot === 100) {
        armor.boots = item;
      } else if (item.slot === 101) {
        armor.leggings = item;
      } else if (item.slot === 102) {
        armor.chestplate = item;
      } else if (item.slot === 103) {
        armor.helmet = item;
      } else if (item.slot === -106 || item.slot === 150) {
        offhand = item;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎒 玩家背包清單 - ${username}`)
      .setColor('#2ecc71')
      .setTimestamp();

    // Format Armor
    let armorText = '';
    armorText += `頭盔: ${armor.helmet ? `\`${armor.helmet.id}\` x${armor.helmet.count}` : '❌'}\n`;
    armorText += `胸甲: ${armor.chestplate ? `\`${armor.chestplate.id}\` x${armor.chestplate.count}` : '❌'}\n`;
    armorText += `護腿: ${armor.leggings ? `\`${armor.leggings.id}\` x${armor.leggings.count}` : '❌'}\n`;
    armorText += `靴子: ${armor.boots ? `\`${armor.boots.id}\` x${armor.boots.count}` : '❌'}\n`;
    embed.addFields({ name: '🛡️ 裝備欄', value: armorText, inline: false });

    // Format Offhand
    embed.addFields({ name: '🛡️ 副手', value: offhand ? `\`${offhand.id}\` x${offhand.count}` : '❌', inline: false });

    // Format Hotbar
    if (hotbar.length > 0) {
      const hotbarText = hotbar.map(i => `[Slot ${i.slot}] \`${i.id}\` x${i.count}`).join('\n');
      embed.addFields({ name: '🔥 快捷欄 (Hotbar)', value: hotbarText, inline: false });
    }

    // Format Inventory
    if (inventory.length > 0) {
      const chunks = [];
      let tempText = '';
      for (const i of inventory) {
        const itemLine = `[Slot ${i.slot}] \`${i.id}\` x${i.count}\n`;
        if (tempText.length + itemLine.length > 1000) {
          chunks.push(tempText);
          tempText = itemLine;
        } else {
          tempText += itemLine;
        }
      }
      if (tempText) chunks.push(tempText);

      chunks.forEach((chunk, index) => {
        embed.addFields({ name: `📦 背包庫存 (第 ${index + 1} 頁)`, value: chunk, inline: false });
      });
    }

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    return interaction.editReply({
      content: `❌ 查詢背包時發生錯誤：${error.message}`
    });
  }
}

module.exports = {
  showBanModal,
  showKickModal,
  showCoBrandModal,
  showSearchModal,
  handleBanSubmit,
  handleKickSubmit,
  handleCoBrandSubmit,
  handleSearchSubmit,
  handleInspectInventory,
  isUserAdmin
};
