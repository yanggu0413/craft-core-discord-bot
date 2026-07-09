const { REST, Routes } = require('discord.js');
const config = require('../config');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    } else {
      console.warn(`[WARNING] The command at ${filePath} is missing "data" or "execute" properties.`);
    }
  }
}

const rest = new REST().setToken(config.discord.token);

(async () => {
  try {
    console.log(`Started registering ${commands.length} application (/) guild commands.`);

    const data = await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commands },
    );

    console.log(`Successfully registered ${data.length} application (/) guild commands.`);
  } catch (error) {
    console.error('Error during command deployment:', error);
  }
})();
