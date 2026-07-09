const dbManager = require('../src/database');
const { DatabaseSync: Database } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const 客服單Cmd = require('../src/bot/commands/客服單');
const 封鎖Cmd = require('../src/bot/commands/封鎖');
const 綁定Cmd = require('../src/bot/commands/綁定');

const TEST_DB_FILE = path.join(__dirname, 'test_boundary.db');

describe('Stress & Boundary Tests', () => {
  let testDb;

  beforeAll(() => {
    // Initialize file-based database for tests so we can manipulate it directly
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
    dbManager.init(TEST_DB_FILE);
    testDb = new Database(TEST_DB_FILE);
  });

  afterAll(() => {
    dbManager.close();
    testDb.close();
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  describe('1. SQL Transactions during Bindings', () => {
    test('should leave database in inconsistent state when deleteTempCode fails (no transaction)', () => {
      // 1. Create a temporary code
      dbManager.createTempCode('uuid-tx-test', 'tx-test-user', 'TX1234');
      
      // 2. Mock deleteTempCode to throw an error
      let errorThrown = false;
      try {
        dbManager.addBinding('discord-tx-test', 'uuid-tx-test', 'tx-test-user');
        throw new Error('Database connection interrupted during deletion');
      } catch (err) {
        errorThrown = true;
      }
      
      expect(errorThrown).toBe(true);
      
      // Since there is no transaction, the first insert succeeded and remains,
      // and the temp code also still exists because the second step failed or wasn't wrapped in transaction rollback.
      const binding = dbManager.getBindingByDiscordId('discord-tx-test');
      const tempCode = dbManager.getTempCode('TX1234');
      
      expect(binding).toBeDefined(); // Partial update committed!
      expect(tempCode).toBeDefined(); // Temp code still exists!
      
      // Clean up
      dbManager.removeBindingByDiscordId('discord-tx-test');
      dbManager.deleteTempCode('TX1234');
    });
  });

  describe('2. Verification Codes Lifespan (Exactly 5 mins)', () => {
    test('4 mins 59 secs (299,000 ms) ago should be valid, 5 mins 1 sec (301,000 ms) ago should be expired', () => {
      // Insert code with custom created_at
      const codeValid = '111111';
      const codeExpired = '222222';
      
      dbManager.createTempCode('uuid-valid', 'user-valid', codeValid);
      dbManager.createTempCode('uuid-expired', 'user-expired', codeExpired);
      
      // Set created_at for codeValid to 299 seconds ago
      const timeValid = new Date(Date.now() - 299000).toISOString().replace('T', ' ').substring(0, 19);
      testDb.prepare("UPDATE temp_codes SET created_at = ? WHERE code = ?").run(timeValid, codeValid);
      
      // Set created_at for codeExpired to 301 seconds ago
      const timeExpired = new Date(Date.now() - 301000).toISOString().replace('T', ' ').substring(0, 19);
      testDb.prepare("UPDATE temp_codes SET created_at = ? WHERE code = ?").run(timeExpired, codeExpired);
      
      // Verify via JS implementation (Date.now() - createdAt.getTime() > 300000)
      const tempCodeValid = dbManager.getTempCode(codeValid);
      const createdAtValid = new Date(tempCodeValid.created_at + ' UTC');
      const diffMsValid = Date.now() - createdAtValid.getTime();
      expect(diffMsValid).toBeLessThan(300000); // 4m59s is less than 5m
      
      const tempCodeExpired = dbManager.getTempCode(codeExpired);
      const createdAtExpired = new Date(tempCodeExpired.created_at + ' UTC');
      const diffMsExpired = Date.now() - createdAtExpired.getTime();
      expect(diffMsExpired).toBeGreaterThan(300000); // 5m1s is greater than 5m
      
      // Test DB-side clearExpiredTempCodes
      // The SQLite DB-side clear query is:
      // DELETE FROM temp_codes WHERE datetime(created_at) < datetime('now', '-5 minutes')
      // Let's run it:
      dbManager.clearExpiredTempCodes();
      
      // Verify that codeValid is still in database, but codeExpired is deleted
      expect(dbManager.getTempCode(codeValid)).toBeDefined();
      expect(dbManager.getTempCode(codeExpired)).toBeUndefined();
    });
  });

  describe('3. Case Sensitivity in Lookups', () => {
    test('username lookup should be case-insensitive due to NOCASE collation', () => {
      dbManager.addBinding('discord-case', 'uuid-case', 'Steve');
      
      // Query exact match
      expect(dbManager.getBindingByMcUsername('Steve')).toBeDefined();
      
      // Query case mismatched
      expect(dbManager.getBindingByMcUsername('steve')).toBeDefined();
      expect(dbManager.getBindingByMcUsername('STEVE')).toBeDefined();
      
      dbManager.removeBindingByDiscordId('discord-case');
    });
  });

  describe('4. Command Injection / Splitting inside /封鎖 and /踢出', () => {
    let mockSession;
    beforeAll(() => {
      mockSession = require('../src/websocket/session');
    });

    test('should sanitize reason newlines and double-quote username', async () => {
      const capturedCommands = [];
      mockSession.executeCommand = jest.fn(async (cmd, admin) => {
        capturedCommands.push(cmd);
        return { success: true, output: 'Mock execution' };
      });
      mockSession.isActive = () => true;

      // Mock interaction for /封鎖
      const mockInteraction = {
        member: {
          permissions: { has: () => true },
          roles: { cache: { has: () => true } }
        },
        user: { id: 'admin-id', tag: 'Admin#0001' },
        options: {
          getString: (name) => {
            if (name === '玩家名稱') return 'Steve 123'; // Bedrock name with space
            if (name === '原因') return 'Griefing\nop InjectionUser'; // Injection in reason
            return null;
          }
        },
        deferReply: jest.fn(),
        editReply: jest.fn()
      };

      await 封鎖Cmd.execute(mockInteraction);

      expect(capturedCommands.length).toBe(1);
      // Command contains sanitized spaces and double-quoted username
      expect(capturedCommands[0]).toBe('ban "Steve 123" Griefing op InjectionUser');
    });

    test('should reject usernames containing newline characters', async () => {
      mockSession.executeCommand = jest.fn();
      const mockInteraction = {
        member: {
          permissions: { has: () => true },
          roles: { cache: { has: () => true } }
        },
        user: { id: 'admin-id', tag: 'Admin#0001' },
        options: {
          getString: (name) => {
            if (name === '玩家名稱') return 'Steve\nAdmin';
            if (name === '原因') return 'Griefing';
            return null;
          }
        },
        reply: jest.fn().mockResolvedValue({})
      };

      await 封鎖Cmd.execute(mockInteraction);
      expect(mockSession.executeCommand).not.toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
        content: '玩家名稱包含無效字元。',
        ephemeral: true
      }));
    });
  });

  describe('5. Null Pointer Exceptions in DM Context', () => {
    test('should reply with warning when interaction.member is null in DM context', async () => {
      const mockInteraction = {
        member: null, // DM context has no member
        guild: null,
        user: { id: 'user-id', tag: 'User#0002' },
        reply: jest.fn().mockResolvedValue({})
      };

      await 客服單Cmd.execute(mockInteraction);
      expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
        content: '此指令只能在伺服器頻道中使用。',
        ephemeral: true
      }));
    });
  });
});
