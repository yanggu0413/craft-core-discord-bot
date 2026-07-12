const db = require('../src/database');
const {
  UserRepository,
  TicketRepository,
  SettingRepository,
  PlayerStatsRepository,
  TempCodeRepository
} = require('../src/database/repositories');

beforeAll(async () => {
  await db.init(':memory:');
});

afterAll(async () => {
  await db.close();
});

describe('Bindings Operations', () => {
  test('should bind and retrieve successfully', async () => {
    await db.addBinding('1234567890', '4086d4e8-466c-486b-a3d8-5542fbd1e771', 'Steve');
    const binding = await db.getBindingByDiscordId('1234567890');
    expect(binding).toBeDefined();
    expect(binding.mc_username).toBe('Steve');
    expect(binding.mc_uuid).toBe('4086d4e8-466c-486b-a3d8-5542fbd1e771');
  });

  test('should locate bindings by UUID and Username', async () => {
    const byUuid = await db.getBindingByMcUuid('4086d4e8-466c-486b-a3d8-5542fbd1e771');
    expect(byUuid).toBeDefined();
    expect(byUuid.discord_id).toBe('1234567890');

    const byUsername = await db.getBindingByMcUsername('Steve');
    expect(byUsername).toBeDefined();
    expect(byUsername.discord_id).toBe('1234567890');
  });

  test('should delete binding by MC UUID', async () => {
    await db.addBinding('1111111111', 'uuid-to-delete', 'SteveToDelete');
    await db.removeBindingByMcUuid('uuid-to-delete');
    const binding = await db.getBindingByMcUuid('uuid-to-delete');
    expect(binding).toBeUndefined();
  });

  test('should delete binding by Discord ID', async () => {
    await db.removeBindingByDiscordId('1234567890');
    const binding = await db.getBindingByDiscordId('1234567890');
    expect(binding).toBeUndefined();
  });
});

describe('Verification Codes Operations', () => {
  test('should insert and fetch temporary codes', async () => {
    await db.createTempCode('4086d4e8-466c-486b-a3d8-5542fbd1e771', 'Steve', '654321');
    const code = await db.getTempCode('654321');
    expect(code).toBeDefined();
    expect(code.mc_uuid).toBe('4086d4e8-466c-486b-a3d8-5542fbd1e771');
  });

  test('should delete code on command execution success', async () => {
    await db.deleteTempCode('654321');
    expect(await db.getTempCode('654321')).toBeUndefined();
  });

  test('should clear expired temp codes', async () => {
    const result = await db.clearExpiredTempCodes();
    expect(result).toBeDefined();
    expect(result.changes).toBeDefined();
  });
});

describe('Tickets Operations', () => {
  test('should insert a ticket and close it', async () => {
    await db.createTicket('ticket-001', 'channel-001', 'user-001');
    let ticket = await db.getTicketByChannelId('channel-001');
    expect(ticket).toBeDefined();
    expect(ticket.status).toBe('open');

    await db.closeTicket('channel-001');
    ticket = await db.getTicketByChannelId('channel-001');
    expect(ticket.status).toBe('closed');
    expect(ticket.closed_at).not.toBeNull();
  });
});

describe('Settings Operations', () => {
  test('should set and get settings', async () => {
    await db.setSetting('some_key', 'some_value');
    expect(await db.getSetting('some_key')).toBe('some_value');
    expect(await db.getSetting('non_existent')).toBeNull();
  });
});

describe('Repository Integration Checks', () => {
  test('UserRepository mappings and null conversions', async () => {
    await UserRepository.addBinding('user-repo-disc', 'user-repo-uuid', 'RepoUser');
    
    const binding = await UserRepository.getBindingByDiscordId('user-repo-disc');
    expect(binding).not.toBeNull();
    expect(binding.mc_username).toBe('RepoUser');

    const nonExistent = await UserRepository.getBindingByDiscordId('non-existent');
    expect(nonExistent).toBeNull(); // mapped undefined -> null
  });

  test('TicketRepository mappings and null conversions', async () => {
    await TicketRepository.createTicket('t-repo', 'ch-repo', 'u-repo');
    const ticket = await TicketRepository.getTicketByChannelId('ch-repo');
    expect(ticket).not.toBeNull();
    expect(ticket.status).toBe('open');

    const nonExistent = await TicketRepository.getTicketByChannelId('non-existent');
    expect(nonExistent).toBeNull(); // mapped undefined -> null
  });

  test('SettingRepository mappings and null conversions', async () => {
    await SettingRepository.setSetting('set-repo', 'val-repo');
    expect(await SettingRepository.getSetting('set-repo')).toBe('val-repo');
    expect(await SettingRepository.getSetting('non-existent')).toBeNull();
  });

  test('PlayerStatsRepository leaderboard and increment', async () => {
    await PlayerStatsRepository.incrementDeath('uuid-p1', 'Player1');
    await PlayerStatsRepository.incrementDeath('uuid-p1', 'Player1');
    const leaderboard = await PlayerStatsRepository.getDeathLeaderboard(10);
    expect(leaderboard.length).toBeGreaterThanOrEqual(1);
    expect(leaderboard[0].mc_username).toBe('Player1');
    expect(leaderboard[0].deaths).toBe(2);
  });

  test('TempCodeRepository mappings and null conversions', async () => {
    await TempCodeRepository.createTempCode('uuid-tc', 'tc-user', 'TC9999');
    const tc = await TempCodeRepository.getTempCode('TC9999');
    expect(tc).not.toBeNull();
    expect(tc.mc_username).toBe('tc-user');

    const nonExistent = await TempCodeRepository.getTempCode('NONEX');
    expect(nonExistent).toBeNull(); // mapped undefined -> null
  });
});
