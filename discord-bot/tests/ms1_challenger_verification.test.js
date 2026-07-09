const client = require('../src/bot/client');
const commandHandler = require('../src/bot/handlers/commandHandler');
const { ValidationError } = require('../src/utils/AppError');
const logger = require('../src/utils/logger');
const db = require('../src/database');
const webhookService = require('../src/services/webhookService');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

// Mock logger.error to verify programmer errors are logged and not pollute the test console
const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

describe('MS1 Correctness Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Command Execution Error Handling', () => {
    test('Operational AppError (ValidationError) sends error message to the user', async () => {
      const mockErrorMsg = 'Validation failed: Invalid username';
      const mockCommand = {
        execute: jest.fn().mockRejectedValue(new ValidationError(mockErrorMsg))
      };
      
      client.commands.set('test-operational', mockCommand);
      
      const mockInteraction = {
        isChatInputCommand: () => true,
        commandName: 'test-operational',
        deferred: false,
        replied: false,
        reply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({})
      };
      
      await commandHandler(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: mockErrorMsg,
        ephemeral: true
      });
      expect(mockInteraction.editReply).not.toHaveBeenCalled();
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    test('Operational AppError (ValidationError) uses editReply if interaction is deferred/replied', async () => {
      const mockErrorMsg = 'Validation failed: Invalid parameter';
      const mockCommand = {
        execute: jest.fn().mockRejectedValue(new ValidationError(mockErrorMsg))
      };
      
      client.commands.set('test-operational-deferred', mockCommand);
      
      const mockInteraction = {
        isChatInputCommand: () => true,
        commandName: 'test-operational-deferred',
        deferred: true,
        replied: false,
        reply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({})
      };
      
      await commandHandler(mockInteraction);
      
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: mockErrorMsg,
        ephemeral: true
      });
      expect(mockInteraction.reply).not.toHaveBeenCalled();
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    test('Programmer error (ReferenceError) logs full error and replies with generic message', async () => {
      const mockError = new ReferenceError('someVariable is not defined');
      const mockCommand = {
        execute: jest.fn().mockRejectedValue(mockError)
      };
      
      client.commands.set('test-programmer', mockCommand);
      
      const mockInteraction = {
        isChatInputCommand: () => true,
        commandName: 'test-programmer',
        deferred: false,
        replied: false,
        reply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({})
      };
      
      await commandHandler(mockInteraction);
      
      // Generic message check
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '執行指令時發生錯誤！',
        ephemeral: true
      });
      expect(mockInteraction.editReply).not.toHaveBeenCalled();
      
      // Logger check
      expect(loggerErrorSpy).toHaveBeenCalledWith('Error executing command', { error: mockError });
    });

    test('Programmer error (ReferenceError) uses editReply if interaction is deferred/replied', async () => {
      const mockError = new ReferenceError('anotherVariable is not defined');
      const mockCommand = {
        execute: jest.fn().mockRejectedValue(mockError)
      };
      
      client.commands.set('test-programmer-deferred', mockCommand);
      
      const mockInteraction = {
        isChatInputCommand: () => true,
        commandName: 'test-programmer-deferred',
        deferred: false,
        replied: true,
        reply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({})
      };
      
      await commandHandler(mockInteraction);
      
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '執行指令時發生錯誤！',
        ephemeral: true
      });
      expect(mockInteraction.reply).not.toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith('Error executing command', { error: mockError });
    });
  });

  describe('2. WebhookService Database Increment Logic', () => {
    const tempDbPath = path.resolve(__dirname, 'temp_test_webhook.db');

    beforeEach(async () => {
      if (fs.existsSync(tempDbPath)) {
        try { fs.unlinkSync(tempDbPath); } catch (e) {}
      }
      await db.init(tempDbPath);
    });

    afterEach(async () => {
      await db.close();
      if (fs.existsSync(tempDbPath)) {
        try { fs.unlinkSync(tempDbPath); } catch (e) {}
      }
    });

    test('Mock death event increments death counter and updates player_stats state in SQLite', async () => {
      // Mock Discord client channel
      const mockChannel = {
        send: jest.fn().mockResolvedValue({})
      };
      const mockDiscordClient = {
        channels: {
          fetch: jest.fn().mockResolvedValue(mockChannel)
        }
      };

      // Set config channel sync
      const config = require('../src/config');
      const originalChatSync = config.discord.channels.chatSync;
      config.discord.channels.chatSync = 'mock-chat-channel-id';

      try {
        const mcUuid = 'test-player-uuid';
        const mcUsername = 'TestGamer';
        const details = 'TestGamer fell from a high place';

        // 1. Trigger the death event
        await webhookService.sendEvent('death', mcUsername, mcUuid, details, mockDiscordClient);

        // 2. Directly connect to SQLite database to verify its state
        const sqliteDb = new DatabaseSync(tempDbPath);
        const row = sqliteDb.prepare('SELECT * FROM player_stats WHERE mc_uuid = ?').get(mcUuid);
        
        expect(row).toBeDefined();
        expect(row.mc_username).toBe(mcUsername);
        expect(row.deaths).toBe(1);

        // 3. Trigger second death event
        await webhookService.sendEvent('death', mcUsername, mcUuid, details, mockDiscordClient);

        // Verify direct state incremented to 2
        const row2 = sqliteDb.prepare('SELECT * FROM player_stats WHERE mc_uuid = ?').get(mcUuid);
        expect(row2.deaths).toBe(2);

        sqliteDb.close();
      } finally {
        config.discord.channels.chatSync = originalChatSync;
      }
    });
  });
});
