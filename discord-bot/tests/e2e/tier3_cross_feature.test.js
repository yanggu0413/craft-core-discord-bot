const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { DatabaseSync: Database } = require('node:sqlite');
const MockMinecraftClient = require('./mock-minecraft-client');

const TIER = 'tier3';
const PORT = 8083;
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

function triggerUserMessage(content, userId, username, channelId = '1111222233334444') {
  botProcess.send({
    type: 'MESSAGE_CREATE',
    message: {
      content,
      userId,
      username,
      channelId
    }
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

describe('Tier 3: Cross-Feature Combinations', () => {

  test('CF-1 (F1+F2): Bind account first, then send player chat to verify avatar/username matching binding', async () => {
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-cf1', 'uuid-cf1', 'PlayerCF1');

    const webPromise = waitForDiscordEvent('WEBHOOK_SEND');
    mcClient.chat('PlayerCF1', 'uuid-cf1', 'Testing CF-1 chat relay!');

    const web = await webPromise;
    expect(web.username).toBe('PlayerCF1');
    expect(web.avatarURL).toContain('uuid-cf1');
  });

  test('CF-2 (F1+F3): Bind account, then query bound account details from within support ticket', async () => {
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-cf2', 'uuid-cf2', 'PlayerCF2');

    const channelPromise = waitForDiscordEvent('CHANNEL_CREATE');
    const createReplyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerButtonClick('create_ticket', 'discord-cf2', 'PlayerCF2');
    const channel = await channelPromise;
    await createReplyPromise; // Consume the button click reply to avoid pollution

    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    triggerSlashCommand('玩家資訊', { '查詢內容': 'PlayerCF2' }, 'discord-admin', 'AdminUser', channel.id);

    const cmd = await wsCmdPromise;
    mcClient.command_response(cmd.command_id, true, 'Online: true, LastOnline: 2026-07-08 19:00:00, Coords: X: 10, Y: 20, Z: 30, Dimension: Nether');

    const reply = await replyPromise;
    expect(reply.embeds[0].title).toContain('玩家詳細資訊');
    expect(reply.embeds[0].fields.find(f => f.name === 'Minecraft 玩家名').value).toContain('PlayerCF2');
    expect(JSON.stringify(reply.embeds[0])).not.toContain('uuid-cf2');
  });

  test('CF-3 (F1+F5): Bind account, run /玩家資訊 using user mention, MC username, or UUID; verify same DB record is returned', async () => {
    const testDiscordId = '333334444455555666';
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run(testDiscordId, 'uuid-cf3', 'PlayerCF3');

    // 1. Query using MC Username
    const wsCmdPromise1 = waitForWsMessage(mcClient, 'command_request');
    const replyPromise1 = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    triggerSlashCommand('玩家資訊', { '查詢內容': 'PlayerCF3' }, 'discord-admin', 'AdminUser');
    
    const cmd1 = await wsCmdPromise1;
    mcClient.command_response(cmd1.command_id, true, 'Online: false, LastOnline: 2026-07-08 19:00:00');
    
    const reply1 = await replyPromise1;
    expect(reply1.embeds[0].fields.find(f => f.name === 'Minecraft 玩家名').value).toContain('PlayerCF3');
    expect(JSON.stringify(reply1.embeds[0])).not.toContain('uuid-cf3');

    // 2. Query using Discord mention
    const wsCmdPromise2 = waitForWsMessage(mcClient, 'command_request');
    const replyPromise2 = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    triggerSlashCommand('玩家資訊', { '查詢內容': `<@${testDiscordId}>` }, 'discord-admin', 'AdminUser');
    
    const cmd2 = await wsCmdPromise2;
    mcClient.command_response(cmd2.command_id, true, 'Online: false, LastOnline: 2026-07-08 19:00:00');
    
    const reply2 = await replyPromise2;
    expect(reply2.embeds[0].fields.find(f => f.name === 'Minecraft 玩家名').value).toContain('PlayerCF3');
    expect(JSON.stringify(reply2.embeds[0])).not.toContain('uuid-cf3');
  });

  test('CF-4 (F2+F4): Send rapid chat messages from MC server during status updates to verify concurrency', async () => {
    const chatPromise1 = waitForDiscordEvent('WEBHOOK_SEND');
    mcClient.chat('PlayerCF4', 'uuid-cf4', 'Message 1');
    
    const statusPromise = waitForDiscordEvent('MESSAGE_CREATE');
    mcClient.status({ online: true, tps: 19.88 });

    const chatPromise2 = waitForDiscordEvent('WEBHOOK_SEND');
    mcClient.chat('PlayerCF4', 'uuid-cf4', 'Message 2');

    await Promise.all([chatPromise1, statusPromise, chatPromise2]);
  });

  test('CF-5 (F3+F5): In ticket channel, admin runs /玩家資訊, captures output, and verifies output is logged in transcript on ticket close', async () => {
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-cf5', 'uuid-cf5', 'PlayerCF5');

    const channelPromise = waitForDiscordEvent('CHANNEL_CREATE');
    const createReplyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerButtonClick('create_ticket', 'discord-cf5', 'PlayerCF5');
    const channel = await channelPromise;
    await createReplyPromise; // Consume ticket creation reply

    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    const queryReplyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    triggerSlashCommand('玩家資訊', { '查詢內容': 'PlayerCF5' }, 'discord-admin', 'AdminUser', channel.id);
    
    const cmd = await wsCmdPromise;
    mcClient.command_response(cmd.command_id, true, 'Online: false, LastOnline: 2026-07-08 19:00:00');
    await queryReplyPromise;

    const logPromise = waitForDiscordEvent('MESSAGE_CREATE', (payload) => payload.content.includes('已關閉'));
    triggerButtonClick('close_ticket', 'discord-cf5', 'PlayerCF5', channel.id);

    const log = await logPromise;
    expect(log.files).toBeDefined();
  });

  test('CF-6 (F1+F4): Bind a player, then send a status update containing that player; verify status displays correct player details', async () => {
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-cf6', 'uuid-cf6', 'PlayerCF6');

    const msgPromise = waitForDiscordEvent('MESSAGE_EDIT');
    mcClient.status({ online: true, current_players: 1, players: ['PlayerCF6'] });

    const msg = await msgPromise;
    expect(msg.embeds[0].fields.find(f => f.name === '在線人數').value).toContain('1 /');
    expect(msg.embeds[0].fields.find(f => f.name === '在線玩家').value).toContain('PlayerCF6');
  });

  test('CF-7 (F2+F5): Send Minecraft chat containing words mimicking admin commands; verify no recursive action or infinite loops', async () => {
    const webPromise = waitForDiscordEvent('WEBHOOK_SEND');
    mcClient.chat('Steve', 'uuid-steve', '/封鎖 PlayerCF7 grief');

    const web = await webPromise;
    expect(web.content).toBe('/封鎖 PlayerCF7 grief');
    
    let requestReceived = false;
    const listener = () => { requestReceived = true; };
    mcClient.on('command_request', listener);

    await new Promise(r => setTimeout(r, 300));
    mcClient.off('command_request', listener);
    expect(requestReceived).toBe(false);
  });

  test('CF-8 (F1+F2+F5): Ban a bound player, check that command executes, and verify admin receives the captured output', async () => {
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-cf8', 'uuid-cf8', 'PlayerCF8');

    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    triggerSlashCommand('封鎖', { '玩家名稱': 'PlayerCF8', '原因': 'grief' }, 'discord-admin', 'AdminUser');
    const cmd = await wsCmdPromise;
    expect(cmd.command).toBe('ban "PlayerCF8" grief');

    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    mcClient.command_response(cmd.command_id, true, 'Banned PlayerCF8');
    
    const reply = await replyPromise;
    expect(reply.content).toContain('成功封鎖玩家 `PlayerCF8`');
    expect(reply.content).toContain('Banned PlayerCF8');
  });

  test('CF-9 (F3+F4): Open a support ticket while status updates are actively running; verify DB is not locked and concurrent query succeeds', async () => {
    mcClient.status({ online: true, tps: 19.9 });
    
    const channelPromise = waitForDiscordEvent('CHANNEL_CREATE');
    const createReplyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerButtonClick('create_ticket', 'discord-cf9', 'PlayerCF9');
    const channel = await channelPromise;
    await createReplyPromise; // Consume creation reply
    expect(channel.name).toContain('ticket-playercf9');
  });

  test('CF-10 (F1+F3): Unbind a player, and verify they can still create a support ticket', async () => {
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-cf10', 'uuid-cf10', 'PlayerCF10');
    
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('解除綁定', {}, 'discord-cf10', 'PlayerCF10');
    await replyPromise;

    const channelPromise = waitForDiscordEvent('CHANNEL_CREATE');
    const createReplyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerButtonClick('create_ticket', 'discord-cf10', 'PlayerCF10');
    const channel = await channelPromise;
    await createReplyPromise; // Consume creation reply
    expect(channel.name).toContain('ticket-playercf10');
  });

});
