const ticketService = require('../../services/ticketService');
const keyService = require('../../services/keyService');
const expressService = require('../../services/expressService');
const adminService = require('../../services/adminService');
const announcementService = require('../../services/announcementService');
const economyService = require('../../services/economyService');
const { AppError } = require('../../utils/AppError');
const logger = require('../../utils/logger');

async function buttonHandler(interaction) {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;

  try {
    // 1. Support Tickets
    if (customId === 'create_ticket') {
      await ticketService.handleCreateTicket(interaction);
    } else if (customId === 'close_ticket') {
      await ticketService.handleCloseTicket(interaction);
    }
    
    // 2. Key Panel (R1)
    else if (customId === 'key_panel_checkin') {
      await keyService.handleCheckin(interaction);
    } else if (customId === 'key_panel_lottery') {
      await keyService.handleLottery(interaction, 1);
    } else if (customId === 'key_panel_lottery_10') {
      await keyService.handleLottery(interaction, 10);
    } else if (customId === 'key_panel_lottery_all') {
      await keyService.handleLottery(interaction, 'all');
    } else if (customId === 'key_panel_query') {
      await keyService.handleQueryKeys(interaction);
    } else if (customId === 'key_panel_leaderboard') {
      await keyService.handleLeaderboard(interaction);
    } else if (customId === 'key_panel_subscribe') {
      await keyService.handleSubscribeReminder(interaction);
    } else if (customId === 'key_panel_exchange') {
      await keyService.handlePlaytimeExchange(interaction);
    }
    
    // 3. Interaction Panel (R3)
    else if (customId === 'interaction_panel_express') {
      await expressService.handleInitiateExpress(interaction);
    } else if (customId === 'interaction_panel_send_money') {
      await economyService.handleInitiateSendMoney(interaction);
    } else if (customId === 'interaction_panel_query_inbox') {
      await expressService.handleQueryInbox(interaction);
    }

    // 7. Economy Panel
    else if (customId === 'economy_query_balance') {
      await economyService.handleQueryBalanceButton(interaction);
    } else if (customId === 'economy_my_shop_stats') {
      await economyService.handleQueryShopStatsButton(interaction);
    } else if (customId === 'economy_rich_list') {
      await economyService.handleQueryRichListButton(interaction);
    }
    
    // 4. Admin Panel Modals Trigger (R2)
    else if (customId === 'admin_ban') {
      await adminService.showBanModal(interaction);
    } else if (customId === 'admin_kick') {
      await adminService.showKickModal(interaction);
    } else if (customId === 'admin_co_brand') {
      await adminService.showCoBrandModal(interaction);
    } else if (customId === 'admin_search_player') {
      await adminService.showSearchModal(interaction);
    } else if (customId === 'admin_draft_announcement') {
      await announcementService.showAnnouncementModal(interaction);
    }
    
    // 5. Inspect Inventory Button (R2)
    else if (customId.startsWith('admin_inspect_inv:') || customId.startsWith('admin_search_inv_btn:')) {
      await adminService.handleInspectInventory(interaction);
    }
    
    // 6. Announcement Draft Actions (R4)
    else if (customId === 'announce_publish') {
      await announcementService.handlePublishDraft(interaction);
    } else if (customId === 'announce_discard') {
      await announcementService.handleDiscardDraft(interaction);
    }

    // 8. Warp Audit Buttons
    else if (customId === 'btn_submit_warp_audit') {
      const warpAuditService = require('../../services/warpAuditService');
      await warpAuditService.showSubmitWarpModal(interaction);
    } else if (customId.startsWith('btn_warp_approve:')) {
      const warpAuditService = require('../../services/warpAuditService');
      const submissionId = customId.split(':')[1];
      await warpAuditService.handleWarpApproveButton(interaction, submissionId);
    } else if (customId.startsWith('btn_warp_reject:')) {
      const warpAuditService = require('../../services/warpAuditService');
      const submissionId = customId.split(':')[1];
      await warpAuditService.handleWarpRejectButton(interaction, submissionId);
    }

    // 9. AI Memory, Ping Settings & Persona Deletion Buttons
    else if (customId === 'clear_user_memory') {
      const aiService = require('../../services/aiService');
      aiService.clearConversationHistory(interaction.channelId);
      await interaction.reply({
        content: '🧹 已成功一鍵清空當前頻道的對話記憶歷史！',
        ephemeral: true
      });
    } else if (customId === 'toggle_user_memory') {
      const db = require('../../database');
      const settings = await db.getUserAiSettings(interaction.user.id);
      const newMem = settings.memory_enabled !== 0 ? 0 : 1;
      await db.setUserAiSettings(interaction.user.id, { memory_enabled: newMem });
      await interaction.reply({
        content: `🧠 對話記憶狀態已切換為：**${newMem === 1 ? '🟢 已開啟 (保留連續對話)' : '🔴 已關閉 (單次獨立答覆)'}**`,
        ephemeral: true
      });
    } else if (customId === 'toggle_user_ping') {
      const db = require('../../database');
      const settings = await db.getUserAiSettings(interaction.user.id);
      const newPing = settings.ping_user !== 0 ? 0 : 1;
      await db.setUserAiSettings(interaction.user.id, { ping_user: newPing });
      await interaction.reply({
        content: `🔔 回覆 Tag 標記狀態已切換為：**${newPing === 1 ? '🟢 已開啟 (回覆時 Ping 提醒你)' : '🔴 已關閉 (靜音回覆，不 Ping 提醒)'}**`,
        ephemeral: true
      });
    } else if (customId.startsWith('delete_custom_persona:')) {
      const slotIndex = parseInt(customId.split(':')[1], 10) || 1;
      const db = require('../../database');
      await db.deleteUserCustomPersona(interaction.user.id, slotIndex);
      await interaction.reply({
        content: `🗑️ 已成功刪除自訂人設槽位 **${slotIndex}**！如果原本正在使用該自訂人設，系統已將人設重置為預設雲喵模式。`,
        ephemeral: true
      });
    }
  } catch (error) {
    if (error instanceof AppError && error.isOperational) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: error.message, ephemeral: true });
      } else {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
    } else {
      logger.error('Error handling button interaction', { error, customId });
      const msg = '處理按鈕操作時發生錯誤！';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  }
}

module.exports = buttonHandler;
