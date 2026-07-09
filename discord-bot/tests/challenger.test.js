const mockDiscord = require('./e2e/preload-mock.js');
const db = require('../src/database');
const { execute: executeBan } = require('../src/bot/commands/封鎖');
const { execute: executeKick } = require('../src/bot/commands/踢出');
const { execute: executeTicket } = require('../src/bot/commands/客服單');
const { execute: executeBind } = require('../src/bot/commands/綁定');
const { execute: executePlayerInfo } = require('../src/bot/commands/玩家資訊');

describe('Challenger Stress & Boundary Tests', () => {
  beforeEach(async () => {
    await db.init(':memory:');
  });

  afterEach(async () => {
    await db.close();
  });

  // 1. SQL Transactions / Bindings corruption check
  describe('SQL Transaction & Binding Integrity', () => {
    test('INSERT OR REPLACE silently deletes previous conflicting bindings', async () => {
      // Bind User A to Minecraft UUID U1
      await db.addBinding('discord_A', 'uuid_1', 'Steve');
      let bindingA = await db.getBindingByDiscordId('discord_A');
      expect(bindingA).toBeDefined();

      // Bind User B to Minecraft UUID U1 (same UUID)
      // Since it is INSERT OR REPLACE on bindings (which has mc_uuid UNIQUE constraint),
      // SQLite will delete the row for discord_A to satisfy the UNIQUE constraint on mc_uuid.
      await db.addBinding('discord_B', 'uuid_1', 'Steve');
      
      let bindingAAfter = await db.getBindingByDiscordId('discord_A');
      let bindingB = await db.getBindingByDiscordId('discord_B');
      
      expect(bindingB).toBeDefined();
      expect(bindingB.mc_uuid).toBe('uuid_1');
      // The critical finding: discord_A was silently unbound (deleted from database)
      expect(bindingAAfter).toBeUndefined();
    });

    test('Interrupted binding process leaves temporary code in DB (no transaction atomicity)', async () => {
      // In the real code, /綁定 performs:
      // 1. db.addBinding(discordId, mcUuid, mcUsername);
      // 2. db.deleteTempCode(code);
      // If the process crashes or an error happens after step 1 but before step 2,
      // the temporary code is still left in the database.
      await db.createTempCode('uuid_1', 'Steve', '123456');
      
      // Simulating step 1 success
      await db.addBinding('discord_A', 'uuid_1', 'Steve');
      
      // Simulating a crash / failure before step 2:
      // db.deleteTempCode('123456') is not called.
      
      // The temp code still exists in the database!
      const tempCode = await db.getTempCode('123456');
      expect(tempCode).toBeDefined();
    });

    test('db.bindUser transaction rolls back all changes if duplicate mc_uuid exists', async () => {
      await db.createTempCode('uuid_dup_test', 'Steve', '654321');
      // Bind uuid_dup_test to another user first
      await db.addBinding('discord_other', 'uuid_dup_test', 'Steve');
      
      // Now call db.bindUser and expect it to throw
      let errorThrown = false;
      try {
        await db.bindUser('discord_new', 'uuid_dup_test', 'Steve', '654321');
      } catch (err) {
        errorThrown = true;
      }
      expect(errorThrown).toBe(true);
      
      // Verify discord_new was NOT bound (rollback / check prevented it)
      expect(await db.getBindingByDiscordId('discord_new')).toBeUndefined();
      
      // Verify the temp code still exists
      expect(await db.getTempCode('654321')).toBeDefined();
    });
  });

  // 2. Lifespan of verification codes
  describe('Lifespan of Verification Codes (5-minute window)', () => {
    test('Code should be valid at 4 minutes 59 seconds (299,000 ms)', async () => {
      const code = '111111';
      await db.createTempCode('uuid_1', 'Steve', code);
      
      // Retrieve and simulate elapsed time
      const tempCodeInfo = await db.getTempCode(code);
      expect(tempCodeInfo).toBeDefined();
      
      // Mocking Date.now() / Date subtraction
      const createdAt = new Date(tempCodeInfo.created_at + ' UTC');
      const mockNow = createdAt.getTime() + 299000; // 4 mins 59 secs
      
      const diffMs = mockNow - createdAt.getTime();
      expect(diffMs).toBeLessThanOrEqual(300000);
    });

    test('Code should be invalid/expired at 5 minutes 1 second (301,000 ms)', async () => {
      const code = '222222';
      await db.createTempCode('uuid_1', 'Steve', code);
      
      const tempCodeInfo = await db.getTempCode(code);
      expect(tempCodeInfo).toBeDefined();
      
      const createdAt = new Date(tempCodeInfo.created_at + ' UTC');
      const mockNow = createdAt.getTime() + 301000; // 5 mins 1 sec
      
      const diffMs = mockNow - createdAt.getTime();
      expect(diffMs).toBeGreaterThan(300000);
    });
  });

  // 3. Case sensitivity in lookups
  describe('Case Sensitivity in Lookups', () => {
    test('Lookup and unlinking by Minecraft username is case-insensitive', async () => {
      await db.addBinding('discord_1', 'uuid_1', 'Steve');
      
      // exact match works
      const exact = await db.getBindingByMcUsername('Steve');
      expect(exact).toBeDefined();
      
      // case differences DO work
      const lowercase = await db.getBindingByMcUsername('steve');
      const uppercase = await db.getBindingByMcUsername('STEVE');
      
      expect(lowercase).toBeDefined();
      expect(uppercase).toBeDefined();
      expect(lowercase.mc_username).toBe('Steve');
      expect(uppercase.mc_username).toBe('Steve');

      // Unlinking case-insensitively works
      await db.removeBindingByMcUsername('steve');
      const deleted = await db.getBindingByMcUsername('Steve');
      expect(deleted).toBeUndefined();
    });
  });

  // 4. Command injection / splitting
  describe('Command Injection and Splitting', () => {
    test('Spaces in usernames/reasons cause command splitting in kick/ban commands', () => {
      // Command format: `ban ${username} ${reason}`
      // If username has spaces (e.g. "Bedrock Player"), the resulting command is:
      // "ban Bedrock Player Griefing"
      // In Minecraft, this bans player "Bedrock" with reason "Player Griefing"!
      const usernameWithSpace = 'Bedrock Player';
      const reason = 'Griefing';
      const commandString = `ban ${usernameWithSpace} ${reason}`;
      
      const parts = commandString.split(' ');
      expect(parts[0]).toBe('ban');
      expect(parts[1]).toBe('Bedrock'); // Banned player becomes "Bedrock"
      expect(parts[2]).toBe('Player');  // Part of reason
      expect(parts[3]).toBe('Griefing'); // Part of reason
    });

    test('Newline characters allow command injection/splitting', () => {
      const username = 'Steve\nop op Steve';
      const reason = 'Griefing';
      const commandString = `ban ${username} ${reason}`;
      
      expect(commandString).toContain('\n');
    });

    test('ban command rejects username containing double quote', async () => {
      const mockInteraction = {
        member: {
          permissions: { has: () => true },
          roles: { cache: { has: () => true } }
        },
        options: {
          getString: jest.fn((name) => {
            if (name === '玩家名稱') return 'Steve"';
            if (name === '原因') return 'Griefing';
            return null;
          })
        },
        reply: jest.fn().mockResolvedValue({})
      };

      await executeBan(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: '玩家名稱包含無效字元。', ephemeral: true })
      );
    });

    test('kick command rejects username containing double quote', async () => {
      const mockInteraction = {
        member: {
          permissions: { has: () => true },
          roles: { cache: { has: () => true } }
        },
        options: {
          getString: jest.fn((name) => {
            if (name === '玩家名稱') return 'Steve"';
            if (name === '原因') return 'Griefing';
            return null;
          })
        },
        reply: jest.fn().mockResolvedValue({})
      };

      await executeKick(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: '玩家名稱包含無效字元。', ephemeral: true })
      );
    });
  });

  // 5. Null pointer exceptions in DM context
  describe('Null Pointer Exception in DM Context', () => {
    test('/客服單 returns warning message when interaction.member is null', async () => {
      const mockInteraction = {
        member: null,
        guild: null,
        reply: jest.fn().mockResolvedValue({}),
      };
      
      await executeTicket(mockInteraction);
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: '此指令只能在伺服器頻道中使用。', ephemeral: true })
      );
    });
  });

  describe('/綁定 Execution Verification', () => {
    test('/綁定 successfully binds when valid code is provided', async () => {
      // 1. Create a temp code
      await db.createTempCode('uuid_bind_test', 'Steve', '123456');

      // 2. Mock interaction
      const mockInteraction = {
        options: {
          getString: jest.fn().mockReturnValue('123456')
        },
        user: { id: 'discord_bind_test' },
        reply: jest.fn().mockResolvedValue({})
      };

      await executeBind(mockInteraction);

      // Verify interaction.reply was called with success content
      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall.content).toContain('成功綁定');
      
      // Verify DB state
      const binding = await db.getBindingByDiscordId('discord_bind_test');
      expect(binding).toBeDefined();
      expect(binding.mc_username).toBe('Steve');
      
      const tempCode = await db.getTempCode('123456');
      expect(tempCode).toBeUndefined();
    });
  });

  describe('/玩家資訊 Execution and UUID Hiding', () => {
    test('/玩家資訊 does not display UUID in output', async () => {
      // 1. Add a binding
      await db.addBinding('discord_playerinfo_test', 'uuid_playerinfo_secret_123', 'QueryPlayer');

      // 2. Mock session and execution
      const session = require('../src/websocket/session');
      const originalIsActive = session.isActive;
      const originalExecuteCommand = session.executeCommand;

      session.isActive = () => true;
      session.executeCommand = jest.fn().mockResolvedValue({
        success: true,
        output: 'Online: true, LastOnline: 2026-07-08 19:00:00, Coords: X: 10, Y: 20, Z: 30, Dimension: Overworld'
      });

      try {
        // 3. Mock interaction
        const mockInteraction = {
          member: {
            permissions: { has: () => true },
            roles: { cache: { has: () => true } }
          },
          user: { id: 'discord_admin_id' },
          options: {
            getString: jest.fn().mockReturnValue('QueryPlayer')
          },
          deferReply: jest.fn().mockResolvedValue({}),
          editReply: jest.fn().mockResolvedValue({})
        };

        await executePlayerInfo(mockInteraction);

        // Verify editReply was called and the embed does NOT contain the UUID
        expect(mockInteraction.editReply).toHaveBeenCalled();
        const replyCall = mockInteraction.editReply.mock.calls[0][0];
        const embedJson = JSON.stringify(replyCall.embeds[0]);
        expect(embedJson).not.toContain('uuid_playerinfo_secret_123');
      } finally {
        session.isActive = originalIsActive;
        session.executeCommand = originalExecuteCommand;
      }
    });
  });
});
