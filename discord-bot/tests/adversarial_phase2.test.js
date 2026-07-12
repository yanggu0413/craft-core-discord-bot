const path = require('path');
const fs = require('fs');
const { DatabaseSync: Database } = require('node:sqlite');
const db = require('../src/database/index');
const UserRepository = require('../src/database/repositories/UserRepository');
const OfflineMailRepository = require('../src/database/repositories/OfflineMailRepository');
const expressService = require('../src/services/expressService');
const announcementService = require('../src/services/announcementService');
const session = require('../src/websocket/session');

const TEST_DB = path.resolve(__dirname, './db_adversarial_test.db');
const SCHEMA_FILE = path.resolve(__dirname, '../src/database/schema.sql');

// Mock session.executeCommand
jest.mock('../src/websocket/session', () => {
  return {
    isActive: jest.fn().mockReturnValue(true),
    executeCommand: jest.fn()
  };
});

beforeAll(async () => {
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }
  const sqliteDb = new Database(TEST_DB);
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  sqliteDb.exec(schema);
  sqliteDb.close();

  await db.init(TEST_DB);
});

afterAll(async () => {
  await db.close();
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }
});

describe('Adversarial Testing on Phase 2 Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Command splitting/injection in offline mail delivery
  test('deliverPendingMails does not double-quote usernames with spaces, causing command splitting', async () => {
    // 1. Create a pending mail for a bedrock player with spaces
    await OfflineMailRepository.createMail(
      'sender-discord-id',
      'SenderPlayer',
      'Bedrock Steve',
      'minecraft:diamond',
      5,
      null
    );

    // 2. Mock executeCommand to return success
    session.executeCommand.mockResolvedValue({ success: true, output: 'Successfully given' });

    // 3. Deliver
    await expressService.deliverPendingMails('Bedrock Steve');

    // Verify what command was sent
    expect(session.executeCommand).toHaveBeenCalled();
    const calledCmd = session.executeCommand.mock.calls[0][0];
    
    expect(calledCmd).toBe('give "Bedrock Steve" minecraft:diamond 5');
  });

  // Test 2: False positive command success (item duplication) in Express Modal Submit
  test('handleExpressModalSubmit allows item duplication if RCON clear command fails with no items found but success=true', async () => {
    // Setup binding for sender
    await UserRepository.addBinding('sender-discord', 'sender-uuid', 'SenderPlayer');

    // RCON mock responses for initiating express
    session.executeCommand.mockImplementation(async (cmd) => {
      if (cmd.includes('playerinfo')) {
        return { success: true, output: 'Online: true' };
      }
      if (cmd.includes('data get entity')) {
        return {
          success: true,
          output: '[{Slot: 0b, id: "minecraft:diamond", count: 10b}]'
        };
      }
      return { success: true, output: '' };
    });

    // Mock interaction to initiate express
    const mockInitiateInteraction = {
      user: { id: 'sender-discord', tag: 'Sender#1234' },
      reply: jest.fn().mockResolvedValue(),
      deferReply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue()
    };

    // 1. Initiate express to build in-memory session
    await expressService.handleInitiateExpress(mockInitiateInteraction);

    // 2. Extract sessionId from components in editReply call
    expect(mockInitiateInteraction.editReply).toHaveBeenCalled();
    const editReplyCall = mockInitiateInteraction.editReply.mock.calls[0][0];
    const selectMenu = editReplyCall.components[0].components[0];
    const selectMenuCustomId = selectMenu.data.custom_id || selectMenu.data.customId;
    const sessionId = selectMenuCustomId.split(':')[1];

    // Mock interactions for submitting modal
    const mockModalInteraction = {
      customId: `express_modal:${sessionId}:0`,
      fields: {
        getTextInputValue: (id) => {
          if (id === 'receiver_mc') return 'ReceiverPlayer';
          if (id === 'quantity') return '5';
          return '';
        }
      },
      user: { id: 'sender-discord', tag: 'Sender#1234' },
      deferReply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue(),
      reply: jest.fn().mockResolvedValue()
    };

    // RCON mock responses for modal submit:
    // 1. data get Inventory returns player has the item
    // 2. clear command returns "No items were found on player SenderPlayer" but success: true
    session.executeCommand.mockImplementation(async (cmd) => {
      if (cmd.includes('data get entity')) {
        return {
          success: true,
          output: '[{Slot: 0b, id: "minecraft:diamond", count: 10b}]'
        };
      }
      if (cmd.includes('clear')) {
        return {
          success: true, // Minecraft RCON/Executor returns success true despite clearing 0 items
          output: 'No items were found on player SenderPlayer'
        };
      }
      return { success: true, output: '' };
    });

    // Submit modal
    await expressService.handleExpressModalSubmit(mockModalInteraction);

    // Verify if mail was created in DB despite item not being cleared (item duplication vulnerability)
    const pendingMails = await OfflineMailRepository.getPendingMails('ReceiverPlayer');
    
    // Expect no mail to be created on clear failure
    expect(pendingMails.length).toBe(0);
    
    // Clean up
    await UserRepository.removeBindingByDiscordId('sender-discord');
  });

  test('handlePublishDraft handles publish error gracefully on channel send failure without crashing', async () => {
    const mockInteraction = {
      member: {
        permissions: { has: () => true },
        roles: { cache: { has: () => true } }
      },
      message: {
        content: '⚠️ **以下為公告草稿預覽，請確認內容無誤後發布：**\n\n# 📢 ｜ 伺服器公告：Test Announcement',
        embeds: [{ title: 'Test Announcement', description: 'Test Description', data: {} }],
        delete: jest.fn().mockResolvedValue()
      },
      client: {
        channels: {
          fetch: jest.fn().mockResolvedValue({
            send: jest.fn().mockRejectedValue(new Error('Discord API Error'))
          })
        }
      },
      deferred: true,
      deferReply: jest.fn().mockResolvedValue(),
      reply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue()
    };

    let errorThrown = null;
    try {
      await announcementService.handlePublishDraft(mockInteraction);
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).toBeNull();
    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('發布公告時發生錯誤')
    }));
    expect(mockInteraction.reply).not.toHaveBeenCalled();
  });

  // Test 4: Key loss in Lucky Draw when in-game command fails
  test('handleLottery deducts key even if the in-game give command fails, causing key loss', async () => {
    const keyService = require('../src/services/keyService');
    
    // Setup binding for user
    await UserRepository.addBinding('lottery-user-discord', 'lottery-user-uuid', 'LotteryPlayer');
    // Set user keys count to 1
    await UserRepository.updateKeys('lottery-user-discord', 1);

    // Mock executeCommand:
    // 1. playerinfo returns online: true
    // 2. give command fails (RCON error or returns success: false)
    session.executeCommand.mockImplementation(async (cmd) => {
      if (cmd.includes('playerinfo')) {
        return { success: true, output: 'Online: true' };
      }
      if (cmd.includes('give')) {
        return { success: false, output: 'Failed to give item' }; // RCON command execution failed
      }
      return { success: true, output: '' };
    });

    const mockInteraction = {
      user: { id: 'lottery-user-discord', username: 'LotteryUser' },
      reply: jest.fn().mockResolvedValue(),
      deferReply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue()
    };

    // Run lottery
    await keyService.handleLottery(mockInteraction);

    // Verify key was deducted
    const keysRow = await UserRepository.getUserKeys('lottery-user-discord');
    expect(keysRow.keys_count).toBe(0); // Key is deducted!

    // Verify it didn't throw an error and replied success to the user
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const replyVal = mockInteraction.editReply.mock.calls[0][0];
    const embed = replyVal.embeds[0];
    const title = embed.data ? embed.data.title : embed.title;
    expect(title).toContain('幸運大抽獎');

    // Clean up
    await UserRepository.removeBindingByDiscordId('lottery-user-discord');
  });
});
