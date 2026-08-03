const db = require('../src/database');
const { UserRepository, OfflineMailRepository } = require('../src/database/repositories');
const session = require('../src/websocket/session');
const handler = require('../src/websocket/handler');

describe('Milestone 7 Gate Empirical Verification Suite', () => {
  let sentPackets = [];
  const mockSession = {
    send: (pkt) => {
      sentPackets.push(pkt);
    },
    getWebDashboardWs: () => null,
    resolveCommand: () => {},
    resolveRequest: () => {}
  };

  beforeAll(async () => {
    // Initialize in-memory database
    process.env.DB_PATH = ':memory:';
    await db.init(':memory:');
    // Inject mock session
    session.send = mockSession.send;
  });

  beforeEach(() => {
    sentPackets = [];
  });

  test('1. Welfare Lucky Draw - Bound user with valid keys receives prize and keys count decrements', async () => {
    const discordId = 'disc_user_777';
    const username = 'LuckyPlayer7';
    const uuid = 'uuid-lucky-777';

    // Set up user & binding
    await UserRepository.addBinding(discordId, uuid, username);
    sentPackets = []; // Clear packets generated during setup
    await UserRepository.updateKeys(discordId, 3);

    const packet = {
      type: 'luckydraw_request',
      payload: {
        username,
        uuid,
        mod_keys: 3
      }
    };

    sentPackets = [];
    await handler.handle(packet, {});

    // Expect player_keys_update sync packet AND luckydraw_response packet
    const drawResp = sentPackets.find(p => p.type === 'luckydraw_response');
    const syncResp = sentPackets.find(p => p.type === 'player_keys_update');

    expect(drawResp).toBeDefined();
    expect(drawResp.payload.success).toBe(true);
    expect(drawResp.payload.username).toBe(username);
    expect(drawResp.payload.keysLeft).toBe(2);
    expect(drawResp.payload.item).toBeDefined();
    expect(drawResp.payload.amount).toBeGreaterThan(0);

    expect(syncResp).toBeDefined();
    expect(syncResp.payload.keys).toBe(2);

    // Verify database keys updated to 2
    const keysObj = await UserRepository.getUserKeys(discordId);
    expect(keysObj.keys_count).toBe(2);
  });

  test('2. Welfare Lucky Draw - Insufficient keys rejects draw request', async () => {
    const discordId = 'disc_user_888';
    const username = 'NoKeysPlayer';
    const uuid = 'uuid-nokeys-888';

    await UserRepository.addBinding(discordId, uuid, username);
    await UserRepository.updateKeys(discordId, 0);

    const packet = {
      type: 'luckydraw_request',
      payload: {
        username,
        uuid,
        mod_keys: 0
      }
    };

    sentPackets = [];
    await handler.handle(packet, {});

    const drawResp = sentPackets.find(p => p.type === 'luckydraw_response');
    expect(drawResp).toBeDefined();
    expect(drawResp.payload.success).toBe(false);
    expect(drawResp.payload.keysLeft).toBe(0);
    expect(drawResp.payload.message).toContain('鑰匙不足');
  });

  test('3. Welfare Lucky Draw - Unbound user receives binding prompt error', async () => {
    const packet = {
      type: 'luckydraw_request',
      payload: {
        username: 'UnboundUser',
        uuid: 'uuid-unbound-999',
        mod_keys: 5
      }
    };

    await handler.handle(packet, {});

    expect(sentPackets.length).toBe(1);
    const resp = sentPackets[0];
    expect(resp.type).toBe('luckydraw_response');
    expect(resp.payload.success).toBe(false);
    expect(resp.payload.message).toContain('尚未綁定 Discord 帳號');
  });

  test('4. Leaderboards - Keys and Streaks leaderboard queries return Top 10 list', async () => {
    // Query keys leaderboard
    const keysPacket = {
      type: 'welfare_leaderboard_query',
      payload: {
        query_id: 'q-keys-1',
        category: 'keys',
        limit: 10
      }
    };

    await handler.handle(keysPacket, {});

    expect(sentPackets.length).toBe(1);
    const keysResp = sentPackets[0];
    expect(keysResp.type).toBe('welfare_leaderboard_response');
    expect(keysResp.payload.success).toBe(true);
    expect(Array.isArray(keysResp.payload.leaderboard)).toBe(true);

    sentPackets = [];

    // Query streaks leaderboard
    const streaksPacket = {
      type: 'welfare_leaderboard_query',
      payload: {
        query_id: 'q-streaks-1',
        category: 'streaks',
        limit: 10
      }
    };

    await handler.handle(streaksPacket, {});

    expect(sentPackets.length).toBe(1);
    const streaksResp = sentPackets[0];
    expect(streaksResp.type).toBe('welfare_leaderboard_response');
    expect(streaksResp.payload.success).toBe(true);
    expect(Array.isArray(streaksResp.payload.leaderboard)).toBe(true);
  });

  test('5. Express Delivery & Join Query - Offline mail creation & pending mail count lookup', async () => {
    const senderId = 'disc_user_777';
    const senderUser = 'LuckyPlayer7';
    const receiverUser = 'ExpressRecipient1';

    // Create offline parcel mail
    await OfflineMailRepository.createMail(senderId, senderUser, receiverUser, 'minecraft:diamond_block', 10, '{"CustomName":"Express Delivery Box"}');

    // Query pending mails
    const pending = await OfflineMailRepository.getPendingMails(receiverUser);
    expect(pending.length).toBe(1);
    expect(pending[0].sender_username).toBe(senderUser);
    expect(pending[0].item_id).toBe('minecraft:diamond_block');
    expect(pending[0].quantity).toBe(10);

    // Test WS join_query handler for receiver
    const joinPacket = {
      type: 'join_query',
      payload: {
        username: receiverUser,
        uuid: 'uuid-express-rec-1'
      }
    };

    await handler.handle(joinPacket, {});

    expect(sentPackets.length).toBe(1);
    const joinResp = sentPackets[0];
    expect(joinResp.type).toBe('join_response');
    expect(joinResp.payload.username).toBe(receiverUser);
    expect(joinResp.payload.pendingMailCount).toBe(1);
  });

  test('6. Non-blocking WebSocket message handling under multi-packet burst', async () => {
    const packets = [];
    for (let i = 0; i < 20; i++) {
      packets.push({
        type: 'welfare_leaderboard_query',
        payload: {
          query_id: `burst-${i}`,
          category: i % 2 === 0 ? 'keys' : 'streaks',
          limit: 10
        }
      });
    }

    const start = Date.now();
    await Promise.all(packets.map(p => handler.handle(p, {})));
    const duration = Date.now() - start;

    expect(sentPackets.length).toBe(20);
    expect(duration).toBeLessThan(1000); // Must process non-blockingly within 1s
  });
});
