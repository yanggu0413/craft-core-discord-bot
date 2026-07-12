const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const UserRepository = require('../database/repositories/UserRepository');
const OfflineMailRepository = require('../database/repositories/OfflineMailRepository');
const session = require('../websocket/session');
const logger = require('../utils/logger');

async function handleQueryBalanceButton(interaction) {
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
      content: '❌ 遊戲伺服器目前未連線，無法查詢您的金幣餘額。',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const res = await session.queryBalance(binding.mc_username);
    if (res && res.success) {
      return interaction.editReply({
        content: `💰 **遊戲餘額查詢**\n- 玩家：\`${binding.mc_username}\`\n- 目前金幣餘額：\`$${res.balance}\` 元`
      });
    } else {
      return interaction.editReply({
        content: `❌ 查詢餘額失敗：${res && res.message ? res.message : '遊戲伺服器未回應'}`
      });
    }
  } catch (error) {
    logger.error('Error querying balance via button', { error });
    return interaction.editReply({
      content: `❌ 查詢餘額時發生錯誤：${error.message}`
    });
  }
}

async function handleQueryShopStatsButton(interaction) {
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
      content: '❌ 遊戲伺服器目前未連線，無法查詢您的商店數據。',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const res = await session.queryShopStats(binding.mc_username);
    if (res && res.success) {
      const shops = res.shops || [];
      const embed = new EmbedBuilder()
        .setTitle(`🏪 ${binding.mc_username} 的商店數據統計`)
        .setColor('#2ecc71')
        .setTimestamp();

      if (shops.length === 0) {
        embed.setDescription('您目前在遊戲中尚未建立任何商店。');
      } else {
        let description = '';
        let totalRevenue = 0;
        shops.forEach((shop, index) => {
          const itemText = shop.item ? shop.item.replace('minecraft:', '') : '未知物品';
          description += `📍 **商店 #${index + 1}**\n- 座標：\`${shop.location}\`\n- 販售物品：\`${itemText}\`\n- 庫存：\`${shop.stock}\` 個\n- 營業額：\`$${shop.revenue}\` 元\n\n`;
          totalRevenue += shop.revenue;
        });
        embed.setDescription(description);
        embed.addFields({ name: '📊 總營業額', value: `\`$${totalRevenue}\` 元` });
      }

      return interaction.editReply({ embeds: [embed] });
    } else {
      return interaction.editReply({
        content: `❌ 查詢商店數據失敗：${res && res.message ? res.message : '遊戲伺服器未回應'}`
      });
    }
  } catch (error) {
    logger.error('Error querying shop stats via button', { error });
    return interaction.editReply({
      content: `❌ 查詢商店數據時發生錯誤：${error.message}`
    });
  }
}

async function handleInitiateSendMoney(interaction) {
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
      content: '❌ 遊戲伺服器目前未連線，無法寄送金幣。',
      ephemeral: true
    });
  }

  // Open Modal to ask for receiver and amount
  const modal = new ModalBuilder()
    .setCustomId(`express_send_money_modal`)
    .setTitle('💰 寄送金幣快遞');

  const receiverInput = new TextInputBuilder()
    .setCustomId('receiver_mc')
    .setLabel('收件人 Minecraft 帳號')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('請輸入收件人遊戲名稱')
    .setRequired(true);

  const amountInput = new TextInputBuilder()
    .setCustomId('amount')
    .setLabel('寄送金額 (金幣)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('請輸入要寄送的金額')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(receiverInput),
    new ActionRowBuilder().addComponents(amountInput)
  );

  return interaction.showModal(modal);
}

const activeTransactions = new Set();

async function handleSendMoneyModalSubmit(interaction) {
  const discordId = interaction.user.id;
  const binding = await UserRepository.getBindingByDiscordId(discordId);

  if (!binding) {
    return interaction.reply({
      content: '❌ 找不到您的帳號綁定紀錄。',
      ephemeral: true
    });
  }

  if (activeTransactions.has(discordId)) {
    return interaction.reply({
      content: '❌ 您的交易正在處理中，請勿重複點擊！',
      ephemeral: true
    });
  }

  const receiverMc = interaction.fields.getTextInputValue('receiver_mc').trim();
  const amountStr = interaction.fields.getTextInputValue('amount').trim();

  if (!/^\d+$/.test(amountStr) || parseInt(amountStr, 10) <= 0) {
    return interaction.reply({
      content: '❌ 請輸入有效的正整數金額！',
      ephemeral: true
    });
  }

  const amount = parseInt(amountStr, 10);

  if (!session.isActive()) {
    return interaction.reply({
      content: '❌ 遊戲伺服器目前未連線，無法完成金幣寄送。',
      ephemeral: true
    });
  }

  activeTransactions.add(discordId);

  try {
    await interaction.deferReply({ ephemeral: true });

    // 1. Query sender's balance
    const balanceRes = await session.queryBalance(binding.mc_username);
    if (!balanceRes || !balanceRes.success) {
      return interaction.editReply({
        content: `❌ 查詢您的餘額失敗：${balanceRes && balanceRes.message ? balanceRes.message : '遊戲伺服器未回應'}`
      });
    }

    const balance = balanceRes.balance;
    if (balance < amount) {
      return interaction.editReply({
        content: `❌ 您的餘額不足！目前餘額為 \`${balance}\` 元，無法寄送 \`${amount}\` 元。`
      });
    }

    // 2. Deduct balance: send command removemoney <sender_username> <amount>
    // Enclose username in quotes for spaces
    const deductRes = await session.executeCommand(`removemoney "${binding.mc_username}" ${amount}`, 'System');
    if (!deductRes.success) {
      return interaction.editReply({
        content: `❌ 扣除您的金幣餘額失敗：\`${deductRes.output}\``
      });
    }

    // 3. Verify receiver exists in bindings
    const receiverBinding = await UserRepository.getBindingByMcUsername(receiverMc);
    let warning = '';
    if (!receiverBinding) {
      warning = `\n⚠️ **警示**：玩家 \`${receiverMc}\` 目前尚無 Discord 綁定紀錄，請確認帳號名稱是否拼寫正確！`;
    }

    // 4. Queue in offline_mails
    await OfflineMailRepository.createMail(
      discordId,
      binding.mc_username,
      receiverMc,
      'craftcore:money',
      amount,
      null
    );

    return interaction.editReply({
      content: `✅ **金幣快遞寄送成功！**\n- 寄件人：\`${binding.mc_username}\`\n- 收件人：\`${receiverMc}\`\n- 金額：\`$${amount}\` 元${warning}`
    });

  } catch (error) {
    logger.error('Error in send money express modal submit', { error });
    return interaction.editReply({
      content: `❌ 處理金幣快遞時發生錯誤：${error.message}`
    });
  } finally {
    activeTransactions.delete(discordId);
  }
}

async function handleQueryRichListButton(interaction) {
  if (!session.isActive()) {
    return interaction.reply({
      content: '❌ 遊戲伺服器目前未連線，無法讀取富豪榜。',
      ephemeral: true
    });
  }

  const isEphemeral = interaction.isButton();
  await interaction.deferReply({ ephemeral: isEphemeral });

  try {
    const res = await session.queryRichList(10);
    if (res && res.success) {
      const leaderboard = res.players || res.leaderboard || [];

      const embed = new EmbedBuilder()
        .setTitle('🏆 Craft-Core 伺服器富豪榜')
        .setColor('#f1c40f')
        .setTimestamp();

      if (leaderboard.length === 0) {
        embed.setDescription('目前富豪榜沒有任何玩家數據。');
        return interaction.editReply({ embeds: [embed] });
      }

      const rankField = [];
      const nameField = [];
      const balanceField = [];

      leaderboard.forEach((user, index) => {
        let rankStr = `${index + 1}th`;
        if (index === 0) rankStr = '🥇 1st';
        else if (index === 1) rankStr = '🥈 2nd';
        else if (index === 2) rankStr = '🥉 3rd';

        rankField.push(rankStr);
        nameField.push(`\`${user.username}\``);

        const formattedBalance = `$${Number(user.balance).toLocaleString()}`;
        balanceField.push(`\`${formattedBalance}\` 元`);
      });

      embed.addFields(
        { name: '👑 排名 (Rank)', value: rankField.join('\n'), inline: true },
        { name: '👤 玩家名稱 (Player)', value: nameField.join('\n'), inline: true },
        { name: '💰 財富餘額 (Balance)', value: balanceField.join('\n'), inline: true }
      );

      return interaction.editReply({ embeds: [embed] });
    } else {
      return interaction.editReply({
        content: `❌ 讀取富豪榜失敗：${res && res.message ? res.message : '遊戲伺服器未回應'}`
      });
    }
  } catch (error) {
    logger.error('Error querying rich list', { error });
    return interaction.editReply({
      content: `❌ 讀取富豪榜時發生錯誤：${error.message}`
    });
  }
}

module.exports = {
  handleQueryBalanceButton,
  handleQueryShopStatsButton,
  handleInitiateSendMoney,
  handleSendMoneyModalSubmit,
  handleQueryRichListButton
};
