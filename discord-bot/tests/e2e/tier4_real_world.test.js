const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { DatabaseSync: Database } = require('node:sqlite');
const MockMinecraftClient = require('./mock-minecraft-client');

const TIER = 'tier4';
const PORT = 8084;
const DB_FILE = path.resolve(__dirname, `../../db_${TIER}.db`);
const SCHEMA_FILE = path.resolve(__dirname, '../../src/database/schema.sql');

let botProcess;
let mcClient;
let localDb;
let receivedDiscordEvents = [];

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
  if (fs.existsSync(DB_FILE)) {
    try { fs.unlinkSync(DB_FILE); } catch (e) {}
  }
  const db = new Database(DB_FILE);
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  db.exec(schema);
  db.close();

  localDb = new Database(DB_FILE);

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

describe('Tier 4: Real-World Scenarios', () => {

  test('Scenario 1: First-time Player Onboarding & Whitelist Grant', async () => {
    // 1. Bob joins MC and mod requests bind code
    const wsCodePromise = waitForWsMessage(mcClient, 'bind_code_response');
    mcClient.bind_code_request('BobMC', 'uuid-bob-mc');
    const codeResponse = await wsCodePromise;
    expect(codeResponse.success).toBe(true);
    const code = codeResponse.code;

    // 2. Bob binds on Discord using slash command
    const whitelistPromise = waitForWsMessage(mcClient, 'whitelist_action');
    const discordReplyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('綁定', { '驗證碼': code }, 'discord-bob-id', 'BobDiscord');

    // Verify Bob is added to whitelist
    const whitelist = await whitelistPromise;
    expect(whitelist.action).toBe('add');
    expect(whitelist.username).toBe('BobMC');

    // Verify Bob receives Discord response
    const reply = await discordReplyPromise;
    expect(reply.content).toContain('成功綁定');

    // Verify DB bindings table
    const binding = localDb.prepare('SELECT * FROM bindings WHERE discord_id = ?').get('discord-bob-id');
    expect(binding).toBeDefined();
    expect(binding.mc_username).toBe('BobMC');

    // Verify code is deleted from DB
    const codeInDb = localDb.prepare('SELECT * FROM temp_codes WHERE code = ?').get(code);
    expect(codeInDb).toBeUndefined();
  });

  test('Scenario 2: Active Griefing Administration (Ban & Kick)', async () => {
    // Admin triggers ban slash command
    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    triggerSlashCommand('封鎖', { '玩家名稱': 'GrieferMC', '原因': 'Griefing spawn area' }, 'discord-admin-id', 'AdminUser');
    
    // Command request sent to MC WebSocket client
    const cmd = await wsCmdPromise;
    expect(cmd.command).toBe('ban GrieferMC Griefing spawn area');
    expect(cmd.admin_username).toBe('AdminUser#1234');

    // Mod client replies with success
    const discordReplyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    mcClient.command_response(cmd.command_id, true, 'Banned GrieferMC: Griefing spawn area');

    // Admin receives reply edit
    const reply = await discordReplyPromise;
    expect(reply.content).toContain('成功封鎖玩家 `GrieferMC`');
    expect(reply.content).toContain('Banned GrieferMC');
  });

  test('Scenario 3: Server Reboot and Telemetry Reconnection', async () => {
    // 1. MC Server goes offline
    mcClient.close();
    await new Promise(r => setTimeout(r, 1000));

    // 2. Admin command fails because server not connected
    const replyPromise1 = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('封鎖', { '玩家名稱': 'GrieferMC', '原因': 'grief' }, 'discord-admin-id', 'AdminUser');
    const reply1 = await replyPromise1;
    expect(reply1.content).toContain('Minecraft 伺服器目前未連線');

    // 3. MC Server starts back up, connects & authenticates
    mcClient = new MockMinecraftClient(`ws://localhost:${PORT}`, `secret_${TIER}`);
    await mcClient.connect();

    // 4. Server status updates resume
    const statusMsgPromise = waitForDiscordEvent('MESSAGE_CREATE', (msg) => msg.embeds && msg.embeds.length > 0);
    mcClient.status({ online: true, tps: 20.00 });
    const msg = await statusMsgPromise;
    expect(msg.embeds[0].title).toContain('伺服器狀態');
  });

  test('Scenario 4: Whitelist Removal upon Guild Exit', async () => {
    // Setup binding for leaving user
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-leaving-user', 'uuid-leaving-user', 'LeavingMC');

    // Member leaves Discord guild
    const whitelistPromise = waitForWsMessage(mcClient, 'whitelist_action');
    triggerGuildMemberLeave('discord-leaving-user');

    // Whitelist removal sent to MC server
    const whitelist = await whitelistPromise;
    expect(whitelist.action).toBe('remove');
    expect(whitelist.username).toBe('LeavingMC');

    // DB binding removed
    const binding = localDb.prepare('SELECT * FROM bindings WHERE discord_id = ?').get('discord-leaving-user');
    expect(binding).toBeUndefined();
  });

  test('Scenario 5: Support Ticket Lifecycle with Admin Query', async () => {
    // Setup Alice's binding
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-alice-id', 'uuid-alice-mc', 'AliceMC');

    // 1. Alice opens a ticket
    const channelPromise = waitForDiscordEvent('CHANNEL_CREATE');
    const welcomePromise = waitForDiscordEvent('MESSAGE_CREATE');
    const createReplyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerButtonClick('create_ticket', 'discord-alice-id', 'Alice');
    const channel = await channelPromise;
    await welcomePromise;
    await createReplyPromise; // Consume the Alice create ticket reply to avoid pollution

    // 2. Admin views query in ticket channel
    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    const queryReplyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    triggerSlashCommand('玩家資訊', { '查詢內容': 'AliceMC' }, 'discord-admin-id', 'AdminUser', channel.id);
    
    const cmd = await wsCmdPromise;
    mcClient.command_response(cmd.command_id, true, 'Online: true, LastOnline: 2026-07-08 19:00:00, Coords: X: -50, Y: 70, Z: 80, Dimension: End');

    const queryReply = await queryReplyPromise;
    expect(queryReply.embeds[0].fields.find(f => f.name === 'Minecraft 玩家名').value).toContain('AliceMC');
    expect(JSON.stringify(queryReply.embeds[0])).not.toContain('uuid-alice-mc');

    // 3. Admin closes the ticket
    const logPromise = waitForDiscordEvent('MESSAGE_CREATE', (payload) => payload.content.includes('已關閉'));
    const channelDeletePromise = waitForDiscordEvent('CHANNEL_DELETE');
    triggerButtonClick('close_ticket', 'discord-alice-id', 'Alice', channel.id);

    await channelDeletePromise;
    const log = await logPromise;
    expect(log.content).toContain('已關閉');
    expect(log.files).toBeDefined();
  });

});
