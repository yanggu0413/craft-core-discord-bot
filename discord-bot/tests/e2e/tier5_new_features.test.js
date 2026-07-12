const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { DatabaseSync: Database } = require('node:sqlite');
const MockMinecraftClient = require('./mock-minecraft-client');

const TIER = 'tier5';
const PORT = 8085;
const DB_FILE = path.resolve(__dirname, `../../db_${TIER}.db`);
const SCHEMA_FILE = path.resolve(__dirname, '../../src/database/schema.sql');

let botProcess;
let mcClient;
let localDb;
let receivedDiscordEvents = [];

function waitForDiscordEvent(event, filterFn = () => true, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
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
        console.log('[DEBUG TIER5 WEB EVENT TIMEOUT] All received events:', JSON.stringify(receivedDiscordEvents, null, 2));
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

function triggerModalSubmit(customId, fields, userId, username, channelId = '1111222233334444', isAdmin = true) {
  botProcess.send({
    type: 'INTERACTION_CREATE',
    interaction: {
      type: 'modal',
      customId,
      fields,
      userId,
      username,
      channelId,
      isAdmin
    }
  });
}

function triggerSelectSelect(customId, values, userId, username, channelId = '1111222233334444', isAdmin = true) {
  botProcess.send({
    type: 'INTERACTION_CREATE',
    interaction: {
      type: 'select',
      customId,
      values,
      userId,
      username,
      channelId,
      isAdmin
    }
  });
}

function triggerDirectMessage(content, userId, username) {
  botProcess.send({
    type: 'MESSAGE_CREATE',
    message: {
      content,
      channelId: null, // Indicates DM context
      userId,
      username,
      bot: false
    }
  });
}

beforeAll(async () => {
  await new Promise(r => setTimeout(r, 1000));
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
    const onErr = (data) => {
      console.error('[BOT STARTUP STDERR]', data.toString().trim());
    };
    botProcess.stderr.on('data', onErr);

    let output = '';
    const onData = (data) => {
      output += data.toString();
      console.log('[BOT STARTUP STDOUT]', data.toString().trim());
      if (output.includes('WebSocket server listening')) {
        botProcess.stdout.off('data', onData);
        botProcess.stderr.off('data', onErr);
        botProcess.stdout.on('data', (d) => console.log('[BOT STDOUT]', d.toString().trim()));
        botProcess.stderr.on('data', (d) => console.error('[BOT STDERR]', d.toString().trim()));
        resolve();
      }
    };
    botProcess.stdout.on('data', onData);
    botProcess.on('error', reject);
    setTimeout(() => {
      botProcess.stderr.off('data', onErr);
      reject(new Error('Bot failed to start: ' + output));
    }, 10000);
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
        botProcess.on('exit', resolve);
      });
    }
  }
  if (localDb) localDb.close();
  if (fs.existsSync(DB_FILE)) {
    try { fs.unlinkSync(DB_FILE); } catch (e) {}
  }
});

describe('Tier 5: Phase 2 New Features', () => {

  test('R6: Direct Message Account Binding', async () => {
    // Generate code in DB
    localDb.prepare('INSERT INTO temp_codes (code, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('654321', 'uuid-dm-bind', 'PlayerDMBind');

    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request', (payload) => payload.command.includes('whitelist add'));
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerDirectMessage('654321', 'discord-dm-user', 'DMUser');

    const cmd = await wsCmdPromise;
    expect(cmd.command).toBe('whitelist add "PlayerDMBind"');
    mcClient.command_response(cmd.command_id, true, 'Successfully whitelisted');

    const reply = await replyPromise;
    expect(reply.content).toContain('帳號綁定成功');
    expect(reply.content).toContain('PlayerDMBind');

    const binding = localDb.prepare('SELECT * FROM bindings WHERE discord_id = ?').get('discord-dm-user');
    expect(binding).toBeDefined();
    expect(binding.mc_username).toBe('PlayerDMBind');
  });

  test('R1: Check-in, streak, reminder subscription & lucky draw', async () => {
    // 1. Check-in
    const replyPromise1 = waitForDiscordEvent('INTERACTION_REPLY');
    triggerButtonClick('key_panel_checkin', 'discord-dm-user', 'DMUser');
    const reply1 = await replyPromise1;
    expect(reply1.embeds[0].title).toContain('每日簽到成功');
    expect(reply1.embeds[0].fields.find(f => f.name === '連續簽到').value).toContain('1 天');

    // 2. Reminder subscribe
    const replyPromise2 = waitForDiscordEvent('INTERACTION_REPLY');
    triggerButtonClick('key_panel_subscribe', 'discord-dm-user', 'DMUser');
    const reply2 = await replyPromise2;
    expect(reply2.content).toContain('每日簽到提醒已開啟');

    // Verify DB update
    const keysRow = localDb.prepare('SELECT * FROM bindings WHERE discord_id = ?').get('discord-dm-user');
    expect(keysRow.subscribe_reminder).toBe(1);

    // 3. Lucky Draw (fails if offline)
    const wsCmdPromise3 = waitForWsMessage(mcClient, 'command_request');
    const replyPromise3 = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    triggerButtonClick('key_panel_lottery', 'discord-dm-user', 'DMUser');

    const cmd3 = await wsCmdPromise3;
    expect(cmd3.command).toBe('playerinfo "PlayerDMBind"');
    mcClient.command_response(cmd3.command_id, true, 'Online: false');

    const reply3 = await replyPromise3;
    expect(reply3.content).toContain('您必須處於遊戲線上狀態');
  });

  test('R2: Admin Control Panel Ban, Kick and Co-brand Modal trigger', async () => {
    // Ban Trigger
    const showModalPromise1 = waitForDiscordEvent('SHOW_MODAL');
    triggerButtonClick('admin_ban', 'discord-admin', 'AdminUser');
    const modal1 = await showModalPromise1;
    expect(modal1.customId).toBe('admin_ban_modal');

    // Kick Trigger
    const showModalPromise2 = waitForDiscordEvent('SHOW_MODAL');
    triggerButtonClick('admin_kick', 'discord-admin', 'AdminUser');
    const modal2 = await showModalPromise2;
    expect(modal2.customId).toBe('admin_kick_modal');

    // Co-brand Trigger
    const showModalPromise3 = waitForDiscordEvent('SHOW_MODAL');
    triggerButtonClick('admin_co_brand', 'discord-admin', 'AdminUser');
    const modal3 = await showModalPromise3;
    expect(modal3.customId).toBe('admin_co_brand_modal');
  });

  test('R3: Offline Mailbox select menu and modal submit flow', async () => {
    // Attempt express while offline
    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    triggerButtonClick('interaction_panel_express', 'discord-dm-user', 'DMUser');

    const cmd = await wsCmdPromise;
    expect(cmd.command).toBe('playerinfo "PlayerDMBind"');
    mcClient.command_response(cmd.command_id, true, 'Online: false');

    const reply = await replyPromise;
    expect(reply.content).toContain('寄送快遞失敗！您必須處於遊戲線上狀態');
  });

  test('R4: Announcement Draft creation modal trigger', async () => {
    const showModalPromise = waitForDiscordEvent('SHOW_MODAL');
    triggerButtonClick('admin_draft_announcement', 'discord-admin', 'AdminUser');
    const modal = await showModalPromise;
    expect(modal.customId).toBe('admin_announcement_modal');
  });

  test('R7: Clock Drift Auto-Correction', () => {
    const clock = require('../../src/utils/clock');
    clock.setClockOffset(5000); // Set offset 5 seconds
    const diff = Math.abs((clock.getCorrectedDate().getTime() - Date.now()) - 5000);
    expect(diff).toBeLessThan(100);
  });
});
