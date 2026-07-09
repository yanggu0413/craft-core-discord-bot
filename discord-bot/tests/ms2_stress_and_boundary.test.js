const cooldown = require('../src/bot/middleware/cooldown');
const permissionCheck = require('../src/bot/middleware/permissionCheck');
const config = require('../src/config');
const { PermissionFlagsBits } = require('discord.js');
const { RateLimitError, PermissionError } = require('../src/utils/AppError');

describe('MS2 Challenger Stress and Boundary Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default valid config
    config.discord.adminRoleIds = ['admin-role-id'];
  });

  describe('1. Cooldown Manager Concurrency & Timers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    test('Strict rate-limiting under heavy concurrent requests from same user', async () => {
      const command = { cooldown: 5, data: { name: 'test-cooldown' } };
      const userId = 'user-123';
      const interaction = {
        user: { id: userId },
        member: null,
        commandName: 'test-cooldown'
      };

      const nextFn = jest.fn().mockResolvedValue({});
      const errors = [];
      const successes = [];

      // Send 100 concurrent requests in the same event loop tick
      const promises = Array.from({ length: 100 }).map(async () => {
        try {
          await cooldown(interaction, command, nextFn);
          successes.push(true);
        } catch (err) {
          errors.push(err);
        }
      });

      await Promise.all(promises);

      // Exactly 1 request should succeed, 99 should fail with RateLimitError
      expect(successes.length).toBe(1);
      expect(errors.length).toBe(99);
      errors.forEach(err => {
        expect(err).toBeInstanceOf(RateLimitError);
        expect(err.message).toContain('請稍候');
      });
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    test('Correctness of expiration timers', async () => {
      const command = { cooldown: 3, data: { name: 'timer-test' } };
      const userId = 'user-abc';
      const interaction = {
        user: { id: userId },
        member: null,
        commandName: 'timer-test'
      };

      const next1 = jest.fn().mockResolvedValue({});
      const next2 = jest.fn().mockResolvedValue({});
      const next3 = jest.fn().mockResolvedValue({});

      // First call: succeeds
      await cooldown(interaction, command, next1);
      expect(next1).toHaveBeenCalledTimes(1);

      // Call at t = 2s: should fail
      jest.advanceTimersByTime(2000);
      await expect(cooldown(interaction, command, next2)).rejects.toThrow(RateLimitError);
      expect(next2).not.toHaveBeenCalled();

      // Call at t = 4.1s: should succeed (since cooldown is 3s)
      jest.advanceTimersByTime(2100); // total 4.1s
      await cooldown(interaction, command, next3);
      expect(next3).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Permission Checker Robustness', () => {
    const adminCommand = {
      adminOnly: true,
      data: { name: 'admin-cmd' }
    };

    test('Gracefully handles missing member structure (e.g. DM context)', async () => {
      const interaction = {
        member: null,
        user: { id: 'user-1' }
      };
      const next = jest.fn();

      await expect(permissionCheck(interaction, adminCommand, next)).rejects.toThrow(PermissionError);
      await expect(permissionCheck(interaction, adminCommand, next)).rejects.toThrow('此指令只能在伺服器頻道中使用。');
      expect(next).not.toHaveBeenCalled();
    });

    test('Gracefully handles malformed or empty member structure', async () => {
      const interaction = {
        member: {},
        user: { id: 'user-2' }
      };
      const next = jest.fn();

      await expect(permissionCheck(interaction, adminCommand, next)).rejects.toThrow(PermissionError);
      await expect(permissionCheck(interaction, adminCommand, next)).rejects.toThrow('您無權限執行此指令。');
      expect(next).not.toHaveBeenCalled();
    });

    test('Gracefully handles missing permissions property on member', async () => {
      const interaction = {
        member: {
          roles: { cache: new Map() }
        },
        user: { id: 'user-3' }
      };
      const next = jest.fn();

      await expect(permissionCheck(interaction, adminCommand, next)).rejects.toThrow(PermissionError);
      expect(next).not.toHaveBeenCalled();
    });

    test('Gracefully handles permissions.has being non-function', async () => {
      const interaction = {
        member: {
          permissions: { has: 'not-a-function' },
          roles: { cache: new Map() }
        },
        user: { id: 'user-4' }
      };
      const next = jest.fn();

      await expect(permissionCheck(interaction, adminCommand, next)).rejects.toThrow(PermissionError);
      expect(next).not.toHaveBeenCalled();
    });

    test('Gracefully handles roles being undefined', async () => {
      const interaction = {
        member: {
          permissions: { has: () => false }
        },
        user: { id: 'user-5' }
      };
      const next = jest.fn();

      await expect(permissionCheck(interaction, adminCommand, next)).rejects.toThrow(PermissionError);
      expect(next).not.toHaveBeenCalled();
    });

    test('Gracefully handles roles.cache being undefined', async () => {
      const interaction = {
        member: {
          permissions: { has: () => false },
          roles: {}
        },
        user: { id: 'user-6' }
      };
      const next = jest.fn();

      await expect(permissionCheck(interaction, adminCommand, next)).rejects.toThrow(PermissionError);
      expect(next).not.toHaveBeenCalled();
    });

    test('Throws if config.discord is missing or malformed', async () => {
      const originalDiscordConfig = config.discord;
      config.discord = null;

      const interaction = {
        member: {
          permissions: { has: () => false },
          roles: { cache: new Map() }
        },
        user: { id: 'user-7' }
      };
      const next = jest.fn();

      // Should throw TypeError: Cannot read properties of null (reading 'adminRoleIds')
      await expect(permissionCheck(interaction, adminCommand, next)).rejects.toThrow(TypeError);
      expect(next).not.toHaveBeenCalled();

      // Restore config
      config.discord = originalDiscordConfig;
    });
  });

  describe('3. Memory Leak Analysis', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    test('Simulates 1000+ command executions from different users and monitors cache cleanup', async () => {
      const command = { cooldown: 10, data: { name: 'leak-test-command' } };
      const next = jest.fn().mockResolvedValue({});

      // Run 1000 commands for 1000 unique users
      for (let i = 0; i < 1050; i++) {
        const userId = `user-leak-${i}`;
        const interaction = {
          user: { id: userId },
          member: null,
          commandName: 'leak-test-command'
        };
        await cooldown(interaction, command, next);
      }

      expect(next).toHaveBeenCalledTimes(1050);

      // Verify that after cooldown amount, all user timers fire and memory is reclaimed
      // Since jest fake timers are active, we can check how many timers are pending
      expect(jest.getTimerCount()).toBe(1050);

      // Fast forward time to expire all cooldowns
      jest.advanceTimersByTime(11000);

      // The timers should have fired, and there should be 0 pending timers
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
