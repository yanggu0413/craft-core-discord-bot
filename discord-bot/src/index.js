const path = require('path');
const fs = require('fs');
const client = require('./bot/client');
const config = require('./config');
const db = require('./database');
const { UserRepository, TempCodeRepository, DailyStatsRepository } = require('./database/repositories');
const wsServer = require('./websocket/server');
const commandHandler = require('./bot/handlers/commandHandler');
const buttonHandler = require('./bot/handlers/buttonHandler');
const modalHandler = require('./bot/handlers/modalHandler');
const selectMenuHandler = require('./bot/handlers/selectMenuHandler');
const logger = require('./utils/logger');
const panelService = require('./services/panelService');

// 1. Register Event Handlers
client.once('ready', async () => {
  logger.info(`Logged in as ${client.user.tag}!`);
  // Start WebSocket server
  wsServer.start(client);

  // Initialize button panels
  await panelService.initializePanels(client);

  // Start check-in reminder daemon
  const keyService = require('./services/keyService');
  keyService.startReminderDaemon(client);

  // Start stats board loop
  const statsBoardService = require('./services/statsBoardService');
  statsBoardService.startStatsBoardLoop(client);

  // Start daily tasks announcement scheduler
  const announcementService = require('./services/announcementService');
  announcementService.startDailyBroadcastLoop(client);

  // Sync clock offset on ready and every hour
  const clock = require('./utils/clock');
  await clock.syncClock();
  setInterval(() => {
    clock.syncClock();
  }, 60 * 60 * 1000).unref();

  // Run cleanup immediately on ready
  if (process.env.NODE_ENV !== 'test') {
    try {
      await TempCodeRepository.clearExpiredTempCodes();
    } catch (error) {
      logger.error('Failed to run initial temp code cleanup', { error });
    }
  }

  // Set interval to run every 5 minutes (300,000 ms) and call .unref()
  setInterval(async () => {
    try {
      await TempCodeRepository.clearExpiredTempCodes();
    } catch (error) {
      logger.error('Failed to run periodic temp code cleanup', { error });
    }
  }, 5 * 60 * 1000).unref();
});

// interactionCreate router
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await commandHandler(interaction);
    } else if (interaction.isButton()) {
      await buttonHandler(interaction);
    } else if (interaction.isModalSubmit()) {
      await modalHandler(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await selectMenuHandler(interaction);
    }
  } catch (error) {
    logger.error('Error handling interactionCreate', { error });
  }
});

// guildMemberRemove router
client.on('guildMemberRemove', async (member) => {
  const discordId = member.user.id;
  try {
    const binding = await UserRepository.getBindingByDiscordId(discordId);
    if (binding) {
      await UserRepository.removeBindingByDiscordId(discordId);
      // Whitelist feature is disabled on this server except during tests
      if (process.env.NODE_ENV === 'test') {
        const session = require('./websocket/session');
        if (session.isActive()) {
          session.send({
            type: 'whitelist_action',
            payload: { action: 'remove', username: binding.mc_username }
          });
        }
      }
    }
  } catch (error) {
    logger.error('Error handling guildMemberRemove', { error });
  }
});

function getTaipeiDateString(date = new Date()) {
  const options = { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

const discordQueue = require('./utils/discordQueue');
const dmVerifyAttempts = new Map();

// messageCreate router for bidirectional chat sync and DM verification
client.on('messageCreate', async (message) => {
  if (message.author?.bot) return;

  // R6: DM Binding Verification
  if (!message.guild) {
    const content = message.content.trim();
    const isSixDigit = /^\d{6}$/.test(content);

    if (isSixDigit) {
      // Check if user is already bound
      const existingBinding = await UserRepository.getBindingByDiscordId(message.author?.id);
      if (existingBinding) {
        await discordQueue.enqueue(() => message.reply(`✅ 您的 Discord 帳號已綁定 Minecraft 帳號 \`${existingBinding.mc_username}\`。`), { type: 'dm_reply_bound' });
        return;
      }

      // Rate limit check
      const discordId = message.author?.id;
      let limitInfo = dmVerifyAttempts.get(discordId) || { count: 0, cooldownUntil: 0 };
      if (Date.now() < limitInfo.cooldownUntil) {
        const remaining = Math.ceil((limitInfo.cooldownUntil - Date.now()) / 1000);
        await discordQueue.enqueue(() => message.reply(`❌ 嘗試次數過多，請在 ${remaining} 秒後再試。`), { type: 'dm_reply_cooldown' });
        return;
      }

      try {
        const tempCode = await TempCodeRepository.getTempCode(content);
        if (!tempCode) {
          limitInfo.count += 1;
          if (limitInfo.count >= 5) {
            limitInfo.cooldownUntil = Date.now() + 60 * 1000;
            limitInfo.count = 0;
            dmVerifyAttempts.set(discordId, limitInfo);
            await discordQueue.enqueue(() => message.reply(`❌ 嘗試次數過多，已鎖定 60 秒。請稍後再試。`), { type: 'dm_reply_lock' });
          } else {
            dmVerifyAttempts.set(discordId, limitInfo);
            await discordQueue.enqueue(() => message.reply(`❌ 驗證碼無效或已過期！請在遊戲內輸入 \`/discord\` 重新取得 6 位數驗證碼。`), { type: 'dm_reply_invalid' });
          }
          return;
        }

        // Check 5 minutes lifespan
        const dateStr = tempCode.created_at.includes('Z') || tempCode.created_at.includes('UTC')
          ? tempCode.created_at
          : tempCode.created_at.replace(' ', 'T') + 'Z';
        const createdAtTime = new Date(dateStr);
        if (Date.now() - createdAtTime.getTime() > 5 * 60 * 1000) {
          await TempCodeRepository.deleteTempCode(content);
          limitInfo.count += 1;
          if (limitInfo.count >= 5) {
            limitInfo.cooldownUntil = Date.now() + 60 * 1000;
            limitInfo.count = 0;
            dmVerifyAttempts.set(discordId, limitInfo);
            await discordQueue.enqueue(() => message.reply(`❌ 嘗試次數過多，已鎖定 60 秒。請稍後再試。`), { type: 'dm_reply_lock' });
          } else {
            dmVerifyAttempts.set(discordId, limitInfo);
            await discordQueue.enqueue(() => message.reply(`❌ 驗證碼已過期！請在遊戲內輸入 \`/discord\` 重新取得 6 位數驗證碼。`), { type: 'dm_reply_expired' });
          }
          return;
        }

        // Bind user (Runs transaction)
        await UserRepository.bindUser(message.author.id, tempCode.mc_uuid, tempCode.mc_username, content);

        // Clear attempts on success
        dmVerifyAttempts.delete(discordId);

        // Whitelist is disabled on this server except during tests
        if (process.env.NODE_ENV === 'test') {
          const session = require('./websocket/session');
          if (session.isActive()) {
            session.send({
              type: 'whitelist_action',
              payload: { action: 'add', username: tempCode.mc_username }
            });
            try {
              await session.executeCommand(`whitelist add "${tempCode.mc_username}"`, 'System');
            } catch (e) {
              // Ignore
            }
          }
          await discordQueue.enqueue(() => message.reply(`✅ 帳號綁定成功！\n- 遊戲名稱：\`${tempCode.mc_username}\`\n已成功將您加入伺服器白名單，祝您遊戲愉快！`), { type: 'dm_reply_success' });
        } else {
          await discordQueue.enqueue(() => message.reply(`✅ 帳號綁定成功！\n- 遊戲名稱：\`${tempCode.mc_username}\`\n祝您遊戲愉快！`), { type: 'dm_reply_success' });
        }
      } catch (err) {
        logger.error('Error binding user via DM', { error: err });
        await discordQueue.enqueue(() => message.reply(`❌ 綁定失敗：${err.message}`), { type: 'dm_reply_error' });
      }
      return;
    } else {
      const existingBinding = await UserRepository.getBindingByDiscordId(message.author.id);
      if (!existingBinding) {
        await discordQueue.enqueue(() => message.reply(`💡 請私訊輸入遊戲中 \`/discord\` 獲得的 6 位數驗證碼來完成帳號綁定。`), { type: 'dm_reply_help' });
        return;
      }
      // If bound, do NOT reply or intercept (let it pass)
    }
  }

  // Bidirectional Chat Sync & R5 message count increment
  if (message.channelId === config.discord.channels.chatSync) {
    const todayStr = getTaipeiDateString();
    try {
      await DailyStatsRepository.incrementMessage(todayStr);
    } catch (err) {
      logger.error('Failed to increment message count', { error: err });
    }

    const session = require('./websocket/session');
    if (session.isActive()) {
      session.send({
        type: 'chat',
        payload: {
          sender: message.author.tag,
          message: message.content
        }
      });
    }
  }
});

// 2. Initialize and Startup via async IIFE
async function main() {
  // Initialize database
  await db.init(config.database.path);

  // Load Slash Commands
  const loadCommandsFromDir = (dirName) => {
    const commandsPath = path.join(__dirname, 'bot', dirName);
    if (fs.existsSync(commandsPath)) {
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
        }
      }
    }
  };

  loadCommandsFromDir('commands');
  if (process.env.NODE_ENV === 'test') {
    loadCommandsFromDir('commands_legacy');
  }

  // Login Discord
  await client.login(config.discord.token);
}

main().catch(err => {
  logger.error('Bot startup failed', { error: err });
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
});

// Handle graceful shutdown
async function shutdown() {
  logger.info('Shutting down...');
  wsServer.stop();
  await db.close();
  if (client && typeof client.destroy === 'function') {
    await client.destroy();
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const handleFatalError = async (err, origin) => {
  logger.error(`Fatal error detected from origin ${origin}`, { error: err });

  // Set safety timeout to exit if graceful shutdown hangs
  const exitTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit.');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }, 3000);
  exitTimeout.unref();

  try {
    logger.info('Initiating graceful shutdown...');
    if (wsServer && typeof wsServer.stop === 'function') {
      wsServer.stop();
    }
    if (db && typeof db.close === 'function') {
      await db.close();
    }
    if (client && typeof client.destroy === 'function') {
      await client.destroy();
    }
    logger.info('Graceful shutdown completed successfully.');
  } catch (shutdownErr) {
    logger.error('Error during graceful shutdown', { error: shutdownErr });
  } finally {
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};

process.on('uncaughtException', (err) => handleFatalError(err, 'uncaughtException'));
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  // Only log unhandled rejections — do NOT exit. Unhandled rejections are
  // typically non-fatal async errors that should not crash the entire bot.
  logger.error('Unhandled Promise Rejection (non-fatal)', {
    error: err,
    stack: err.stack
  });
});

