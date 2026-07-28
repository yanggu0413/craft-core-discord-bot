#!/usr/bin/env node
/**
 * ☁️ 雲喵 (CloudCat) 底層數據與 Function Calling 偵錯 CLI
 * 
 * 使用方式：
 *   node test-cloudcat-cli.js "你的提問"
 *   node test-cloudcat-cli.js --dump-db
 *   node test-cloudcat-cli.js --inspect-user <discordId>
 */

const path = require('path');
const fs = require('fs');

const envPath = fs.existsSync('/root/craft-core/discord-bot/.env')
  ? '/root/craft-core/discord-bot/.env'
  : path.join(__dirname, 'discord-bot/.env');

try {
  require('dotenv').config({ path: envPath });
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {}

// Fallback envs for config validation in CLI mode
process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'cli_debug_token';
process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'dummy_client';
process.env.DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || 'dummy_guild';
process.env.WEBSOCKET_SECRET = process.env.WEBSOCKET_SECRET || 'c34fc25b90a6ea1d38e2bc79679fbc9d';

const dbPath = fs.existsSync('/root/craft-core/discord-bot/src/database/database.db')
  ? '/root/craft-core/discord-bot/src/database/database.db'
  : path.join(__dirname, 'discord-bot/src/database/database.db');

const db = require('./discord-bot/src/database');
const aiService = require('./discord-bot/src/services/aiService');
const imageGenService = require('./discord-bot/src/services/imageGenService');

async function runCli() {
  await db.init(dbPath);

  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help') {
    console.log(`
┌─────────────────────────────────────────────────────────────┐
│ ☁️  雲喵 (CloudCat) 底層數據與診斷測試 CLI                     │
└─────────────────────────────────────────────────────────────┘

使用說明:
  node test-cloudcat-cli.js "提問內容"             對雲喵進行提問，並觀察 Tool 調用與回覆
  node test-cloudcat-cli.js --dump-db              輸出 SQLite 所有表格統計數據
  node test-cloudcat-cli.js --inspect-user <ID>    查詢特定使用者的 5 小時訊息數與 AI 生圖額度
  node test-cloudcat-cli.js --mc-config            讀取並檢查 Minecraft 伺服器 JSON 檔 (shops, warps, claims)

範例:
  node test-cloudcat-cli.js "請查詢台中天氣並算 123*456"
  node test-cloudcat-cli.js --inspect-user test_user_999
`);
    process.exit(0);
  }

  // Option 1: Dump DB stats
  if (command === '--dump-db') {
    console.log('\n📊 === SQLite 數據庫統計總覽 ===');
    const stats = await db.getStats();
    console.log(JSON.stringify(stats, null, 2));

    console.log('\n🎨 === 今日 AI 繪圖額度使用紀錄 ===');
    const todayStr = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
    const quotaRows = await db.getImageUsage('all', 'all', todayStr);
    console.log(`當前日期: ${todayStr}`);

    console.log('\n💬 === 5 小時滾動聊天紀錄 ===');
    const chatUsage = await db.getChatUsageStatus('all');
    console.log(JSON.stringify(chatUsage, null, 2));
    process.exit(0);
  }

  // Option 2: Inspect user
  if (command === '--inspect-user') {
    const userId = args[1] || 'test_user_999';
    console.log(`\n🔍 === 特定使用者數據診斷 [ID: ${userId}] ===`);
    const overview = await imageGenService.getUserImageQuotaOverview(userId);
    console.log(JSON.stringify(overview, null, 2));
    process.exit(0);
  }

  // Option 3: Inspect Minecraft configs
  if (command === '--mc-config') {
    console.log('\n🎮 === Minecraft 伺服器配置檔案檢查 ===');
    const mcDir = '/opt/mcsmanager/daemon/data/InstanceData/e73c05307a6b4259bd052b88706757df/config/craft-core-shop/';
    ['shops.json', 'warps.json', 'claims.json', 'economy.json'].forEach(file => {
      const p = path.join(mcDir, file);
      if (fs.existsSync(p)) {
        const stats = fs.statSync(p);
        console.log(`✅ [${file}] 存在 (大小: ${stats.size} bytes, 修改時間: ${stats.mtime.toLocaleString()})`);
      } else {
        console.log(`⚠️ [${file}] 檔案不存在於 ${p}`);
      }
    });
    process.exit(0);
  }

  // Default: Execute AI query with tool tracing
  const prompt = args.join(' ');
  console.log(`\n☁️ 雲喵收到的測試提問: "${prompt}"`);
  console.log('--------------------------------------------------');

  const contextUser = {
    id: 'cli_tester_001',
    username: '服主羊咕',
    displayName: '服主羊咕 (CLI)'
  };

  const startTime = Date.now();
  const reply = await aiService.generateAiResponse(
    prompt,
    contextUser,
    [],
    'cli_debug_channel',
    async (statusText) => {
      console.log(`[⚡ 動態狀態即時編輯]: ${statusText}`);
    }
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('--------------------------------------------------');
  console.log(`⏱️ 總執行時間: ${duration} 秒`);
  console.log('🐱 雲喵最終吐出的數據與回答:\n');
  console.log(reply);
  console.log('\n--------------------------------------------------');
  process.exit(0);
}

runCli().catch(err => {
  console.error('❌ CLI 執行異常:', err);
  process.exit(1);
});
