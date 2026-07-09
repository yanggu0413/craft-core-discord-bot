const client = require('../client');
const { compose } = require('../middleware/pipeline');
const errorHandler = require('../middleware/errorHandler');
const auditLogger = require('../middleware/auditLogger');
const permissionCheck = require('../middleware/permissionCheck');
const cooldown = require('../middleware/cooldown');

// Compose the middleware pipeline
const pipeline = compose([
  errorHandler,      // Catch and map errors first
  auditLogger,       // Log execution & performance
  permissionCheck,   // Enforce role and permission checks
  cooldown           // Enforce rate limits
]);

/**
 * Handles incoming Discord slash command interactions.
 * Routes command through a middleware pipeline before execution.
 *
 * @param {import('discord.js').Interaction} interaction
 */
async function commandHandler(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  // Execute the pipeline chain with a terminal function that runs the command
  await pipeline(interaction, command, async () => {
    await command.execute(interaction);
  });
}

module.exports = commandHandler;
