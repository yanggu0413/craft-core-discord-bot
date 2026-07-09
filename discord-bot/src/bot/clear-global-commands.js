const { REST, Routes } = require('discord.js');
const config = require('../config');

if (!config.discord.token || !config.discord.clientId) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in configuration.');
  process.exit(1);
}

const rest = new REST().setToken(config.discord.token);

(async () => {
  try {
    console.log('Started clearing all global application (/) commands...');

    // Overwrite global commands with an empty array to remove them
    await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: [] }
    );

    console.log('Successfully cleared all global application (/) commands from Discord cache!');
    console.log('Note: It may take up to 1 hour for Discord to fully propagate the deletion to your client.');
  } catch (error) {
    console.error('Error clearing global commands:', error);
  }
})();
