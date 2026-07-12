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
      await keyService.handleLottery(interaction);
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
