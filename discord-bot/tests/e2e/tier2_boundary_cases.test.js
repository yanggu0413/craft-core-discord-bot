const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { DatabaseSync: Database } = require('node:sqlite');
const MockMinecraftClient = require('./mock-minecraft-client');

const TIER = 'tier2';
const PORT = 8092;
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

function triggerUserMessage(content, userId, username, channelId = '1111222233334444', bot = false) {
  botProcess.send({
    type: 'MESSAGE_CREATE',
    message: {
      content,
      userId,
      username,
      channelId,
      bot
    }
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
        botProcess.stdout.on('data', (d) => console.log('[BOT STDOUT]', d.toString().trim()));
        botProcess.stderr.on('data', (d) => console.error('[BOT STDERR]', d.toString().trim()));
        resolve();
      }
    };
    botProcess.stdout.on('data', onData);
    botProcess.on('error', reject);
    setTimeout(() => reject(new Error('Bot failed to start: ' + output)), 10000);
  });

  // 3. Connect mock Minecraft server client
  botProcess.stdout.on('data', (data) => console.log('[BOT-STDOUT]', data.toString()));
  botProcess.stderr.on('data', (data) => console.error('[BOT-STDERR]', data.toString()));
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

describe('Tier 2: Boundary & Corner Cases (F1-F5)', () => {

  // === Feature 1: Account Binding & Whitelist Linkage ===

  test('F1-1: /綁定 command with non-existent code returns an error message', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('綁定', { '驗證碼': '999999' }, 'discord-user-f1-1', 'UserF1_1');

    const reply = await replyPromise;
    expect(reply.content).toContain('無效或已過期的驗證碼');
  });

  test('F1-2: /綁定 command with expired code (older than 5 minutes) deletes code and returns expiration error', async () => {
    const oldTime = new Date(Date.now() - 360000).toISOString();
    localDb.prepare('INSERT OR REPLACE INTO temp_codes (mc_uuid, mc_username, code, created_at) VALUES (?, ?, ?, ?)')
      .run('uuid-expired', 'ExpiredUser', '111222', oldTime);

    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('綁定', { '驗證碼': '111222' }, 'discord-user-f1-2', 'UserF1_2');

    const reply = await replyPromise;
    expect(reply.content).toContain('驗證碼已過期');

    const codeInDb = localDb.prepare('SELECT * FROM temp_codes WHERE code = ?').get('111222');
    expect(codeInDb).toBeUndefined();
  });

  test('F1-3: /綁定 command fails if the Discord user is already bound to another Minecraft player', async () => {
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-bound-already', 'uuid-bound-1', 'Bound1');

    const wsResponsePromise = waitForWsMessage(mcClient, 'bind_code_response');
    mcClient.bind_code_request('Bound2', 'uuid-bound-2');
    const response = await wsResponsePromise;

    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('綁定', { '驗證碼': response.code }, 'discord-bound-already', 'Bound1');

    const reply = await replyPromise;
    expect(reply.content).toContain('您的 Discord 帳號已經綁定');
  });

  test('F1-4: /綁定 command fails if the Minecraft UUID is already bound to another Discord user', async () => {
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-other-user', 'uuid-mc-bound', 'McBound');

    const wsResponsePromise = waitForWsMessage(mcClient, 'bind_code_response');
    mcClient.bind_code_request('McBound', 'uuid-mc-bound');
    const response = await wsResponsePromise;

    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('綁定', { '驗證碼': response.code }, 'discord-new-user', 'NewUser');

    const reply = await replyPromise;
    expect(reply.content).toContain('已被其他 Discord 帳號綁定');
  });

  test('F1-5: /解除綁定 command when no binding exists returns a "not bound" error message', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('解除綁定', {}, 'discord-not-bound', 'NotBound');

    const reply = await replyPromise;
    expect(reply.content).toContain('您目前沒有綁定任何 Minecraft 帳號');
  });

  // === Feature 2: Bidirectional Chat & Event Sync ===

  test('F2-1: Discord-to-Game chat relay: user message in chat sync channel forwards to active WebSocket session', async () => {
    const wsChatPromise = waitForWsMessage(mcClient, 'chat');
    triggerUserMessage('Hello Minecraft from Discord!', 'discord-sender', 'DiscordSender', '1111222233334444');

    const chat = await wsChatPromise;
    expect(chat.sender).toBe('DiscordSender#1234');
    expect(chat.message).toBe('Hello Minecraft from Discord!');
  });

  test('F2-2: Discord-to-Game chat relay ignores messages sent by other bots', async () => {
    let received = false;
    const wsListener = () => { received = true; };
    mcClient.on('chat', wsListener);

    triggerUserMessage('Hello from bot!', 'discord-bot-sender', 'OtherBot', '1111222233334444', true);

    await new Promise(r => setTimeout(r, 300));
    mcClient.off('chat', wsListener);
    expect(received).toBe(false);
  });

  test('F2-3: Discord-to-Game chat relay ignores messages sent in non-sync channels', async () => {
    let received = false;
    const wsListener = () => { received = true; };
    mcClient.on('chat', wsListener);

    triggerUserMessage('Hello from general channel!', 'discord-sender', 'User', '9999888877776666', false);

    await new Promise(r => setTimeout(r, 300));
    mcClient.off('chat', wsListener);
    expect(received).toBe(false);
  });

  test('F2-4: Chat relay handles extremely long messages or special characters without crashing', async () => {
    const wsChatPromise = waitForWsMessage(mcClient, 'chat');
    const longMsg = '★'.repeat(500) + ' 𝒳𝒴𝒵';
    triggerUserMessage(longMsg, 'discord-sender', 'User', '1111222233334444');

    const chat = await wsChatPromise;
    expect(chat.message).toBe(longMsg);
  });

  test('F2-5: Game-to-Discord chat relay falls back to standard message send if webhook is misconfigured', async () => {
    const webPromise = waitForDiscordEvent('WEBHOOK_SEND');
    mcClient.chat('SteveF2_5', 'uuid-steve-f2-5', 'Fallback test');
    const web = await webPromise;
    expect(web.content).toBe('Fallback test');
  });

  // === Feature 3: Interactive Support Ticket System ===

  test('F3-1: /客服單 command fails with error if executed by non-administrator', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('客服單', {}, 'discord-user', 'RegularUser', '1111222233334444', false);

    const reply = await replyPromise;
    expect(reply.content).toContain('您無權限執行此指令');
  });

  test('F3-2: Clicking "close_ticket" on a channel not registered in DB returns error', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerButtonClick('close_ticket', 'discord-user', 'RegularUser', 'non-existent-channel-id');

    const reply = await replyPromise;
    expect(reply.content).toContain('此頻道不屬於有效的客服單');
  });

  test('F3-3: Ticket creation handles guild channel creation errors gracefully', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerButtonClick('create_ticket', 'discord-user-f3-3', 'UserF3_3');
    const reply = await replyPromise;
    expect(reply.content).toContain('您的客服單已建立');
  });

  test('F3-4: Ticket transcript generation doesn\'t crash if channel has no message history', async () => {
    const channelPromise = waitForDiscordEvent('CHANNEL_CREATE');
    triggerButtonClick('create_ticket', 'discord-user-f3-4', 'UserF3_4');
    const channel = await channelPromise;

    const deletePromise = waitForDiscordEvent('CHANNEL_DELETE');
    triggerButtonClick('close_ticket', 'discord-user-f3-4', 'UserF3_4', channel.id);

    await deletePromise;
  });

  test('F3-5: Ticket service handles missing ticketLogs channel configuration without crashing', async () => {
    const channelPromise = waitForDiscordEvent('CHANNEL_CREATE');
    triggerButtonClick('create_ticket', 'discord-user-f3-5', 'UserF3_5');
    const channel = await channelPromise;

    const deletePromise = waitForDiscordEvent('CHANNEL_DELETE');
    triggerButtonClick('close_ticket', 'discord-user-f3-5', 'UserF3_5', channel.id);

    await deletePromise;
  });

  // === Feature 4: Server Status Monitoring ===

  test('F4-1: status packet handled when status channel configuration is missing', async () => {
    mcClient.status({ online: true });
    await new Promise(r => setTimeout(r, 200));
  });

  test('F4-2: status packet with online=false updates status embed to offline', async () => {
    const msgPromise = waitForDiscordEvent('MESSAGE_EDIT');
    mcClient.status({ online: false });

    const msg = await msgPromise;
    const statusField = msg.embeds[0].fields.find(f => f.name === '伺服器狀態');
    expect(statusField.value).toContain('離線');
  });

  test('F4-3: status packet with unicode player names updates embed successfully', async () => {
    const msgPromise = waitForDiscordEvent('MESSAGE_EDIT');
    mcClient.status({ online: true, players: ['測試玩家1', 'Player★'] });

    const msg = await msgPromise;
    const playersField = msg.embeds[0].fields.find(f => f.name === '在線玩家');
    expect(playersField.value).toContain('測試玩家1');
    expect(playersField.value).toContain('Player★');
  });

  test('F4-4: status packet handles extreme TPS values (e.g. 25.00 or -1.0) gracefully', async () => {
    const msgPromise = waitForDiscordEvent('MESSAGE_EDIT');
    mcClient.status({ online: true, tps: 25.00 });

    const msg = await msgPromise;
    const tpsField = msg.embeds[0].fields.find(f => f.name === 'TPS');
    expect(tpsField.value).toContain('25.00');
  });

  test('F4-5: status update does not crash if history fetch fails', async () => {
    mcClient.status({ online: true });
    await new Promise(r => setTimeout(r, 200));
  });

  // === Feature 5: Admin Command Forwarding & Capture ===

  test('F5-1: /封鎖 command fails with permission error if executed by non-admin', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('封鎖', { '玩家名稱': 'Steve', '原因': 'grief' }, 'discord-user', 'User', '1111222233334444', false);

    const reply = await replyPromise;
    expect(reply.content).toContain('您無權限執行此指令');
  });

  test('F5-2: /踢出 command fails with permission error if executed by non-admin', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('踢出', { '玩家名稱': 'Steve', '原因': 'spam' }, 'discord-user', 'User', '1111222233334444', false);

    const reply = await replyPromise;
    expect(reply.content).toContain('您無權限執行此指令');
  });

  test('F5-3: /玩家資訊 command fails with permission error if executed by non-admin', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('玩家資訊', { '查詢內容': 'Steve' }, 'discord-user', 'User', '1111222233334444', false);

    const reply = await replyPromise;
    expect(reply.content).toContain('您無權限執行此指令');
  });

  test('F5-4: command execution fails instantly if MC server is not active', async () => {
    const closePromise = new Promise(resolve => {
      mcClient.once('close', resolve);
    });
    mcClient.close();
    await closePromise;
    await new Promise(r => setTimeout(r, 500));

    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.content !== undefined && payload.content !== null);
    triggerSlashCommand('封鎖', { '玩家名稱': 'Steve', '原因': 'steal' }, 'discord-admin', 'AdminUser');

    const reply = await replyPromise;
    expect(reply.content).toContain('Minecraft 伺服器目前未連線');

    mcClient = new MockMinecraftClient(`ws://localhost:${PORT}`, `secret_${TIER}`);
    await mcClient.connect();
    // Wait for the new session to be fully registered in the bot process
    await new Promise(r => setTimeout(r, 500));
  });

  test('F5-5: command execution times out after 500ms if MC does not respond, returning error', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    triggerSlashCommand('封鎖', { '玩家名稱': 'NoReplyUser', '原因': 'grief' }, 'discord-admin', 'AdminUser');

    const reply = await replyPromise;
    expect(reply.content).toContain('指令執行超時');
  });

  test('F5-6 (Robustness): /封鎖 rejects newline command injection inputs in username', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    triggerSlashCommand('封鎖', { '玩家名稱': "Steve\nop admin", '原因': 'grief' }, 'discord-admin', 'AdminUser');

    const reply = await replyPromise;
    expect(reply.content).toContain('玩家名稱包含無效字元');
  });

  test('F5-6b (Robustness): /封鎖 safely quotes spaces and semicolons in username', async () => {
    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    triggerSlashCommand('封鎖', { '玩家名稱': 'Steve; op admin', '原因': 'grief' }, 'discord-admin', 'AdminUser');

    const cmd = await wsCmdPromise;
    expect(cmd.command).toBe('ban "Steve; op admin" grief');
    mcClient.command_response(cmd.command_id, true, 'Banned "Steve; op admin"');

    const reply = await replyPromise;
    expect(reply.content).toContain('成功封鎖玩家 `Steve; op admin`');
  });

  test('F5-7 (Robustness): /客服單 handles DM context (null member) gracefully without throwing TypeError', async () => {
    botProcess.send({
      type: 'INTERACTION_CREATE',
      interaction: {
        type: 'slash',
        name: '客服單',
        options: {},
        userId: 'discord-user-dm',
        username: 'UserDM',
        channelId: '1111222233334444',
        isAdmin: true,
        isDM: true
      }
    });

    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY');
    const reply = await replyPromise;
    expect(reply.content).toContain('此指令只能在伺服器頻道中使用。');
  });

  test('F5-8 (Robustness): lookup and unlinking operations are case-insensitive', async () => {
    localDb.prepare('INSERT OR REPLACE INTO bindings (discord_id, mc_uuid, mc_username) VALUES (?, ?, ?)')
      .run('discord-steve-case', 'uuid-steve-case', 'SteveCase');

    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    triggerSlashCommand('玩家資訊', { '查詢內容': 'stevecase' }, 'discord-admin', 'AdminUser');

    const cmd = await wsCmdPromise;
    mcClient.command_response(cmd.command_id, true, 'Online: true, LastOnline: 2026-07-08 19:00:00, Coords: X: 5, Y: 10, Z: 15, Dimension: Overworld');

    const reply = await replyPromise;
    expect(reply.embeds[0].title).toContain('玩家詳細資訊');
    expect(reply.embeds[0].fields.find(f => f.name === 'Minecraft 玩家名').value).toContain('SteveCase');
    expect(JSON.stringify(reply.embeds[0])).not.toContain('uuid-steve-case');

    localDb.prepare("DELETE FROM bindings WHERE mc_username = 'stevecase' COLLATE NOCASE").run();
    const binding = localDb.prepare("SELECT * FROM bindings WHERE mc_username = 'SteveCase'").get();
    expect(binding).toBeUndefined();
  });

});
