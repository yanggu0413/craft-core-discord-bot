const { REST, Routes } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

if (!config.discord.token || !config.discord.clientId) {
  logger.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in configuration');
  process.exit(1);
}

const rest = new REST().setToken(config.discord.token);

(async () => {
  try {
    logger.info('Started clearing all global application (/) commands');

    // Overwrite global commands with an empty array to remove them
    await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: [] }
    );

    logger.info('Successfully cleared all global application (/) commands from Discord cache');
    logger.info('Note: It may take up to 1 hour for Discord to fully propagate the deletion to your client');
  } catch (error) {
    logger.error('Error clearing global commands', { error });
  }
})();
