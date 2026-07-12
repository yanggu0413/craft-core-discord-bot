const path = require('path');
const fs = require('fs');
const { DatabaseSync: Database } = require('node:sqlite');
const db = require('../src/database/index');
const UserRepository = require('../src/database/repositories/UserRepository');
const OfflineMailRepository = require('../src/database/repositories/OfflineMailRepository');
const economyService = require('../src/services/economyService');
const expressService = require('../src/services/expressService');
const session = require('../src/websocket/session');

const TEST_DB = path.resolve(__dirname, './db_economy_adversarial_test.db');
const SCHEMA_FILE = path.resolve(__dirname, '../src/database/schema.sql');

// Mock session modules
jest.mock('../src/websocket/session', () => {
  return {
    isActive: jest.fn().mockReturnValue(true),
    executeCommand: jest.fn(),
    queryBalance: jest.fn()
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

describe('Adversarial Testing on Economy & Shops Features', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Clean database tables
    const sqlite = new Database(TEST_DB);
    sqlite.exec('DELETE FROM bindings');
    sqlite.exec('DELETE FROM offline_mails');
    sqlite.close();
  });

  test('Input validation blocks negative, decimal, or overflow numbers', async () => {
    await UserRepository.addBinding('sender-discord-id', 'uuid-sender', 'SenderUser');

    const invalidInputs = ['-100', '0', '10.5', 'abc', 'NaN', 'Infinity', '1e5'];

    for (const invalidAmount of invalidInputs) {
      const mockInteraction = {
        fields: {
          getTextInputValue: (id) => {
            if (id === 'receiver_mc') return 'ReceiverPlayer';
            if (id === 'amount') return invalidAmount;
            return '';
          }
        },
        user: { id: 'sender-discord-id' },
        reply: jest.fn().mockImplementation((opts) => {
          console.log('REPLY CALLED WITH:', opts);
          return Promise.resolve();
        }),
        deferReply: jest.fn().mockResolvedValue(),
        editReply: jest.fn().mockResolvedValue()
      };

      try {
        await economyService.handleSendMoneyModalSubmit(mockInteraction);
      } catch (err) {
        console.error('CRASHED WITH ERROR:', err);
      }

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(mockInteraction.reply.mock.calls[0][0].content).toContain('請輸入有效的正整數金額');
    }
  });

  test('Command injection prevention with Bedrock usernames containing spaces or quotes', async () => {
    await UserRepository.addBinding('sender-discord-id', 'uuid-sender', 'SenderUser');

    // Mock queryBalance and removemoney response
    session.queryBalance.mockResolvedValue({ success: true, balance: 1000 });
    session.executeCommand.mockResolvedValue({ success: true, output: 'Successfully removed' });

    const mockInteraction = {
      fields: {
        getTextInputValue: (id) => {
          if (id === 'receiver_mc') return 'Bedrock Steve';
          if (id === 'amount') return '100';
          return '';
        }
      },
      user: { id: 'sender-discord-id' },
      reply: jest.fn().mockResolvedValue(),
      deferReply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue()
    };

    await economyService.handleSendMoneyModalSubmit(mockInteraction);

    // Verify command parameter enclosing: removemoney "SenderUser" 100
    expect(session.executeCommand).toHaveBeenCalledWith('removemoney "SenderUser" 100', 'System');

    // Verify mail created in DB
    const mails = await OfflineMailRepository.getPendingMails('Bedrock Steve');
    expect(mails.length).toBe(1);
    expect(mails[0].receiver_username).toBe('Bedrock Steve');
  });

  test('Transaction lock blocks concurrent submissions from the same user to prevent double-spending', async () => {
    await UserRepository.addBinding('sender-discord-id', 'uuid-sender', 'SenderUser');

    session.queryBalance.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ success: true, balance: 500 }), 100)));
    session.executeCommand.mockResolvedValue({ success: true, output: 'Done' });

    const interaction1 = {
      fields: { getTextInputValue: (id) => id === 'receiver_mc' ? 'Receiver' : '200' },
      user: { id: 'sender-discord-id' },
      reply: jest.fn().mockResolvedValue(),
      deferReply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue()
    };

    const interaction2 = {
      fields: { getTextInputValue: (id) => id === 'receiver_mc' ? 'Receiver' : '200' },
      user: { id: 'sender-discord-id' },
      reply: jest.fn().mockResolvedValue(),
      deferReply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue()
    };

    // Run first transaction
    const p1 = economyService.handleSendMoneyModalSubmit(interaction1);
    // Run second transaction immediately
    const p2 = economyService.handleSendMoneyModalSubmit(interaction2);

    await Promise.all([p1, p2]);

    // One of them must be rejected with concurrent transaction error
    const repl1 = interaction1.reply.mock.calls[0] ? interaction1.reply.mock.calls[0][0].content : '';
    const repl2 = interaction2.reply.mock.calls[0] ? interaction2.reply.mock.calls[0][0].content : '';

    const eitherLocked = repl1.includes('正在處理中') || repl2.includes('正在處理中');
    expect(eitherLocked).toBe(true);
  });

  test('Database consistency: mail is not created if RCON deduction fails', async () => {
    await UserRepository.addBinding('sender-discord-id', 'uuid-sender', 'SenderUser');

    session.queryBalance.mockResolvedValue({ success: true, balance: 1000 });
    session.executeCommand.mockResolvedValue({ success: false, output: 'Failed to remove money' }); // Command failed

    const mockInteraction = {
      fields: {
        getTextInputValue: (id) => {
          if (id === 'receiver_mc') return 'Receiver';
          if (id === 'amount') return '100';
          return '';
        }
      },
      user: { id: 'sender-discord-id' },
      reply: jest.fn().mockResolvedValue(),
      deferReply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue()
    };

    await economyService.handleSendMoneyModalSubmit(mockInteraction);

    // Expecting error message returned
    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('扣除您的金幣餘額失敗')
    }));

    // Expecting NO mail created in DB
    const mails = await OfflineMailRepository.getPendingMails('Receiver');
    expect(mails.length).toBe(0);
  });
});
