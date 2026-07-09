const path = require('path');
const fs = require('fs');
const client = require('./bot/client');
const config = require('./config');
const db = require('./database');
const wsServer = require('./websocket/server');

// 1. Initialize database
db.init(config.database.path);

// 2. Load Slash Commands
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

// 3. Register Event Handlers
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  // Start WebSocket server
  wsServer.start(client);
});

// interactionCreate router
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '執行指令時發生錯誤！', ephemeral: true });
      } else {
        await interaction.reply({ content: '執行指令時發生錯誤！', ephemeral: true });
      }
    }
  } else if (interaction.isButton()) {
    const ticketService = require('./services/ticketService');
    if (interaction.customId === 'create_ticket') {
      await ticketService.handleCreateTicket(interaction);
    } else if (interaction.customId === 'close_ticket') {
      await ticketService.handleCloseTicket(interaction);
    }
  }
});

// guildMemberRemove router
client.on('guildMemberRemove', async (member) => {
  const discordId = member.user.id;
  const binding = db.getBindingByDiscordId(discordId);
  if (binding) {
    try {
      db.removeBindingByDiscordId(discordId);
      const session = require('./websocket/session');
      if (session.isActive()) {
        session.send({
          type: 'whitelist_action',
          payload: { action: 'remove', username: binding.mc_username }
        });
      }
    } catch (error) {
      console.error('Error handling guildMemberRemove:', error);
    }
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

// Login Discord
client.login(config.discord.token).catch(err => {
  console.error('Discord login failed:', err);
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
});

// Handle graceful shutdown
function shutdown() {
  console.log('Shutting down...');
  wsServer.stop();
  db.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
