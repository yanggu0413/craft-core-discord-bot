const { EmbedBuilder } = require('discord.js');
const UserRepository = require('../database/repositories/UserRepository');
const session = require('../websocket/session');
const discordQueue = require('../utils/discordQueue');
const logger = require('../utils/logger');

// Rewards Pool for Lucky Draw
const LOTTERY_REWARDS = [
  { name: '鑽石 x 5', id: 'minecraft:diamond', amount: 5 },
  { name: '金胡蘿蔔 x 5', id: 'minecraft:golden_carrot', amount: 5 },
  { name: '金蘋果 x 5', id: 'minecraft:golden_apple', amount: 5 },
  { name: '經驗瓶 x 64', id: 'minecraft:experience_bottle', amount: 64 },
  { name: '不死圖騰 x 1', id: 'minecraft:totem_of_undying', amount: 1 },
  { name: '金幣 100 元', id: 'craftcore:money', amount: 100 }
];

function getTaipeiDateString(date = new Date()) {
  const options = { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

function getTaipeiYesterdayDateString(date = new Date()) {
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getTaipeiDateString(yesterday);
}

async function handleCheckin(interaction) {
  const discordId = interaction.user.id;
  const binding = await UserRepository.getBindingByDiscordId(discordId);

  if (!binding) {
    return interaction.reply({
      content: '❌ 您尚未綁定 Minecraft 帳號！請先在遊戲內輸入 `/discord link` 取得驗證碼，並私訊本機器人以完成綁定。',
      ephemeral: true
    });
  }

  const todayStr = getTaipeiDateString();
  const yesterdayStr = getTaipeiYesterdayDateString();

  const userKeys = await UserRepository.getUserKeys(discordId);
  const lastCheckin = userKeys.last_checkin;
  const checkinStreak = userKeys.checkin_streak || 0;
  const keysCount = userKeys.keys_count || 0;

  if (lastCheckin === todayStr) {
    return interaction.reply({
      content: '📅 您今天已經簽到過囉！請明天再來。',
      ephemeral: true
    });
  }

  let newStreak = lastCheckin === yesterdayStr ? (checkinStreak + 1) : 1;
  let keysAwarded = 1;

  if (newStreak === 7) {
    keysAwarded = 3;
  } else if (newStreak > 7) {
    newStreak = 1;
    keysAwarded = 1;
  }

  await UserRepository.setCheckinWithStreak(discordId, todayStr, newStreak, keysAwarded);

  const embed = new EmbedBuilder()
    .setTitle('📅 每日簽到成功！')
    .setColor('#2ecc71')
    .addFields(
      { name: 'Minecraft 帳號', value: `\`${binding.mc_username}\``, inline: true },
      { name: '獲得鑰匙', value: `🔑 +${keysAwarded} 把`, inline: true },
      { name: '連續簽到', value: `🔥 ${newStreak} 天`, inline: true },
      { name: '鑰匙餘額', value: `🔑 ${keysCount + keysAwarded} 把`, inline: true }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

async function handleQueryKeys(interaction) {
  const discordId = interaction.user.id;
  const binding = await UserRepository.getBindingByDiscordId(discordId);

  if (!binding) {
    return interaction.reply({
      content: '❌ 您尚未綁定 Minecraft 帳號！請先在遊戲內輸入 `/discord link` 取得驗證碼，並私訊本機器人以完成綁定。',
      ephemeral: true
    });
  }

  const userKeys = await UserRepository.getUserKeys(discordId);
  const embed = new EmbedBuilder()
    .setTitle('🔑 玩家鑰匙資訊')
    .setColor('#3498db')
    .addFields(
      { name: 'Minecraft 帳號', value: `\`${binding.mc_username}\``, inline: true },
      { name: '鑰匙餘額', value: `🔑 ${userKeys.keys_count || 0} 把`, inline: true },
      { name: '連續簽到', value: `🔥 ${userKeys.checkin_streak || 0} 天`, inline: true },
      { name: '上次簽到時間', value: `📅 ${userKeys.last_checkin || '無紀錄'}`, inline: false }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleLeaderboard(interaction) {
  const leaderboard = await UserRepository.getCheckinLeaderboard(10);

  if (!leaderboard || leaderboard.length === 0) {
    return interaction.reply({
      content: '📭 目前尚無簽到排行榜數據。',
      ephemeral: true
    });
  }

  let description = '';
  leaderboard.forEach((user, index) => {
    let medal = '👤';
    if (index === 0) medal = '🥇';
    else if (index === 1) medal = '🥈';
    else if (index === 2) medal = '🥉';

    description += `${medal} **第 ${index + 1} 名** - \`${user.mc_username}\`\n  🔑 鑰匙：\`${user.keys_count}\` 把 | 🔥 連續簽到：\`${user.checkin_streak}\` 天 | 🏆 總簽到：\`${user.total_checkins || 0}\` 次\n\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🏆 簽到與鑰匙排行榜 (Top 10)')
    .setColor('#f1c40f')
    .setDescription(description)
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

async function handleSubscribeReminder(interaction) {
  const discordId = interaction.user.id;
  const binding = await UserRepository.getBindingByDiscordId(discordId);

  if (!binding) {
    return interaction.reply({
      content: '❌ 您尚未綁定 Minecraft 帳號！請先在遊戲內輸入 `/discord link` 取得驗證碼，並私訊本機器人以完成綁定。',
      ephemeral: true
    });
  }

  const userKeys = await UserRepository.getUserKeys(discordId);
  const currentSub = userKeys.subscribe_reminder || 0;
  const newSub = currentSub === 1 ? 0 : 1;

  await UserRepository.toggleReminderSubscription(discordId, newSub);

  return interaction.reply({
    content: newSub === 1
      ? '🔔 **每日簽到提醒已開啟！** 機器人將在每日 **20:00 (Asia/Taipei)** 私訊提醒您進行簽到。'
      : '🔕 **每日簽到提醒已關閉。** 機器人將不再私訊提醒您。',
    ephemeral: true
  });
}

async function handleLottery(interaction) {
  const discordId = interaction.user.id;
  const binding = await UserRepository.getBindingByDiscordId(discordId);

  if (!binding) {
    return interaction.reply({
      content: '❌ 您尚未綁定 Minecraft 帳號！請先在遊戲內輸入 `/discord link` 取得驗證碼，並私訊本機器人以完成綁定。',
      ephemeral: true
    });
  }

  const userKeys = await UserRepository.getUserKeys(discordId);
  if (!userKeys || (userKeys.keys_count || 0) < 1) {
    return interaction.reply({
      content: '❌ 您的鑰匙餘額不足！抽獎需要 1 把鑰匙。',
      ephemeral: true
    });
  }

  // Deduct key immediately
  await UserRepository.updateKeys(discordId, userKeys.keys_count - 1);

  if (!session.isActive()) {
    // Refund the key
    await UserRepository.addKeysByDiscordId(discordId, 1);
    return interaction.reply({
      content: '❌ 遊戲伺服器目前未連線，無法進行抽獎。',
      ephemeral: true
    });
  }

  await interaction.deferReply();

  // Check if player is online
  try {
    const info = await session.executeCommand(`playerinfo "${binding.mc_username}"`, interaction.user.tag);
    if (!info.success || !info.output.includes('Online: true')) {
      // Refund the key
      await UserRepository.addKeysByDiscordId(discordId, 1);
      return interaction.editReply({
        content: `❌ 開獎失敗！您必須處於遊戲線上狀態才能接收道具。`
      });
    }
  } catch (err) {
    // Refund the key
    await UserRepository.addKeysByDiscordId(discordId, 1);
    return interaction.editReply({
      content: `❌ 開獎失敗！無法驗證您的線上狀態：${err.message}`
    });
  }

  // Pick prize
  console.log('[DEBUG LOTTERY] Math.random output:', Math.random(), 'function string:', Math.random.toString());
  const prize = LOTTERY_REWARDS[Math.floor(Math.random() * LOTTERY_REWARDS.length)];
  console.log('[DEBUG LOTTERY] selected prize:', prize);

  // Run in-game commands
  try {
    if (prize.id === 'craftcore:money') {
      await session.executeCommand(`addmoney "${binding.mc_username}" ${prize.amount + 150}`, 'System');
    } else {
      await session.executeCommand(`give "${binding.mc_username}" ${prize.id} ${prize.amount}`, 'System');
      await session.executeCommand(`addmoney "${binding.mc_username}" 150`, 'System');
    }
    await session.executeCommand(`title "${binding.mc_username}" title {"text":"🎉 抽獎成功！","color":"yellow"}`, 'System');
    await session.executeCommand(`title "${binding.mc_username}" subtitle {"text":"獲得了 ${prize.name} + 額外 $150 遊戲幣","color":"gold"}`, 'System');
    await session.executeCommand(`playsound minecraft:entity.player.levelup master "${binding.mc_username}"`, 'System');
  } catch (err) {
    logger.error(`Failed to execute lottery command in game: ${err.message}`, { stack: err.stack, username: binding.mc_username });
  }

  const prizeText = prize.id === 'craftcore:money'
    ? `🎁 **$${prize.amount + 150}** 遊戲幣 (含額外加贈 **$150**)`
    : `🎁 **${prize.name}** + 💰 **$150** 額外金幣`;

  const embed = new EmbedBuilder()
    .setTitle('🎉 幸運大抽獎！')
    .setColor('#f1c40f')
    .setDescription(`恭喜 **${interaction.user.username}** 消耗 1 把鑰匙，成功抽中好禮！`)
    .addFields(
      { name: 'Minecraft 帳號', value: `\`${binding.mc_username}\``, inline: true },
      { name: '獲得獎勵', value: prizeText, inline: true },
      { name: '鑰匙餘額', value: `🔑 ${userKeys.keys_count - 1} 把`, inline: true }
    )
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handlePlaytimeExchange(interaction) {
  const discordId = interaction.user.id;
  const binding = await UserRepository.getBindingByDiscordId(discordId);

  if (!binding) {
    return interaction.reply({
      content: '❌ 您尚未綁定 Minecraft 帳號！請先在遊戲內輸入 `/discord link` 取得驗證碼，並私訊本機器人以完成綁定。',
      ephemeral: true
    });
  }

  if (!session.isActive()) {
    return interaction.reply({
      content: '❌ 遊戲伺服器目前未連線，無法讀取遊戲時數。',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const rconResult = await session.executeCommand(`scoreboard players get "${binding.mc_username}" play_time`, interaction.user.tag);
    if (!rconResult.success) {
      return interaction.editReply({
        content: `❌ 時數兌換失敗！無法取得您的遊戲時數。管理員是否已建立 play_time 計分板？`
      });
    }

    const output = rconResult.output;
    const match = output.match(/(\d+)\s*(?:\[|分數|$)/) || output.match(/has (\d+)/) || output.match(/(\d+)/);
    if (!match) {
      return interaction.editReply({
        content: `❌ 時數兌換失敗！無法解析 RCON 傳回的數值：\n\`${output}\``
      });
    }

    const totalTicks = parseInt(match[1], 10);
    const userKeys = await UserRepository.getUserKeys(discordId);
    const exchangedTicks = userKeys.exchanged_ticks || 0;

    const availableTicks = Math.max(0, totalTicks - exchangedTicks);
    const hours = Math.floor(availableTicks / 72000);

    if (hours < 5) {
      const remainingTicks = 5 * 72000 - availableTicks;
      const remainingHours = (remainingTicks / 72000).toFixed(1);
      return interaction.editReply({
        content: `❌ 您的累積可用時數不足！兌換 1 把鑰匙需要滿 5 小時。\n- 目前可用時數：\`${(availableTicks / 72000).toFixed(1)}\` 小時\n- 還差 \`${remainingHours}\` 小時。`
      });
    }

    const keysToAdd = Math.floor(hours / 5);
    const ticksToDeduct = keysToAdd * 5 * 72000;

    await UserRepository.updateExchangedTicks(discordId, exchangedTicks + ticksToDeduct, keysToAdd);

    const embed = new EmbedBuilder()
      .setTitle('⏳ 遊戲時數兌換成功！')
      .setColor('#9b59b6')
      .addFields(
        { name: 'Minecraft 帳號', value: `\`${binding.mc_username}\``, inline: true },
        { name: '扣除時數', value: `⏳ ${keysToAdd * 5} 小時`, inline: true },
        { name: '獲得鑰匙', value: `🔑 +${keysToAdd} 把`, inline: true },
        { name: '鑰匙餘額', value: `🔑 ${(userKeys.keys_count || 0) + keysToAdd} 把`, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    return interaction.editReply({
      content: `❌ 兌換時數時發生錯誤：${error.message}`
    });
  }
}

let lastDaemonRunDate = null;
function startReminderDaemon(client) {
  setInterval(async () => {
    try {
      const now = new Date();
      const taipeiTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Taipei', hour12: false });
      const [hour, minute] = taipeiTimeStr.split(':').map(Number);
      const todayStr = getTaipeiDateString(now);

      if (hour === 20 && minute === 0 && lastDaemonRunDate !== todayStr) {
        lastDaemonRunDate = todayStr;
        logger.info('Running daily check-in reminders daemon...');

        const subscribers = await UserRepository.getSubscribedUsers();
        for (const sub of subscribers) {
          const keysRow = await UserRepository.getUserKeys(sub.discord_id);
          if (keysRow && keysRow.last_checkin !== todayStr) {
            try {
              const user = await client.users.fetch(sub.discord_id);
              if (user) {
                await discordQueue.enqueue(() => user.send(`📅 **每日簽到提醒**\n哈囉！提醒您今天尚未進行每日簽到喔！\n請記得前往伺服器 Discord 頻道完成簽到以領取鑰匙 🔑`), { type: 'reminder_dm', discordId: sub.discord_id });
              }
            } catch (err) {
              logger.error(`Failed to send check-in reminder DM to ${sub.discord_id}`, { error: err });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error in daily check-in reminder daemon', { error });
    }
  }, 60 * 1000).unref();
}

module.exports = {
  handleCheckin,
  handleQueryKeys,
  handleLeaderboard,
  handleSubscribeReminder,
  handleLottery,
  handlePlaytimeExchange,
  startReminderDaemon
};
