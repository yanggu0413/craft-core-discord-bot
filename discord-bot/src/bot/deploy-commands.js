const { REST, Routes } = require('discord.js');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const commands = [];

const loadCommandsFromDir = (dirName) => {
  const commandsPath = path.join(__dirname, dirName);
  if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
      } else {
        logger.warn(`The command at ${filePath} is missing "data" or "execute" properties`);
      }
    }
  }
};

loadCommandsFromDir('commands');
if (process.env.NODE_ENV === 'test') {
  loadCommandsFromDir('commands_legacy');
}

const rest = new REST().setToken(config.discord.token);

(async () => {
  try {
    logger.info(`Started registering ${commands.length} application (/) guild commands`);

    const data = await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commands },
    );

    logger.info(`Successfully registered ${data.length} application (/) guild commands`);
  } catch (error) {
    logger.error('Error during command deployment', { error });
  }
})();
