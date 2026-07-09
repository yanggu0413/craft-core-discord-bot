const { compose } = require('../src/bot/middleware/pipeline');
const errorHandler = require('../src/bot/middleware/errorHandler');
const auditLogger = require('../src/bot/middleware/auditLogger');
const permissionCheck = require('../src/bot/middleware/permissionCheck');
const cooldown = require('../src/bot/middleware/cooldown');
const { AppError, ValidationError, PermissionError, RateLimitError } = require('../src/utils/AppError');
const logger = require('../src/utils/logger');
const config = require('../src/config');
const { PermissionFlagsBits } = require('discord.js');

// Mock logger to avoid pollution and verify logging assertions
const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
const loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

describe('MS2 Pipeline and Middleware Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.discord.adminRoleIds = ['12345'];
  });

  describe('1. Middleware Pipeline Composer', () => {
    test('composes and runs middlewares in order', async () => {
      const order = [];
      const m1 = async (interaction, command, next) => {
        order.push(1);
        await next();
        order.push(6);
      };
      const m2 = async (interaction, command, next) => {
        order.push(2);
        await next();
        order.push(5);
      };
      const m3 = async (interaction, command, next) => {
        order.push(3);
        await next();
        order.push(4);
      };

      const pipeline = compose([m1, m2, m3]);
      const mockInteraction = {};
      const mockCommand = {};
      
      await pipeline(mockInteraction, mockCommand, async () => {
        order.push('terminal');
      });

      expect(order).toEqual([1, 2, 3, 'terminal', 4, 5, 6]);
    });

    test('throws if next() is called multiple times', async () => {
      const m1 = async (interaction, command, next) => {
        await next();
        await next();
      };
      const pipeline = compose([m1]);
      await expect(pipeline({}, {}, async () => {})).rejects.toThrow('next() called multiple times');
    });

    test('throws if middleware stack is not an array', () => {
      expect(() => compose(null)).toThrow(TypeError);
    });

    test('throws if middleware stack elements are not functions', () => {
      expect(() => compose([async () => {}, 'not a function'])).toThrow(TypeError);
    });
  });

  describe('2. Centralized Error Handler Middleware', () => {
    test('handles operational AppError and replies to user', async () => {
      const mockInteraction = {
        deferred: false,
        replied: false,
        reply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({})
      };

      const next = jest.fn().mockRejectedValue(new ValidationError('Invalid user input'));
      await errorHandler(mockInteraction, {}, next);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Invalid user input',
        ephemeral: true
      });
      expect(mockInteraction.editReply).not.toHaveBeenCalled();
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    test('handles operational AppError with editReply if deferred', async () => {
      const mockInteraction = {
        deferred: true,
        replied: false,
        reply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({})
      };

      const next = jest.fn().mockRejectedValue(new ValidationError('Deferred error'));
      await errorHandler(mockInteraction, {}, next);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: 'Deferred error',
        ephemeral: true
      });
      expect(mockInteraction.reply).not.toHaveBeenCalled();
    });

    test('handles programmer error, logs it, and replies with generic message', async () => {
      const mockInteraction = {
        deferred: false,
        replied: false,
        reply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({})
      };

      const rawError = new Error('Database connection failed');
      const next = jest.fn().mockRejectedValue(rawError);
      await errorHandler(mockInteraction, {}, next);

      expect(loggerErrorSpy).toHaveBeenCalledWith('Error executing command', { error: rawError });
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '執行指令時發生錯誤！',
        ephemeral: true
      });
    });
  });

  describe('3. Audit Logger Middleware', () => {
    test('logs starts and success of command execution', async () => {
      const mockInteraction = {
        commandName: 'hello',
        user: { tag: 'TestUser#1234', id: '99999' },
        guildId: '88888',
        channelId: '77777',
        options: { data: [{ name: 'arg', value: 'val' }] }
      };
      const mockCommand = { data: { name: 'hello' } };
      const next = jest.fn().mockResolvedValue({});

      await auditLogger(mockInteraction, mockCommand, next);

      expect(loggerInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Command "hello" execution started by TestUser#1234'),
        expect.objectContaining({ commandName: 'hello', userId: '99999' })
      );
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Command "hello" executed successfully by TestUser#1234'),
        expect.objectContaining({ commandName: 'hello', userId: '99999' })
      );
    });

    test('logs warn on execution failure', async () => {
      const mockInteraction = {
        commandName: 'hello',
        user: { tag: 'TestUser#1234', id: '99999' },
        guildId: '88888',
        channelId: '77777',
        options: { data: [] }
      };
      const mockCommand = { data: { name: 'hello' } };
      const testError = new Error('execution fail');
      const next = jest.fn().mockRejectedValue(testError);

      await expect(auditLogger(mockInteraction, mockCommand, next)).rejects.toThrow(testError);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Command "hello" failed for TestUser#1234'),
        expect.objectContaining({ commandName: 'hello', userId: '99999' })
      );
    });
  });

  describe('4. Permission Check Middleware', () => {
    test('allows non-admin commands immediately', async () => {
      const mockCommand = { adminOnly: false, data: {} };
      const next = jest.fn().mockResolvedValue({});
      await permissionCheck({}, mockCommand, next);
      expect(next).toHaveBeenCalled();
    });

    test('throws if admin command run outside guild (no member)', async () => {
      const mockCommand = { adminOnly: true, data: {} };
      const mockInteraction = { member: null };
      await expect(permissionCheck(mockInteraction, mockCommand, jest.fn())).rejects.toThrow(
        new PermissionError('此指令只能在伺服器頻道中使用。')
      );
    });

    test('allows admin command if member has Administrator permission', async () => {
      const mockCommand = { adminOnly: true, data: {} };
      const mockInteraction = {
        member: {
          permissions: {
            has: jest.fn().mockImplementation((flag) => flag === PermissionFlagsBits.Administrator)
          },
          roles: { cache: new Map() }
        }
      };
      const next = jest.fn().mockResolvedValue({});
      await permissionCheck(mockInteraction, mockCommand, next);
      expect(next).toHaveBeenCalled();
    });

    test('allows admin command if member has whitelisted admin role', async () => {
      const mockCommand = { adminOnly: true, data: {} };
      const mockInteraction = {
        member: {
          permissions: { has: jest.fn().mockReturnValue(false) },
          roles: {
            cache: new Map([['12345', { id: '12345' }]])
          }
        }
      };
      const next = jest.fn().mockResolvedValue({});
      await permissionCheck(mockInteraction, mockCommand, next);
      expect(next).toHaveBeenCalled();
    });

    test('throws PermissionError if member is neither administrator nor in admin roles', async () => {
      const mockCommand = { adminOnly: true, data: {} };
      const mockInteraction = {
        member: {
          permissions: { has: jest.fn().mockReturnValue(false) },
          roles: {
            cache: new Map([['67890', { id: '67890' }]])
          }
        }
      };
      await expect(permissionCheck(mockInteraction, mockCommand, jest.fn())).rejects.toThrow(
        new PermissionError('您無權限執行此指令。')
      );
    });
  });

  describe('5. Cooldown / Rate Limiting Middleware', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    test('allows execution if no cooldown specified', async () => {
      const mockCommand = { cooldown: 0, data: { name: 'ping' } };
      const mockInteraction = { user: { id: 'user_no_cooldown' }, member: null };
      const next = jest.fn().mockResolvedValue({});
      await cooldown(mockInteraction, mockCommand, next);
      expect(next).toHaveBeenCalled();
    });

    test('allows first execution and blocks second within cooldown', async () => {
      const mockCommand = { cooldown: 5, data: { name: 'ping' } };
      const mockInteraction = { user: { id: 'user_cooldown_block' }, member: null };
      const next1 = jest.fn().mockResolvedValue({});
      const next2 = jest.fn().mockResolvedValue({});

      // First run succeeds
      await cooldown(mockInteraction, mockCommand, next1);
      expect(next1).toHaveBeenCalled();

      // Second run within 5 seconds fails
      await expect(cooldown(mockInteraction, mockCommand, next2)).rejects.toThrow(RateLimitError);
      expect(next2).not.toHaveBeenCalled();
    });

    test('allows execution after cooldown duration expires', async () => {
      const mockCommand = { cooldown: 5, data: { name: 'ping_expire' } };
      const mockInteraction = { user: { id: 'user_cooldown_expire' }, member: null };
      const next1 = jest.fn().mockResolvedValue({});
      const next2 = jest.fn().mockResolvedValue({});

      await cooldown(mockInteraction, mockCommand, next1);

      // Fast forward time by 6 seconds
      jest.advanceTimersByTime(6000);

      await cooldown(mockInteraction, mockCommand, next2);
      expect(next2).toHaveBeenCalled();
    });

    test('exempts administrators from cooldowns', async () => {
      const mockCommand = { cooldown: 5, data: { name: 'ping_admin' } };
      const mockInteraction = {
        user: { id: 'user_admin' },
        member: {
          permissions: {
            has: jest.fn().mockImplementation((flag) => flag === PermissionFlagsBits.Administrator)
          },
          roles: { cache: new Map() }
        }
      };
      const next1 = jest.fn().mockResolvedValue({});
      const next2 = jest.fn().mockResolvedValue({});

      await cooldown(mockInteraction, mockCommand, next1);
      await cooldown(mockInteraction, mockCommand, next2);

      expect(next1).toHaveBeenCalled();
      expect(next2).toHaveBeenCalled();
    });
  });
});
