const path = require('path');
const fs = require('fs');
const client = require('./bot/client');
const config = require('./config');
const db = require('./database');
const { UserRepository, TempCodeRepository } = require('./database/repositories');
const wsServer = require('./websocket/server');
const commandHandler = require('./bot/handlers/commandHandler');
const buttonHandler = require('./bot/handlers/buttonHandler');
const modalHandler = require('./bot/handlers/modalHandler');
const logger = require('./utils/logger');

// 1. Register Event Handlers
client.once('ready', async () => {
  logger.info(`Logged in as ${client.user.tag}!`);
  // Start WebSocket server
  wsServer.start(client);

  // Run cleanup immediately on ready
  try {
    await TempCodeRepository.clearExpiredTempCodes();
  } catch (error) {
    logger.error('Failed to run initial temp code cleanup', { error });
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
      const session = require('./websocket/session');
      if (session.isActive()) {
        session.send({
          type: 'whitelist_action',
          payload: { action: 'remove', username: binding.mc_username }
        });
      }
    }
  } catch (error) {
    logger.error('Error handling guildMemberRemove', { error });
  }
});

// messageCreate router for bidirectional chat sync
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channelId === config.discord.channels.chatSync) {
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
  const commandsPath = path.join(__dirname, 'bot/commands');
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
  handleFatalError(err, 'unhandledRejection');
});
