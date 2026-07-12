const { EmbedBuilder } = require('discord.js');
const DailyStatsRepository = require('../database/repositories/DailyStatsRepository');
const PlayerStatsRepository = require('../database/repositories/PlayerStatsRepository');
const discordQueue = require('../utils/discordQueue');
const logger = require('../utils/logger');

const STATS_BOARD_CHANNEL_ID = '1524976889897287834';

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

async function updateStatsBoard(client) {
  try {
    const channel = await client.channels.fetch(STATS_BOARD_CHANNEL_ID);
    if (!channel) {
      logger.warn(`Stats Board channel ${STATS_BOARD_CHANNEL_ID} not found.`);
      return;
    }

    // 1. Locate existing bot message
    let boardMsg = null;
    try {
      const pinned = await channel.messages.fetchPinned();
      boardMsg = pinned.find(m => m.author.id === client.user.id);
    } catch (e) {
      logger.warn('Failed to fetch pinned messages for stats board', { error: e });
    }

    if (!boardMsg) {
      try {
        const recent = await channel.messages.fetch({ limit: 10 });
        boardMsg = recent.find(m => m.author.id === client.user.id);
      } catch (e) {
        logger.warn('Failed to fetch recent messages for stats board', { error: e });
      }
    }

    // 2. Fetch stats data
    const yesterdayStr = getTaipeiYesterdayDateString();
    const stats = await DailyStatsRepository.getStats(yesterdayStr);
    const uniqueLogins = await DailyStatsRepository.getLoginCount(yesterdayStr);

    const maxOnline = stats ? stats.max_online : 0;
    const totalLogins = stats ? stats.total_logins : 0;
    const totalMessages = stats ? stats.total_messages : 0;
    const totalDeaths = stats ? stats.total_deaths : 0;

    // Fetch death leaderboard
    const deathsLeaderboard = await PlayerStatsRepository.getDeathLeaderboard(10);

    // 3. Build Embed
    const embed = new EmbedBuilder()
      .setTitle('📊 伺服器數據與排行榜')
      .setColor('#34495e')
      .addFields(
        { 
          name: `📅 昨日數據簡報 (${yesterdayStr})`, 
          value: `📈 最高在線人數：\`${maxOnline}\` 人\n👤 總登入次數：\`${totalLogins}\` 次 (不重複玩家：\`${uniqueLogins}\` 人)\n💬 總聊天訊息量：\`${totalMessages}\` 則\n💀 總死亡次數：\`${totalDeaths}\` 次`,
          inline: false 
        }
      )
      .setTimestamp();

    let leaderboardText = '';
    if (deathsLeaderboard && deathsLeaderboard.length > 0) {
      deathsLeaderboard.forEach((p, idx) => {
        let medal = '👤';
        if (idx === 0) medal = '🥇';
        else if (idx === 1) medal = '🥈';
        else if (idx === 2) medal = '🥉';
        leaderboardText += `${medal} **第 ${idx + 1} 名** - \`${p.mc_username}\` (💀 死亡 \`${p.deaths}\` 次)\n`;
      });
    } else {
      leaderboardText = '📭 目前尚無死亡排行榜紀錄。';
    }

    embed.addFields({ name: '💀 伺服器死亡排行榜 (Top 10)', value: leaderboardText, inline: false });

    // 4. Send or Edit message
    if (boardMsg) {
      await discordQueue.enqueue(() => boardMsg.edit({ embeds: [embed] }), { type: 'stats_board_edit' });
    } else {
      const newMsg = await discordQueue.enqueue(() => channel.send({ embeds: [embed] }), { type: 'stats_board_send' });
      try {
        await newMsg.pin();
      } catch (e) {
        logger.error('Failed to pin new stats board message', { error: e });
      }
    }
  } catch (error) {
    logger.error('Error updating stats board', { error });
  }
}

function startStatsBoardLoop(client) {
  // Update immediately on startup
  updateStatsBoard(client);

  // Set interval to update every 5 minutes
  setInterval(() => {
    updateStatsBoard(client);
  }, 5 * 60 * 1000).unref();
}

module.exports = {
  updateStatsBoard,
  startStatsBoardLoop
};
