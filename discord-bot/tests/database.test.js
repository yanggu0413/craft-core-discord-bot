const db = require('../src/database');

beforeAll(() => {
  db.init(':memory:');
});

afterAll(() => {
  db.close();
});

describe('Bindings Operations', () => {
  test('should bind and retrieve successfully', () => {
    db.addBinding('1234567890', '4086d4e8-466c-486b-a3d8-5542fbd1e771', 'Steve');
    const binding = db.getBindingByDiscordId('1234567890');
    expect(binding).toBeDefined();
    expect(binding.mc_username).toBe('Steve');
    expect(binding.mc_uuid).toBe('4086d4e8-466c-486b-a3d8-5542fbd1e771');
  });

  test('should locate bindings by UUID and Username', () => {
    const byUuid = db.getBindingByMcUuid('4086d4e8-466c-486b-a3d8-5542fbd1e771');
    expect(byUuid).toBeDefined();
    expect(byUuid.discord_id).toBe('1234567890');

    const byUsername = db.getBindingByMcUsername('Steve');
    expect(byUsername).toBeDefined();
    expect(byUsername.discord_id).toBe('1234567890');
  });

  test('should delete binding by MC UUID', () => {
    db.addBinding('1111111111', 'uuid-to-delete', 'SteveToDelete');
    db.removeBindingByMcUuid('uuid-to-delete');
    const binding = db.getBindingByMcUuid('uuid-to-delete');
    expect(binding).toBeUndefined();
  });

  test('should delete binding by Discord ID', () => {
    db.removeBindingByDiscordId('1234567890');
    const binding = db.getBindingByDiscordId('1234567890');
    expect(binding).toBeUndefined();
  });
});

describe('Verification Codes Operations', () => {
  test('should insert and fetch temporary codes', () => {
    db.createTempCode('4086d4e8-466c-486b-a3d8-5542fbd1e771', 'Steve', '654321');
    const code = db.getTempCode('654321');
    expect(code).toBeDefined();
    expect(code.mc_uuid).toBe('4086d4e8-466c-486b-a3d8-5542fbd1e771');
  });

  test('should delete code on command execution success', () => {
    db.deleteTempCode('654321');
    expect(db.getTempCode('654321')).toBeUndefined();
  });

  test('should clear expired temp codes', () => {
    const result = db.clearExpiredTempCodes();
    expect(result).toBeDefined();
    expect(result.changes).toBeDefined();
  });
});

describe('Tickets Operations', () => {
  test('should insert a ticket and close it', () => {
    db.createTicket('ticket-001', 'channel-001', 'user-001');
    let ticket = db.getTicketByChannelId('channel-001');
    expect(ticket).toBeDefined();
    expect(ticket.status).toBe('open');

    db.closeTicket('channel-001');
    ticket = db.getTicketByChannelId('channel-001');
    expect(ticket.status).toBe('closed');
    expect(ticket.closed_at).not.toBeNull();
  });
});

describe('Settings Operations', () => {
  test('should set and get settings', () => {
    db.setSetting('some_key', 'some_value');
    expect(db.getSetting('some_key')).toBe('some_value');
    expect(db.getSetting('non_existent')).toBeNull();
  });
});
