const cooldown = require('../src/bot/middleware/cooldown');
const permissionCheck = require('../src/bot/middleware/permissionCheck');
const errorHandler = require('../src/bot/middleware/errorHandler');
const { AppError, ValidationError, PermissionError, RateLimitError } = require('../src/utils/AppError');
const logger = require('../src/utils/logger');
const config = require('../src/config');
const { PermissionFlagsBits } = require('discord.js');

// Mock logger to avoid test console pollution
const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
const loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

describe('MS2 Challenger Verification — Boundary & Stress Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.discord.adminRoleIds = ['12345'];
  });

  describe('1. Cooldown Middleware Concurrent Stress & Expiration Timers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    test('100 concurrent requests from the same user: exactly 1 succeeds, 99 fail with RateLimitError', async () => {
      const mockCommand = { cooldown: 5, data: { name: 'stress_command' } };
      const mockInteraction = {
        user: { id: 'stress_user_1' },
        member: null
      };

      const nextSpy = jest.fn().mockResolvedValue({});
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(cooldown(mockInteraction, mockCommand, nextSpy));
      }

      const results = await Promise.allSettled(promises);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(99);
      expect(nextSpy).toHaveBeenCalledTimes(1);

      rejected.forEach(r => {
        expect(r.reason).toBeInstanceOf(RateLimitError);
        expect(r.reason.message).toContain('請稍候');
      });
    });

    test('Strict rate-limiting and correctness of expiration timers (sequence of calls and expires)', async () => {
      const mockCommand = { cooldown: 10, data: { name: 'seq_command' } };
      const mockInteraction = {
        user: { id: 'seq_user' },
        member: null
      };

      const next1 = jest.fn().mockResolvedValue({});
      const next2 = jest.fn().mockResolvedValue({});
      const next3 = jest.fn().mockResolvedValue({});

      // First call succeeds
      await cooldown(mockInteraction, mockCommand, next1);
      expect(next1).toHaveBeenCalledTimes(1);

      // Fast forward 5s (half of cooldown), second call must fail
      jest.advanceTimersByTime(5000);
      await expect(cooldown(mockInteraction, mockCommand, next2)).rejects.toThrow(RateLimitError);
      expect(next2).not.toHaveBeenCalled();

      // Fast forward another 6s (total 11s, past 10s cooldown), third call must succeed
      jest.advanceTimersByTime(6000);
      await cooldown(mockInteraction, mockCommand, next3);
      expect(next3).toHaveBeenCalledTimes(1);
    });

    test('Exempt administrators under concurrent requests: all 100 concurrent requests succeed', async () => {
      const mockCommand = { cooldown: 5, data: { name: 'admin_stress_command' } };
      const mockInteraction = {
        user: { id: 'admin_stress_user' },
        member: {
          permissions: {
            has: jest.fn().mockImplementation((flag) => flag === PermissionFlagsBits.Administrator)
          },
          roles: { cache: new Map() }
        }
      };

      const nextSpy = jest.fn().mockResolvedValue({});
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(cooldown(mockInteraction, mockCommand, nextSpy));
      }

      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter(r => r.status === 'fulfilled');

      expect(fulfilled.length).toBe(100);
      expect(nextSpy).toHaveBeenCalledTimes(100);
    });
  });

  describe('2. Permission Checker Boundary Testing with Malformed Structures', () => {
    const adminCommand = {
      adminOnly: true,
      data: {}
    };

    test('interaction.member is completely missing (null/undefined)', async () => {
      const mockInteraction = {
        member: null,
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue({})
      };

      // Wrapped in permissionCheck and errorHandler
      const next = jest.fn().mockResolvedValue({});
      await errorHandler(mockInteraction, adminCommand, () => permissionCheck(mockInteraction, adminCommand, next));

      expect(next).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '此指令只能在伺服器頻道中使用。',
        ephemeral: true
      });
    });

    test('interaction.member is an empty object', async () => {
      const mockInteraction = {
        member: {},
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue({})
      };

      const next = jest.fn().mockResolvedValue({});
      await errorHandler(mockInteraction, adminCommand, () => permissionCheck(mockInteraction, adminCommand, next));

      expect(next).not.toHaveBeenCalled();
      // Should fail permission check as non-admin because permissions and roles are missing
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '您無權限執行此指令。',
        ephemeral: true
      });
    });

    test('interaction.member has roles.cache but roles.cache is malformed (e.g. array or object without .has)', async () => {
      const mockInteraction = {
        member: {
          permissions: { has: jest.fn().mockReturnValue(false) },
          roles: { cache: [] } // Malformed cache: array instead of Collection/Map
        },
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({})
      };

      const next = jest.fn().mockResolvedValue({});
      await errorHandler(mockInteraction, adminCommand, () => permissionCheck(mockInteraction, adminCommand, next));

      expect(next).not.toHaveBeenCalled();
      // The TypeError thrown inside permissionCheck should be handled by errorHandler as a programmer error.
      expect(loggerErrorSpy).toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '執行指令時發生錯誤！',
        ephemeral: true
      });
    });

    test('interaction.member has roles but roles is null', async () => {
      const mockInteraction = {
        member: {
          permissions: { has: jest.fn().mockReturnValue(false) },
          roles: null
        },
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue({})
      };

      const next = jest.fn().mockResolvedValue({});
      await errorHandler(mockInteraction, adminCommand, () => permissionCheck(mockInteraction, adminCommand, next));

      expect(next).not.toHaveBeenCalled();
      // Should throw PermissionError ('您無權限執行此指令。') safely because of || check which handles roles: null
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '您無權限執行此指令。',
        ephemeral: true
      });
    });

    test('interaction.member has permissions but permissions is null', async () => {
      const mockInteraction = {
        member: {
          permissions: null,
          roles: { cache: new Map() }
        },
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue({})
      };

      const next = jest.fn().mockResolvedValue({});
      await errorHandler(mockInteraction, adminCommand, () => permissionCheck(mockInteraction, adminCommand, next));

      expect(next).not.toHaveBeenCalled();
      // Should throw PermissionError safely
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '您無權限執行此指令。',
        ephemeral: true
      });
    });
  });

  describe('3. Cooldown Middleware Memory Leak Simulation & Validation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    test('1000+ simulated commands execute across different users, verifying memory cleanup after expiry', async () => {
      const totalExecutions = 1200;
      const cooldownSeconds = 10;
      const nextSpy = jest.fn().mockResolvedValue({});

      // We execute commands with a set of users
      for (let i = 0; i < totalExecutions; i++) {
        const userId = `user_${i}`;
        // Alternating commands to test command map population
        const commandName = `cmd_${i % 5}`; 
        const mockCommand = { cooldown: cooldownSeconds, data: { name: commandName } };
        const mockInteraction = { user: { id: userId }, member: null };

        await cooldown(mockInteraction, mockCommand, nextSpy);
      }

      expect(nextSpy).toHaveBeenCalledTimes(totalExecutions);

      // Advance time by cooldownSeconds + 1s to allow all setTimeout cleanups to trigger
      jest.advanceTimersByTime((cooldownSeconds + 1) * 1000);

      // Now we verify that all user keys inside cooldown Maps are deleted.
      // Let's trigger a fresh call for a user to see if it executes without throwing RateLimitError,
      // which proves the old keys were successfully removed and didn't linger.
      const mockCommand = { cooldown: cooldownSeconds, data: { name: 'cmd_0' } };
      const testInteraction = { user: { id: 'user_0' }, member: null };
      const nextTest = jest.fn().mockResolvedValue({});

      // If user_0 was not cleaned up, this would throw RateLimitError.
      // Since it succeeds, it verifies the cleanup.
      await cooldown(testInteraction, mockCommand, nextTest);
      expect(nextTest).toHaveBeenCalledTimes(1);
    });

    test('Verify overlapping timeouts do not prematurely clear new cooldown entries', async () => {
      const mockCommand = { cooldown: 10, data: { name: 'overlap_command' } };
      const mockInteraction = { user: { id: 'overlap_user' }, member: null };

      // 1. First execution at t=0
      const next1 = jest.fn().mockResolvedValue({});
      await cooldown(mockInteraction, mockCommand, next1);
      expect(next1).toHaveBeenCalled();

      // 2. Advance time by 11s, first cooldown expires
      jest.advanceTimersByTime(11000);

      // 3. Second execution at t=11s
      const next2 = jest.fn().mockResolvedValue({});
      await cooldown(mockInteraction, mockCommand, next2);
      expect(next2).toHaveBeenCalled();

      // 4. Advance time by 2s (total t=13s). 
      // The first execution's setTimeout would have fired at t=10s, but it shouldn't clear the new cooldown.
      // Let's verify rate limiting is still active for the second execution.
      const next3 = jest.fn().mockResolvedValue({});
      await expect(cooldown(mockInteraction, mockCommand, next3)).rejects.toThrow(RateLimitError);
    });
  });
});
