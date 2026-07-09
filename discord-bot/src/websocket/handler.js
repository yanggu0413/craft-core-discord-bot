const db = require('../database');
const config = require('../config');
const session = require('./session');

async function handle(packet, discordClient) {
  const { type, payload } = packet;

  // Lazy load services to avoid cyclic dependencies
  const ticketService = require('../services/ticketService');
  const statusService = require('../services/statusService');
  const webhookService = require('../services/webhookService');

  switch (type) {
    case 'chat':
      await webhookService.sendChat(payload.sender, payload.uuid, payload.message, discordClient);
      break;

    case 'event':
      await webhookService.sendEvent(payload.event_type, payload.username, payload.uuid, payload.details, discordClient);
      break;

    case 'status':
      await statusService.updateStatus(payload, discordClient);
      break;

    case 'bind_code_request':
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      db.createTempCode(payload.uuid, payload.username, code);
      session.send({
        type: 'bind_code_response',
        payload: {
          username: payload.username,
          code: code,
          success: true,
          message: `Please type /綁定 ${code} in Discord within 5 minutes.`
        }
      });
      break;

    case 'whitelist_response':
      console.log(`Whitelist action response: ${payload.username} - ${payload.action} - ${payload.success}`);
      break;

    case 'command_response':
      session.resolveCommand(payload.command_id, payload.success, payload.output);
      break;

    default:
      console.warn(`Unknown packet type: ${type}`);
  }
}

module.exports = {
  handle
};
