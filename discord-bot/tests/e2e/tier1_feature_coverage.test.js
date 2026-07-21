const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { DatabaseSync: Database } = require('node:sqlite');
const MockMinecraftClient = require('./mock-minecraft-client');

const TIER = 'tier1';
const PORT = 8081;
const DB_FILE = path.resolve(__dirname, `../../db_${TIER}.db`);
const SCHEMA_FILE = path.resolve(__dirname, '../../src/database/schema.sql');

let botProcess;
let mcClient;
let localDb;
let receivedDiscordEvents = [];

// Helper to wait for a Discord event of specific type/attributes
function waitForDiscordEvent(event, filterFn = () => true, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    
    // Check existing
    const foundIdx = receivedDiscordEvents.findIndex(e => e.event === event && filterFn(e.payload));
    if (foundIdx !== -1) {
      const e = receivedDiscordEvents[foundIdx];
      receivedDiscordEvents.splice(foundIdx, 1);
      return resolve(e.payload);
    }

    const timer = setInterval(() => {
      const idx = receivedDiscordEvents.findIndex(e => e.event === event && filterFn(e.payload));
      if (idx !== -1) {
        clearInterval(timer);
        const e = receivedDiscordEvents[idx];
        receivedDiscordEvents.splice(idx, 1);
        resolve(e.payload);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error(`Timeout waiting for Discord event: ${event}`));
      }
    }, 50);
  });
}

function waitForWsMessage(client, type, filterFn = () => true, timeout = 3000) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let timeoutId;
    const listener = (payload) => {
      if (filterFn(payload)) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        client.off(type, listener);
        resolve(payload);
      }
    };
    client.on(type, listener);
    timeoutId = setTimeout(() => {
      if (!resolved) {
        client.off(type, listener);
        reject(new Error(`Timeout waiting for WS packet: ${type}`));
      }
    }, timeout);
  });
}

function triggerSlashCommand(name, options, userId, username, channelId = '1111222233334444', isAdmin = true) {
  botProcess.send({
    type: 'INTERACTION_CREATE',
    interaction: {
      type: 'slash',
      name,
      options,
      userId,
      username,
      channelId,
      isAdmin
    }
  });
}

function triggerButtonClick(customId, userId, username, channelId = '1111222233334444', isAdmin = true) {
  botProcess.send({
    type: 'INTERACTION_CREATE',
    interaction: {
      type: 'button',
      customId,
      userId,
      username,
      channelId,
      isAdmin
    }
  });
}

function triggerGuildMemberLeave(userId) {
  botProcess.send({
    type: 'GUILD_MEMBER_REMOVE',
    userId
  });
}

beforeAll(async () => {
  await new Promise(r => setTimeout(r, 1500));
  // 1. Establish clean SQLite database state
  if (fs.existsSync(DB_FILE)) {
    try { fs.unlinkSync(DB_FILE); } catch (e) {}
  }
  const db = new Database(DB_FILE);
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  db.exec(schema);
  db.close();

  localDb = new Database(DB_FILE);

  // 2. Spawn the bot process with a Discord mock preload script
  botProcess = spawn('node', [
    '-r', path.resolve(__dirname, './preload-mock.js'),
    'src/index.js'
  ], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_PATH: DB_FILE,
      WEBSOCKET_PORT: PORT.toString(),
      WEBSOCKET_SECRET: `secret_${TIER}`,
      DISCORD_TOKEN: 'mock_token'
    },
    cwd: path.resolve(__dirname, '../../'),
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  });

  botProcess.on('message', (msg) => {
    if (msg && msg.type === 'DISCORD_EVENT') {
      receivedDiscordEvents.push(msg);
    }
  });

  // Wait for bot to initialize and WebSocket server to be ready
  await new Promise((resolve, reject) => {
    let output = '';
    const onData = (data) => {
      output += data.toString();
      if (output.includes('WebSocket server listening')) {
        botProcess.stdout.off('data', onData);
        botProcess.stdout.resume();
        botProcess.stderr.resume();
        resolve();
      }
    };
    botProcess.stdout.on('data', onData);
    botProcess.on('error', reject);
    setTimeout(() => reject(new Error('Bot failed to start: ' + output)), 10000);
  });

  // 3. Connect mock Minecraft server client
  mcClient = new MockMinecraftClient(`ws://localhost:${PORT}`, `secret_${TIER}`);
  await mcClient.connect();
});

beforeEach(() => {
  receivedDiscordEvents = [];
});

afterAll(async () => {
  if (mcClient) mcClient.close();
  if (botProcess) {
    if (botProcess.exitCode === null && !botProcess.killed) {
      botProcess.kill('SIGTERM');
      await new Promise((resolve) => {
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            botProcess.kill('SIGKILL');
            resolve();
          }
        }, 2000);
        botProcess.once('exit', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }
  }
  if (localDb) localDb.close();
  
  if (fs.existsSync(DB_FILE)) {
    let attempts = 0;
    while (attempts < 5) {
      try {
        fs.unlinkSync(DB_FILE);
        break;
      } catch (e) {
        attempts++;
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }
});

describe('Tier 1: Feature Coverage (F1-F5)', () => {

  // === Feature 1: Account Binding & Whitelist Linkage ===
  
  test('F1-1: bind_code_request generates and stores verification code in DB', async () => {
    const wsResponsePromise = waitForWsMessage(mcClient, 'bind_code_response');
    mcClient.bind_code_request('BobF1', 'uuid-bob-f1');
    
    const response = await wsResponsePromise;
    expect(response.success).toBe(true);
    expect(response.code).toBeDefined();
    
    const codeInDb = localDb.prepare('SELECT * FROM temp_codes WHERE mc_uuid = ?').get('uuid-bob-f1');
    expect(codeInDb).toBeDefined();
    expect(codeInDb.code).toBe(response.code);
  });

  test('F1-2: /綁定 command with valid code binds accounts and sends whitelist_action to MC', async () => {
    const wsResponsePromise = waitForWsMessage(mcClient, 'bind_code_response');
    mcClient.bind_code_request('AliceF1', 'uuid-alice-f1');
    const response = await wsResponsePromise;
    const code = response.code;

    const whitelistPromise = waitForWsMessage(mcClient, 'whitelist_action');
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');

    triggerSlashCommand('綁定', { '驗證碼': code }, 'discord-alice-f1', 'AliceF1');

    const whitelist = await whitelistPromise;
    expect(whitelist.action).toBe('add');
    expect(whitelist.username).toBe('AliceF1');

    const reply = await replyPromise;
    expect(reply.content).toContain('成功綁定');

    const binding = localDb.prepare('SELECT * FROM bindings WHERE discord_id = ?').get('discord-alice-f1');
    expect(binding).toBeDefined();
    expect(binding.mc_username).toBe('AliceF1');
  });

  test('F1-3: /解除綁定 command unbinds accounts and sends whitelist_action remove', async () => {
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-unlink-f1', 'uuid-unlink-f1', 'UnlinkF1');

    const whitelistPromise = waitForWsMessage(mcClient, 'whitelist_action');
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');

    triggerSlashCommand('解除綁定', {}, 'discord-unlink-f1', 'UnlinkF1');

    const whitelist = await whitelistPromise;
    expect(whitelist.action).toBe('remove');
    expect(whitelist.username).toBe('UnlinkF1');

    const reply = await replyPromise;
    expect(reply.content).toContain('成功解除綁定');

    const binding = localDb.prepare('SELECT * FROM bindings WHERE discord_id = ?').get('discord-unlink-f1');
    expect(binding).toBeUndefined();
  });

  test('F1-4: guildMemberRemove event removes account binding and sends whitelist_action remove', async () => {
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-leave-f1', 'uuid-leave-f1', 'LeaveF1');

    const whitelistPromise = waitForWsMessage(mcClient, 'whitelist_action');

    triggerGuildMemberLeave('discord-leave-f1');

    const whitelist = await whitelistPromise;
    expect(whitelist.action).toBe('remove');
    expect(whitelist.username).toBe('LeaveF1');

    const binding = localDb.prepare('SELECT * FROM bindings WHERE discord_id = ?').get('discord-leave-f1');
    expect(binding).toBeUndefined();
  });

  test('F1-5: temporary code is deleted from DB after successful /綁定 execution', async () => {
    const wsResponsePromise = waitForWsMessage(mcClient, 'bind_code_response');
    mcClient.bind_code_request('CharlieF1', 'uuid-charlie-f1');
    const response = await wsResponsePromise;
    const code = response.code;

    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('綁定', { '驗證碼': code }, 'discord-charlie-f1', 'CharlieF1');
    await replyPromise;

    const codeInDb = localDb.prepare('SELECT * FROM temp_codes WHERE code = ?').get(code);
    expect(codeInDb).toBeUndefined();
  });

  // === Feature 2: Bidirectional Chat & Event Sync ===

  test('F2-1: Game-to-Discord chat relay forwards message via Discord webhook', async () => {
    const webhookPromise = waitForDiscordEvent('WEBHOOK_SEND');
    mcClient.chat('SteveF2', 'uuid-steve-f2', 'Hello Discord from game!');

    const webhook = await webhookPromise;
    expect(webhook.username).toBe('SteveF2');
    expect(webhook.content).toBe('Hello Discord from game!');
  });

  test('F2-2: Game event "join" sends a sync message to Discord channel', async () => {
    const msgPromise = waitForDiscordEvent('MESSAGE_CREATE');
    mcClient.event('join', 'SteveF2', 'uuid-steve-f2', '');

    const msg = await msgPromise;
    expect(msg.embeds[0].author.name).toContain('加入了伺服器');
    expect(msg.embeds[0].author.name).toContain('SteveF2');
  });

  test('F2-3: Game event "leave" sends a sync message to Discord channel', async () => {
    const msgPromise = waitForDiscordEvent('MESSAGE_CREATE');
    mcClient.event('leave', 'SteveF2', 'uuid-steve-f2', '');

    const msg = await msgPromise;
    expect(msg.embeds[0].author.name).toContain('離開了伺服器');
    expect(msg.embeds[0].author.name).toContain('SteveF2');
  });

  test('F2-4: Game event "death" sends a death announcement message to Discord channel and increments database counter', async () => {
    const msgPromise = waitForDiscordEvent('MESSAGE_CREATE');
    mcClient.event('death', 'SteveF2', 'uuid-steve-f2', 'SteveF2 was pricked to death');

    const msg = await msgPromise;
    expect(msg.embeds[0].description).toContain('被仙人掌刺死了');
    expect(msg.embeds[0].description).toContain('SteveF2');

    // Direct DB check: Query the E2E test database file using localDb
    const row = localDb.prepare('SELECT deaths FROM player_stats WHERE mc_uuid = ?').get('uuid-steve-f2');
    expect(row).toBeDefined();
    expect(row.deaths).toBe(1);
  });

  test('F2-5: Game event "advancement" sends an advancement notification to Discord channel', async () => {
    const msgPromise = waitForDiscordEvent('MESSAGE_CREATE');
    mcClient.event('advancement', 'SteveF2', 'uuid-steve-f2', 'Stone Age');

    const msg = await msgPromise;
    expect(msg.embeds[0].author.name).toContain('SteveF2 已完成進度');
    expect(msg.embeds[0].author.name).toContain('石器時代');
  });

  // === Feature 3: Interactive Support Ticket System ===

  test('F3-1: /客服單 command sends support panel embed with close button', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    const panelPromise = waitForDiscordEvent('MESSAGE_CREATE');

    triggerSlashCommand('客服單', {}, 'discord-admin', 'AdminUser');

    const reply = await replyPromise;
    expect(reply.content).toContain('已成功建立');

    const panel = await panelPromise;
    expect(panel.embeds[0].title).toContain('客服支援中心');
    expect(panel.components[0].components[0].customId).toBe('create_ticket');
  });

  test('F3-2: Clicking "create_ticket" button creates a private channel', async () => {
    const channelPromise = waitForDiscordEvent('CHANNEL_CREATE');
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');

    triggerButtonClick('create_ticket', 'discord-user-f3', 'UserF3');

    const channel = await channelPromise;
    expect(channel.name).toContain('ticket-userf3');

    const reply = await replyPromise;
    expect(reply.content).toContain('您的客服單已建立');
  });

  test('F3-3: Clicking "create_ticket" button creates a ticket record in DB', async () => {
    const channelPromise = waitForDiscordEvent('CHANNEL_CREATE');
    triggerButtonClick('create_ticket', 'discord-user-f3b', 'UserF3b');
    const channel = await channelPromise;

    const ticket = localDb.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channel.id);
    expect(ticket).toBeDefined();
    expect(ticket.creator_id).toBe('discord-user-f3b');
    expect(ticket.status).toBe('open');
  });

  test('F3-4: Clicking "close_ticket" updates ticket status in DB to closed', async () => {
    const channelPromise = waitForDiscordEvent('CHANNEL_CREATE');
    triggerButtonClick('create_ticket', 'discord-user-f3c', 'UserF3c');
    const channel = await channelPromise;

    const deletePromise = waitForDiscordEvent('CHANNEL_DELETE');
    triggerButtonClick('close_ticket', 'discord-user-f3c', 'UserF3c', channel.id);
    await deletePromise;

    const ticket = localDb.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channel.id);
    expect(ticket.status).toBe('closed');
    expect(ticket.closed_at).not.toBeNull();
  });

  test('F3-5: Clicking "close_ticket" deletes ticket channel and sends transcript log', async () => {
    const channelPromise = waitForDiscordEvent('CHANNEL_CREATE');
    triggerButtonClick('create_ticket', 'discord-user-f3d', 'UserF3d');
    const channel = await channelPromise;

    const deletePromise = waitForDiscordEvent('CHANNEL_DELETE');
    const logPromise = waitForDiscordEvent('MESSAGE_CREATE', (payload) => payload.content.includes('已關閉'));

    triggerButtonClick('close_ticket', 'discord-user-f3d', 'UserF3d', channel.id);

    await deletePromise;
    const log = await logPromise;
    expect(log.content).toContain('已關閉');
    expect(log.files).toBeDefined();
    expect(log.files[0].name).toContain('transcript');
  });

  // === Feature 4: Server Status Monitoring ===

  test('F4-1: status packet sends status embed to configured channel', async () => {
    const msgPromise = waitForDiscordEvent('MESSAGE_CREATE');
    mcClient.status({ online: true, tps: 19.95, ping: 15, current_players: 2, max_players: 20, players: ['Alice', 'Bob'] });

    const msg = await msgPromise;
    expect(msg.embeds[0].title).toContain('伺服器狀態');
  });

  test('F4-2: status packet updates TPS values in the status embed', async () => {
    const msgPromise = waitForDiscordEvent('MESSAGE_EDIT');
    mcClient.status({ online: true, tps: 18.72, ping: 15, current_players: 2, max_players: 20, players: ['Alice', 'Bob'] });

    const msg = await msgPromise;
    const tpsField = msg.embeds[0].fields.find(f => f.name === 'TPS');
    expect(tpsField.value).toContain('18.72');
  });

  test('F4-3: status packet updates Ping values in the status embed', async () => {
    const msgPromise = waitForDiscordEvent('MESSAGE_EDIT');
    mcClient.status({ online: true, tps: 19.98, ping: 45, current_players: 2, max_players: 20, players: ['Alice', 'Bob'] });

    const msg = await msgPromise;
    const pingField = msg.embeds[0].fields.find(f => f.name === '平均延遲 (Ping)');
    expect(pingField.value).toContain('45ms');
  });

  test('F4-4: status packet updates current and max players counts in status embed', async () => {
    const msgPromise = waitForDiscordEvent('MESSAGE_EDIT');
    mcClient.status({ online: true, tps: 19.98, ping: 12, current_players: 5, max_players: 50, players: [] });

    const msg = await msgPromise;
    const playersCountField = msg.embeds[0].fields.find(f => f.name === '在線人數');
    expect(playersCountField.value).toContain('5 / 50');
  });

  test('F4-5: status packet shows online players list in status embed', async () => {
    const msgPromise = waitForDiscordEvent('MESSAGE_EDIT');
    mcClient.status({ online: true, tps: 19.98, ping: 12, current_players: 2, max_players: 20, players: ['Alice', 'Bob'] });

    const msg = await msgPromise;
    const playersField = msg.embeds[0].fields.find(f => f.name === '在線玩家');
    expect(playersField.value).toContain('Alice');
    expect(playersField.value).toContain('Bob');
  });

  // === Feature 5: Admin Command Forwarding & Capture ===

  test('F5-1: /封鎖 command forwards execution request with "ban" to MC', async () => {
    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    triggerSlashCommand('封鎖', { '玩家名稱': 'GrieferF5_1', '原因': 'steal' }, 'discord-admin', 'AdminUser');

    const cmd = await wsCmdPromise;
    expect(cmd.command).toBe('ban GrieferF5_1 steal');
  });

  test('F5-2: /踢出 command forwards execution request with "kick" to MC', async () => {
    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    triggerSlashCommand('踢出', { '玩家名稱': 'SpammerF5_2', '原因': 'spam' }, 'discord-admin', 'AdminUser');

    const cmd = await wsCmdPromise;
    expect(cmd.command).toBe('kick SpammerF5_2 spam');
  });

  test('F5-3: /玩家資訊 command fetches the correct binding metadata from DB', async () => {
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-query-f5', 'uuid-query-f5', 'QueryF5');

    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    triggerSlashCommand('玩家資訊', { '查詢內容': 'QueryF5' }, 'discord-admin', 'AdminUser');

    const cmd = await wsCmdPromise;
    expect(cmd.command).toBe('playerinfo QueryF5');
    mcClient.command_response(cmd.command_id, true, 'Online: true, LastOnline: 2026-07-08 19:00:00, Coords: X: 100, Y: 64, Z: -200, Dimension: Overworld');

    const reply = await replyPromise;
    expect(reply.embeds[0].title).toContain('玩家詳細資訊');
    const fields = reply.embeds[0].fields;
    expect(fields.find(f => f.name === 'Minecraft 玩家名').value).toContain('QueryF5');
    expect(fields.find(f => f.name === '在線狀態').value).toContain('線上');
    expect(fields.find(f => f.name === '最後上線時間').value).toContain('2026-07-08 19:00:00');
    expect(fields.find(f => f.name === '目前位置').value).toContain('X: 100, Y: 64, Z: -200 (Overworld)');
    expect(fields.find(f => f.name === 'Minecraft UUID')).toBeUndefined();
    expect(JSON.stringify(reply.embeds[0])).not.toContain('uuid-query-f5');
  });

  test('F5-4: command forwarding captures command output on success', async () => {
    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    triggerSlashCommand('封鎖', { '玩家名稱': 'BobF5_4', '原因': 'grief' }, 'discord-admin', 'AdminUser');
    
    const cmd = await wsCmdPromise;
    mcClient.command_response(cmd.command_id, true, 'Banned BobF5_4 successfully');

    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    const reply = await replyPromise;
    expect(reply.content).toContain('成功封鎖玩家');
    expect(reply.content).toContain('Banned BobF5_4 successfully');
  });

  test('F5-5: command forwarding captures error output on command failure', async () => {
    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    triggerSlashCommand('踢出', { '玩家名稱': 'BobF5_5', '原因': 'hack' }, 'discord-admin', 'AdminUser');
    
    const cmd = await wsCmdPromise;
    mcClient.command_response(cmd.command_id, false, 'Player not found');

    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    const reply = await replyPromise;
    expect(reply.content).toContain('踢出玩家 `BobF5_5` 失敗');
    expect(reply.content).toContain('Player not found');
  });

});
