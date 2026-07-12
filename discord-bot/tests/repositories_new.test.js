const path = require('path');
const fs = require('fs');
const { DatabaseSync: Database } = require('node:sqlite');
const db = require('../src/database/index');
const { OfflineMailRepository, DailyStatsRepository } = require('../src/database/repositories');

const TEST_DB = path.resolve(__dirname, './db_repos_test.db');
const SCHEMA_FILE = path.resolve(__dirname, '../src/database/schema.sql');

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

describe('OfflineMailRepository Operations', () => {
  test('should create, retrieve, and mark delivered mails', async () => {
    // 1. Create a mail
    await OfflineMailRepository.createMail('sender-id-1', 'SenderName', 'ReceiverName', 'minecraft:diamond', 5, '{custom:1}');
    
    // 2. Query pending mails
    const pending = await OfflineMailRepository.getPendingMails('ReceiverName');
    expect(pending.length).toBe(1);
    expect(pending[0].sender_username).toBe('SenderName');
    expect(pending[0].receiver_username).toBe('ReceiverName');
    expect(pending[0].item_id).toBe('minecraft:diamond');
    expect(pending[0].quantity).toBe(5);
    expect(pending[0].nbt).toBe('{custom:1}');
    expect(pending[0].status).toBe('pending');

    // Case-insensitivity check
    const pendingLower = await OfflineMailRepository.getPendingMails('receivername');
    expect(pendingLower.length).toBe(1);

    // 3. Mark delivered
    const mailId = pending[0].id;
    await OfflineMailRepository.markMailDelivered(mailId);

    // Check pending again
    const pendingAfter = await OfflineMailRepository.getPendingMails('ReceiverName');
    expect(pendingAfter.length).toBe(0);

    // Check all mails (including delivered)
    const all = await OfflineMailRepository.getAllMails('ReceiverName');
    expect(all.length).toBe(1);
    expect(all[0].status).toBe('delivered');
    expect(all[0].delivered_at).not.toBeNull();
  });
});

describe('DailyStatsRepository Operations', () => {
  test('should increment messages, deaths, logins and max online', async () => {
    const today = '2026-07-10';

    // Increment message
    await DailyStatsRepository.incrementMessage(today);
    await DailyStatsRepository.incrementMessage(today);

    // Increment death
    await DailyStatsRepository.incrementDeath(today);

    // Increment login and record logins
    await DailyStatsRepository.incrementLogin(today);
    await DailyStatsRepository.incrementLogin(today);
    await DailyStatsRepository.recordLogin(today, 'UserA');
    await DailyStatsRepository.recordLogin(today, 'UserA'); // Duplicate
    await DailyStatsRepository.recordLogin(today, 'UserB');

    // Update max online
    await DailyStatsRepository.updateMaxOnline(today, 5);
    await DailyStatsRepository.updateMaxOnline(today, 10);
    await DailyStatsRepository.updateMaxOnline(today, 3); // Should keep max of 10

    // Fetch stats
    const stats = await DailyStatsRepository.getStats(today);
    expect(stats).not.toBeNull();
    expect(stats.total_messages).toBe(2);
    expect(stats.total_deaths).toBe(1);
    expect(stats.total_logins).toBe(2);
    expect(stats.max_online).toBe(10);

    // Fetch unique login count
    const uniqCount = await DailyStatsRepository.getLoginCount(today);
    expect(uniqCount).toBe(2);
  });
});
