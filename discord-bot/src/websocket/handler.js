const { TempCodeRepository, UserRepository } = require('../database/repositories');
const config = require('../config');
const session = require('./session');
const logger = require('../utils/logger');

function getTaipeiDateString(date = new Date()) {
  const options = { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

function getTaipeiYesterdayDateString(date = new Date()) {
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getTaipeiDateString(yesterday);
}

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
          message: `§b[Craft-Core] §f申請成功！請在 5 分鐘內私訊 [機器人] 開心的機器人 傳送驗證碼：§a${code}§f 以完成帳號綁定。`
        }
      });
      break;

    case 'checkin_request': {
      const { username, uuid } = payload;
      let binding = await UserRepository.getBindingByMcUuid(uuid);
      if (!binding) {
        binding = await UserRepository.getBindingByMcUsername(username);
      }
      if (!binding) {
        session.send({
          type: 'checkin_response',
          payload: {
            username,
            success: false,
            message: '§c[Craft-Core] 您尚未綁定 Discord 帳號！請先在遊戲內輸入 /discord link 取得驗證碼，並於 Discord 完成綁定。'
          }
        });
        break;
      }
      const discordId = binding.discord_id;
      const todayStr = getTaipeiDateString();
      const yesterdayStr = getTaipeiYesterdayDateString();

      const userKeys = await UserRepository.getUserKeys(discordId);
      if (userKeys && userKeys.last_checkin === todayStr) {
        session.send({
          type: 'checkin_response',
          payload: {
            username,
            success: false,
            message: '§c[Craft-Core] 金額不足或重複簽到！您今天已經簽到過囉！'
          }
        });
        break;
      }

      const checkinStreak = (userKeys && userKeys.checkin_streak) || 0;
      let newStreak = (userKeys && userKeys.last_checkin === yesterdayStr) ? (checkinStreak + 1) : 1;
      let keysAwarded = 1;
      if (newStreak === 7) {
        keysAwarded = 3;
      } else if (newStreak > 7) {
        newStreak = 1;
        keysAwarded = 1;
      }

      await UserRepository.setCheckinWithStreak(discordId, todayStr, newStreak, keysAwarded);
      const updatedKeysObj = await UserRepository.getUserKeys(discordId);
      const keysCount = updatedKeysObj ? updatedKeysObj.keys_count : 0;

      const items = ['minecraft:cookie', 'minecraft:apple', 'minecraft:bread', 'minecraft:iron_ingot', 'minecraft:coal'];
      const randomItem = items[Math.floor(Math.random() * items.length)];

      session.send({
        type: 'checkin_response',
        payload: {
          username,
          success: true,
          item: randomItem,
          amount: 1,
          keysAwarded,
          streak: newStreak,
          keysCount,
          message: `§b[Craft-Core] §a簽到成功！獲得 $150 元與額外道具。`
        }
      });
      break;
    }

    case 'luckydraw_request': {
      const { username, uuid } = payload;
      let binding = await UserRepository.getBindingByMcUuid(uuid);
      if (!binding) {
        binding = await UserRepository.getBindingByMcUsername(username);
      }
      if (!binding) {
        session.send({
          type: 'luckydraw_response',
          payload: {
            username,
            success: false,
            message: '§c[Craft-Core] 您尚未綁定 Discord 帳號！請先在遊戲內輸入 /discord link 取得驗證碼，並於 Discord 完成綁定。'
          }
        });
        break;
      }
      const discordId = binding.discord_id;
      const userKeys = await UserRepository.getUserKeys(discordId);
      if (!userKeys || (userKeys.keys_count || 0) < 1) {
        session.send({
          type: 'luckydraw_response',
          payload: {
            username,
            success: false,
            message: '§c[Craft-Core] 鑰匙不足！您目前擁有 0 把鑰匙。'
          }
        });
        break;
      }

      await UserRepository.updateKeys(discordId, userKeys.keys_count - 1);

      const drawPool = [
        { id: 'minecraft:diamond', amount: 5 },
        { id: 'minecraft:golden_carrot', amount: 5 },
        { id: 'minecraft:golden_apple', amount: 5 },
        { id: 'minecraft:experience_bottle', amount: 64 },
        { id: 'minecraft:totem_of_undying', amount: 1 }
      ];
      const prize = drawPool[Math.floor(Math.random() * drawPool.length)];

      session.send({
        type: 'luckydraw_response',
        payload: {
          username,
          success: true,
          item: prize.id,
          amount: prize.amount,
          keysLeft: userKeys.keys_count - 1,
          keysCount: userKeys.keys_count - 1,
          message: `§b[Craft-Core] §a幸運大抽獎成功！`
        }
      });
      break;
    }

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

    case 'daily_tasks_response':
      session.resolveRequest(payload.query_id, payload);
      break;

    case 'warps_response':
    case 'warp_upsert_response':
      session.resolveRequest(payload.query_id, payload);
      break;

    case 'warps_changed': {
      try {
        const warpAuditService = require('../services/warpAuditService');
        await warpAuditService.updateWarpPanel(discordClient);
      } catch (error) {
        logger.error('Failed to refresh the Warp panel', { error });
      }
      break;
    }

    case 'join_query': {
      const { username, uuid } = payload;
      try {
        const UserRepository = require('../database/repositories/UserRepository');
        const OfflineMailRepository = require('../database/repositories/OfflineMailRepository');
        const binding = await UserRepository.getBindingByMcUsername(username);
        let hasCheckedIn = false;
        let keysCount = 0;
        if (binding) {
          const userKeys = await UserRepository.getUserKeys(binding.discord_id);
          if (userKeys) {
            keysCount = userKeys.keys_count || 0;
            const dateOptions = { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' };
            const formatter = new Intl.DateTimeFormat('zh-TW', dateOptions);
            const formatted = formatter.format(new Date());
            const taipeiDateStr = formatted.replace(/\//g, '-');
            hasCheckedIn = (userKeys.last_checkin === taipeiDateStr);
          }
        }
        const pendingMails = await OfflineMailRepository.getPendingMails(username);
        const pendingMailCount = pendingMails ? pendingMails.length : 0;
        session.send({
          type: 'join_response',
          payload: {
            username,
            hasCheckedIn,
            pendingMailCount,
            keysCount
          }
        });
      } catch (err) {
        logger.error('Error handling join_query', { username, error: err });
        session.send({
          type: 'join_response',
          payload: {
            username,
            hasCheckedIn: false,
            pendingMailCount: 0,
            keysCount: 0
          }
        });
      }
      break;
    }

    case 'publish_announcement': {
      const { query_id, title, content, scope, impact } = payload;
      try {
        const announcementService = require('../services/announcementService');
        await announcementService.publishAnnouncementDirectly(discordClient, title, content, scope, impact);
        session.send({
          type: 'publish_announcement_response',
          payload: {
            query_id,
            success: true,
            message: '公告發布成功'
          }
        });
      } catch (err) {
        session.send({
          type: 'publish_announcement_response',
          payload: {
            query_id,
            success: false,
            message: err.message
          }
        });
      }
      break;
    }

    case 'member_roles_query': {
      const { query_id, discord_id } = payload;
      try {
        const guild = await discordClient.guilds.fetch(config.discord.guildId);
        const member = await guild.members.fetch(discord_id);
        const roles = Array.from(member.roles.cache.keys());
        session.send({
          type: 'member_roles_response',
          payload: {
            query_id,
            success: true,
            roles
          }
        });
      } catch (err) {
        session.send({
          type: 'member_roles_response',
          payload: {
            query_id,
            success: false,
            roles: [],
            message: err.message
          }
        });
      }
      break;
    }

    default:
      logger.warn(`Unknown packet type: ${type}`);
  }
}

module.exports = {
  handle
};
