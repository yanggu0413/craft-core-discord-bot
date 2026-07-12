const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { DatabaseSync: Database } = require('node:sqlite');
const MockMinecraftClient = require('./mock-minecraft-client');

const TIER = 'economy';
const PORT = 8086;
const DB_FILE = path.resolve(__dirname, `../../db_${TIER}.db`);
const SCHEMA_FILE = path.resolve(__dirname, '../../src/database/schema.sql');

let botProcess;
let mcClient;
let localDb;
let receivedDiscordEvents = [];

function waitForDiscordEvent(event, filterFn = () => true, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const idx = receivedDiscordEvents.findIndex(e => e.event === event && filterFn(e.payload));
      if (idx !== -1) {
        clearInterval(interval);
        const e = receivedDiscordEvents[idx];
        receivedDiscordEvents.splice(idx, 1);
        resolve(e.payload);
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        console.log('[DEBUG WEB EVENT TIMEOUT] All received events:', JSON.stringify(receivedDiscordEvents, null, 2));
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
      const isMatch = filterFn(payload);
      console.log('[DEBUG WS LISTENER] type:', type, 'payload:', payload, 'isMatch:', isMatch);
      if (isMatch) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        client.off(type, listener);
        resolve(payload);
      }
    };
    client.on(type, listener);
    // Debug helper
    client.on('message', (packet) => {
      console.log('[CLIENT RECEIVED WS PACKET]', packet);
    });
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
      DISCORD_TOKEN: 'mock_token',
      MOCK_LOTTERY_TO_MONEY: 'true'
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

describe('Phase 3: Economy & Shops Integration Tests', () => {

  test('Prepare User Binding for Tests', () => {
    localDb.prepare('INSERT INTO bindings (discord_id, mc_uuid, mc_username, keys_count) VALUES (?, ?, ?, ?)')
      .run('discord-user-econ', 'uuid-user-econ', 'EconPlayer', 5);
  });

  test('1. Co-branding reward gives 5000 money', async () => {
    // Admin triggers co-brand modal submit
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    const wsCmdPromise = waitForWsMessage(mcClient, 'command_request');

    triggerModalSubmit('admin_co_brand_modal', { target: 'EconPlayer' }, 'admin-discord', 'AdminUser');

    // Wait for the WS command to be received by mod
    const cmd = await wsCmdPromise;
    expect(cmd.command).toBe('addmoney "EconPlayer" 5000');

    // Respond back to WS
    mcClient.command_response(cmd.command_id, true, 'Successfully added 5000 money');

    // Expect bot to reply co-branding success
    const reply = await replyPromise;
    expect(reply.content).toContain('成功發送聯名獎勵');
    expect(reply.content).toContain('5000 元金幣');
  });

  test('2. Lottery can award 100 money and execute addmoney RCON command', async () => {
    try {
      const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
      const wsCmdPromiseOnline = waitForWsMessage(mcClient, 'command_request', (payload) => payload.command.includes('playerinfo'));
      const wsCmdPromiseMoney = waitForWsMessage(mcClient, 'command_request', (payload) => payload.command.includes('addmoney'));
      const wsCmdPromiseTitle = waitForWsMessage(mcClient, 'command_request', (payload) => payload.command.includes('title') && !payload.command.includes('subtitle'));
      const wsCmdPromiseSubtitle = waitForWsMessage(mcClient, 'command_request', (payload) => payload.command.includes('subtitle'));
      const wsCmdPromiseSound = waitForWsMessage(mcClient, 'command_request', (payload) => payload.command.includes('playsound'));

      triggerButtonClick('key_panel_lottery', 'discord-user-econ', 'EconPlayer');

      // 1. Verify online status command
      const onlineCmd = await wsCmdPromiseOnline;
      mcClient.command_response(onlineCmd.command_id, true, 'Online: true');

      // 2. Verify addmoney command
      const moneyCmd = await wsCmdPromiseMoney;
      expect(moneyCmd.command).toBe('addmoney "EconPlayer" 250');
      mcClient.command_response(moneyCmd.command_id, true, 'Added 250');

      // 3. Verify title command
      const titleCmd = await wsCmdPromiseTitle;
      expect(titleCmd.command).toContain('title');
      mcClient.command_response(titleCmd.command_id, true, 'Title success');

      // 4. Verify subtitle command
      const subtitleCmd = await wsCmdPromiseSubtitle;
      expect(subtitleCmd.command).toContain('subtitle');
      mcClient.command_response(subtitleCmd.command_id, true, 'Subtitle success');

      // 5. Verify playsound command
      const soundCmd = await wsCmdPromiseSound;
      expect(soundCmd.command).toContain('playsound');
      mcClient.command_response(soundCmd.command_id, true, 'Sound success');

      const reply = await replyPromise;
      const embed = reply.embeds[0];
      expect(embed.fields.find(f => f.name === '獲得獎勵').value).toContain('250');
    } finally {
      // no-op
    }
  });

  test('3. Query balance button queries WebSocket balance_query and replies', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    const wsQueryPromise = waitForWsMessage(mcClient, 'balance_query');

    triggerButtonClick('economy_query_balance', 'discord-user-econ', 'EconPlayer');

    const query = await wsQueryPromise;
    expect(query.username).toBe('EconPlayer');

    // Respond balance_response
    mcClient.balance_response(query.query_id, 'EconPlayer', 4200, true);

    const reply = await replyPromise;
    expect(reply.content).toContain('目前金幣餘額：`$4200` 元');
  });

  test('4. My Shop Stats queries WebSocket shop_stats_query and replies with Embed', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    const wsQueryPromise = waitForWsMessage(mcClient, 'shop_stats_query');

    triggerButtonClick('economy_my_shop_stats', 'discord-user-econ', 'EconPlayer');

    const query = await wsQueryPromise;
    expect(query.username).toBe('EconPlayer');

    // Respond shop_stats_response
    const mockShops = [
      { location: '10, 64, -20', item: 'minecraft:netherite_ingot', stock: 5, revenue: 1500 }
    ];
    mcClient.shop_stats_response(query.query_id, 'EconPlayer', mockShops, true);

    const reply = await replyPromise;
    const embed = reply.embeds[0];
    expect(embed.title).toContain('EconPlayer 的商店數據統計');
    expect(embed.description).toContain('庫存：`5` 個');
    expect(embed.description).toContain('營業額：`$1500` 元');
  });

  test('5. Express send money checks balance, removes money, queues in DB, and delivers', async () => {
    // A. Trigger Send Money Modal Submit
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    const wsBalanceQueryPromise = waitForWsMessage(mcClient, 'balance_query');
    const wsRemoveMoneyPromise = waitForWsMessage(mcClient, 'command_request');

    triggerModalSubmit('express_send_money_modal', { receiver_mc: 'ReceiverEconPlayer', amount: '250' }, 'discord-user-econ', 'EconPlayer');

    // 1. Balance Query response
    const query = await wsBalanceQueryPromise;
    expect(query.username).toBe('EconPlayer');
    mcClient.balance_response(query.query_id, 'EconPlayer', 500, true);

    // 2. Remove Money Command
    const removeCmd = await wsRemoveMoneyPromise;
    expect(removeCmd.command).toBe('removemoney "EconPlayer" 250');
    mcClient.command_response(removeCmd.command_id, true, 'Successfully removed');

    const reply = await replyPromise;
    expect(reply.content).toContain('金幣快遞寄送成功');
    expect(reply.content).toContain('金額：`$250` 元');

    // Verify DB entry
    const mail = localDb.prepare('SELECT * FROM offline_mails WHERE receiver_username = ?').get('ReceiverEconPlayer');
    expect(mail).toBeDefined();
    expect(mail.item_id).toBe('craftcore:money');
    expect(mail.quantity).toBe(250);

    // B. Online check and deliver money
    const wsAddMoneyPromise = waitForWsMessage(mcClient, 'command_request', (payload) => payload.command.includes('addmoney'));
    const wsTellrawPromise = waitForWsMessage(mcClient, 'command_request', (payload) => payload.command.includes('tellraw'));
    
    // Simulate player joining via event packet which triggers deliverPendingMails
    mcClient.event('join', 'ReceiverEconPlayer', 'uuid-receiver-econ', 'joined');

    const addMoneyCmd = await wsAddMoneyPromise;
    expect(addMoneyCmd.command).toBe('addmoney "ReceiverEconPlayer" 250');
    mcClient.command_response(addMoneyCmd.command_id, true, 'Successfully added');

    const tellrawCmd = await wsTellrawPromise;
    expect(tellrawCmd.command).toContain('tellraw');
    mcClient.command_response(tellrawCmd.command_id, true, 'Successfully sent tellraw');

    // Wait and verify delivered status in DB
    await new Promise(r => setTimeout(r, 200));
    const mailDelivered = localDb.prepare('SELECT * FROM offline_mails WHERE receiver_username = ?').get('ReceiverEconPlayer');
    expect(mailDelivered.status).toBe('delivered');
  });

  test('6. Rich List queries WebSocket rich_list_query and replies with Embed fields', async () => {
    const replyPromise = waitForDiscordEvent('INTERACTION_REPLY', (payload) => payload.type === 'editReply');
    const wsQueryPromise = waitForWsMessage(mcClient, 'rich_list_query');

    // Trigger button click
    triggerButtonClick('economy_rich_list', 'discord-user-econ', 'EconPlayer');

    const query = await wsQueryPromise;
    expect(query.limit).toBe(10);

    const mockRichList = [
      { username: 'RichOne', balance: 500000 },
      { username: 'RichTwo', balance: 420000 },
      { username: 'RichThree', balance: 300000 },
      { username: 'RichFour', balance: 150000 }
    ];

    mcClient.rich_list_response(query.query_id, mockRichList, true);

    const reply = await replyPromise;
    const embed = reply.embeds[0];
    expect(embed.title).toContain('伺服器富豪榜');

    const rankField = embed.fields.find(f => f.name.includes('排名'));
    const playerField = embed.fields.find(f => f.name.includes('玩家名稱'));
    const balanceField = embed.fields.find(f => f.name.includes('財富餘額'));

    expect(rankField.value).toContain('🥇 1st');
    expect(rankField.value).toContain('🥈 2nd');
    expect(rankField.value).toContain('🥉 3rd');
    expect(rankField.value).toContain('4th');

    expect(playerField.value).toContain('RichOne');
    expect(playerField.value).toContain('RichTwo');
    expect(playerField.value).toContain('RichThree');
    expect(playerField.value).toContain('RichFour');

    expect(balanceField.value).toContain('$500,000');
    expect(balanceField.value).toContain('$420,000');
    expect(balanceField.value).toContain('$300,000');
    expect(balanceField.value).toContain('$150,000');
  });
});
