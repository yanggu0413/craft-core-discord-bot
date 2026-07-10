const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');

const intentsList = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers
];

if (GatewayIntentBits.DirectMessages) {
  intentsList.push(GatewayIntentBits.DirectMessages);
} else {
  intentsList.push(4096); // Fallback for DirectMessages (1 << 12)
}

const partialsList = [];
if (Partials) {
  if (Partials.Channel) partialsList.push(Partials.Channel);
  if (Partials.Message) partialsList.push(Partials.Message);
  if (Partials.User) partialsList.push(Partials.User);
}

const client = new Client({
  intents: intentsList,
  partials: partialsList
});

// A collection to hold commands dynamically loaded from src/bot/commands/
client.commands = new Collection();

module.exports = client;
