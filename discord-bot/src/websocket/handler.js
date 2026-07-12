const { TempCodeRepository } = require('../database/repositories');
const config = require('../config');
const session = require('./session');
const logger = require('../utils/logger');

async function handle(packet, discordClient) {
  const { type, payload } = packet;

  // Forward responses and broadcasts to the Web Dashboard if connected
  const webWs = session.getWebDashboardWs();
  if (webWs && webWs.readyState === 1) {
    if (type.endsWith('_response') || type === 'transaction_log') {
      try {
        webWs.send(JSON.stringify(packet));
      } catch (err) {
        logger.error('Failed to forward packet to Web Dashboard', { type, error: err });
      }
    }
  }

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
      await TempCodeRepository.createTempCode(payload.uuid, payload.username, code);
      session.send({
        type: 'bind_code_response',
        payload: {
          username: payload.username,
          code: code,
          success: true,
          message: `§b[Craft-Core] §f申請成功！請在 5 分鐘內於 Discord 輸入 §a/綁定 ${code}§f 來完成帳號綁定。`
        }
      });
      break;

    case 'whitelist_response':
      logger.info('Whitelist action response', { username: payload.username, action: payload.action, success: payload.success });
      break;

    case 'command_response':
      session.resolveCommand(payload.command_id, payload.success, payload.output);
      break;

    case 'balance_response':
      session.resolveRequest(payload.query_id, payload);
      break;

    case 'shop_stats_response':
      session.resolveRequest(payload.query_id, payload);
      break;

    case 'rich_list_response':
      session.resolveRequest(payload.query_id, payload);
      break;

    default:
      logger.warn(`Unknown packet type: ${type}`);
  }
}

module.exports = {
  handle
};
