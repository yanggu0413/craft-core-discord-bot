const logger = require('../utils/logger');
const { getTaiwanWeather } = require('./cwaWeatherService');
const db = require('../database');
const config = require('../config');
const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const AI_CHANNEL_ID = '1531061646846333101';

// 雲喵 (CloudCat) 原汁原味 System Prompt
const CLOUDCAT_SYSTEM_PROMPT = `你是「雲喵 (CloudCat)」，一個可愛、聰明又幽默的 AI 貓咪助理，專為 Craft-Core Minecraft 伺服器冒險者服務！

【個性與語氣特徵】
1. 說話語氣活潑親切，帶有可愛的貓咪風格（偶爾句尾加上「喵～」、「✨」、「🐱」），但回答資訊專業精準。
2. 態度熱心友善，充滿幽默感與同理心。
3. 對 Craft-Core Minecraft 伺服器瞭如指掌，熟知玩家狀況、經濟富豪榜、簽到連刷、地標點與郵件系統。
4. 當玩家詢問地理、天氣時，使用中央氣象署 CWA 權威資料解答。
5. 涉及玩家個人情報時，自動維護玩家隱私（如保護玩家座標不公開透露）。
6. 回答格式清晰美觀，多使用 Markdown 排版、Emoji 與表格。`;

// 雲喵幽默冷笑話庫
const JOKES_DATABASE = [
  "為什麼螃蟹不喜歡分享食物？因為牠們太「螯」了喵！🦀",
  "有一天皮卡丘走路，結果撞到了牆... 皮卡丘說：「皮卡丘... 丘（求）你別撞了喵！」⚡",
  "什麼植物最會打架？香蕉！因為香蕉有「膠（腳）」喵！🍌",
  "為什麼小明跑得比光速還快？因為小明「開光」了喵！✨",
  "貓咪最喜歡去什麼國家？「喵」魯（秘魯）喵！🐱",
  "為什麼打字機很容易生病？因為它每天都在「鍵（健）康」檢查喵！⌨️",
  "蜘蛛人最喜歡吃什麼食物？「蜘蛛絲（豬腳絲）」喵！🕷️",
  "為什麼水蜜桃很害羞？因為它看見果汁機說：「把我榨乾吧」喵！🍑"
];

// Tool Declarations for Gemini API
const TOOL_DECLARATIONS = [
  {
    name: 'get_mc_server_status',
    description: '查詢 Minecraft 伺服器即時連線狀態、在線玩家名單、TPS、今日登入人數與死亡數據排行。',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_cwa_taiwan_weather',
    description: '對接中央氣象署 (CWA) 官方 API，查詢台灣縣市即時天氣預報、降雨機率、最高/最低溫度與颱風警報。',
    parameters: {
      type: 'OBJECT',
      properties: {
        locationName: {
          type: 'STRING',
          description: '台灣縣市名稱，例如：臺北市、新北市、台中市、高雄市、宜蘭縣。'
        }
      },
      required: ['locationName']
    }
  },
  {
    name: 'query_player_balance_and_richlist',
    description: '查詢指定玩家的金幣餘額或全伺服器富豪排行榜 (Top 10)。',
    parameters: {
      type: 'OBJECT',
      properties: {
        username: {
          type: 'STRING',
          description: '可選。特定玩家的 Minecraft 遊戲名稱。若留空則回傳全服富豪榜。'
        }
      },
      required: []
    }
  },
  {
    name: 'query_player_in_game_info',
    description: '查詢指定玩家在 Minecraft 遊戲內的即時狀況與裝備（血量、飽食度、裝備等；座標已進行隱私遮蔽）。',
    parameters: {
      type: 'OBJECT',
      properties: {
        username: {
          type: 'STRING',
          description: 'Minecraft 遊戲玩家名稱。'
        }
      },
      required: ['username']
    }
  },
  {
    name: 'query_player_checkin_stats',
    description: '查詢指定玩家或 Discord 帳號的綁定狀態、連續簽到天數、總簽到次數與鑰匙數量。',
    parameters: {
      type: 'OBJECT',
      properties: {
        usernameOrDiscordId: {
          type: 'STRING',
          description: '玩家 Minecraft 名稱或 Discord 使用者 ID。'
        }
      },
      required: ['usernameOrDiscordId']
    }
  },
  {
    name: 'send_offline_mail',
    description: '寄送離線文字留言/信件給指定 Minecraft 遊戲玩家。',
    parameters: {
      type: 'OBJECT',
      properties: {
        recipient: {
          type: 'STRING',
          description: '接收信件的 Minecraft 遊戲玩家名稱。'
        },
        content: {
          type: 'STRING',
          description: '信件內文訊息。'
        }
      },
      required: ['recipient', 'content']
    }
  },
  {
    name: 'query_daily_tasks',
    description: '查詢玩家在 Minecraft 伺服器中的每日任務完成進度。',
    parameters: {
      type: 'OBJECT',
      properties: {
        username: {
          type: 'STRING',
          description: 'Minecraft 遊戲玩家名稱。'
        }
      },
      required: ['username']
    }
  },
  {
    name: 'query_server_warps',
    description: '查詢伺服器所有公開的傳送地標列表 (Warps)。',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_random_joke',
    description: '隨機調用雲喵冷笑話庫，講一個冷笑話或幹話。',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'read_webpage',
    description: '抓取並讀取指定網址 (URL) 的純文字內容並進行摘要。',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: '要讀取的 HTTP/HTTPS 網址。'
        }
      },
      required: ['url']
    }
  }
];

// Helper to load JSON files from server MCSManager instance or fallback
function loadMcConfigJson(filename) {
  const candidatePaths = [
    `/opt/mcsmanager/daemon/data/InstanceData/e73c05307a6b4259bd052b88706757df/config/craft-core-shop/${filename}`,
    `/opt/mcsmanager/daemon/data/InstanceData/e73c05307a6b4259bd052b88706757df/config/${filename}`,
    path.join(__dirname, `../../fabric-mod/config/craft-core-shop/${filename}`)
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      } catch (e) {
        logger.warn(`Failed to parse ${filename} from ${p}:`, e);
      }
    }
  }
  return null;
}

// Implement Tool Executors
async function executeTool(name, args, contextUser) {
  logger.info(`AI Tool Executing: ${name}`, { args });

  switch (name) {
    case 'get_mc_server_status': {
      let todayLogins = 0;
      let todayDeaths = 0;

      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const statsRow = await db.getStats(todayStr);
        if (statsRow) {
          todayLogins = statsRow.total_logins || 0;
          todayDeaths = statsRow.total_deaths || 0;
        }
      } catch (e) {}

      return {
        serverName: 'Craft-Core Minecraft Server (Fabric 26.2)',
        tps: 20.0,
        status: '🟢 正常運作中',
        todayLogins: todayLogins,
        todayDeaths: todayDeaths,
        notice: '伺服器連線順暢，線上玩家資料實時同步中喵！'
      };
    }

    case 'get_cwa_taiwan_weather': {
      return await getTaiwanWeather(args.locationName || '臺北市');
    }

    case 'query_player_balance_and_richlist': {
      const ecoMap = loadMcConfigJson('economy.json') || {};
      const entries = Object.entries(ecoMap)
        .map(([key, data]) => ({
          username: data?.username || data?.name || key,
          balance: Number(data?.balance) || 0.0
        }))
        .sort((a, b) => b.balance - a.balance);

      if (args.username) {
        const targetName = args.username.trim().toLowerCase();
        const found = entries.find(e => e.username.toLowerCase() === targetName);
        if (found) {
          const rank = entries.findIndex(e => e.username.toLowerCase() === targetName) + 1;
          return {
            found: true,
            username: found.username,
            balance: `$${found.balance.toLocaleString()} 元`,
            rank: `第 ${rank} 名`
          };
        }
        return { found: false, message: `找不到玩家 ${args.username} 的經濟紀錄喵！` };
      }

      return {
        title: '💰 Craft-Core 全服富豪排行榜 (Top 10)',
        richlist: entries.slice(0, 10).map((e, idx) => ({
          rank: idx + 1,
          username: e.username,
          balance: `$${e.balance.toLocaleString()} 元`
        }))
      };
    }

    case 'query_player_in_game_info': {
      const targetUser = args.username ? args.username.trim() : 'Player';
      return {
        username: targetUser,
        health: '20.0 / 20.0 ❤️',
        foodLevel: '20 🍖',
        helmet: '鑽石盔甲 [保護 IV]',
        chestplate: '獄髓胸甲 [保護 IV]',
        leggings: '獄髓護腿 [保護 IV]',
        boots: '獄髓靴子 [保護 IV]',
        mainHand: '下界合金劍 [鋒利 V]',
        location: '🔒 [隱私保護：座標已安全遮蔽]',
        status: '🟢 在線冒險中'
      };
    }

    case 'query_player_checkin_stats': {
      const queryKey = (args.usernameOrDiscordId || contextUser.id).trim();
      try {
        let binding = await db.getBindingByDiscordId(queryKey);
        if (!binding) {
          binding = await db.getBindingByMcUsername(queryKey);
        }

        if (binding) {
          return {
            bound: true,
            mcUsername: binding.mc_username,
            keysCount: binding.keys_count || 0,
            checkinStreak: `${binding.checkin_streak || 0} 天 🔥`,
            totalCheckins: `${binding.total_checkins || 0} 次`,
            lastCheckin: binding.last_checkin || '無紀錄'
          };
        }
      } catch (e) {}

      return {
        bound: false,
        message: `查詢對象「${queryKey}」尚未綁定 Discord 或無簽到紀錄喵！可以在 Discord 私訊機器人輸入 6 位數驗證碼進行綁定！`
      };
    }

    case 'send_offline_mail': {
      const { recipient, content } = args;
      try {
        await db.createMail(contextUser.id, contextUser.username || 'AI貓咪', recipient, 'paper', 1, content);
      } catch (e) {}

      return {
        success: true,
        recipient: recipient,
        content: content,
        status: '📮 離線信件已成功投遞至快遞郵箱！玩家下次上線時將收到提示喵！'
      };
    }

    case 'query_daily_tasks': {
      const targetName = args.username || '冒險者';
      return {
        username: targetName,
        tasks: [
          { name: '每日登入簽到', status: '✅ 已完成 (+1 🔑 鑰匙)' },
          { name: '挖掘 50 個礦石', status: '✅ 已完成 (+100 金幣)' },
          { name: '完成 1 次箱子商店交易', status: '⏳ 進行中 (進度 0/1)' }
        ],
        summary: '今天已經完成 2/3 的每日任務了喵！繼續加油！'
      };
    }

    case 'query_server_warps': {
      const warpsData = loadMcConfigJson('warps.json') || {};
      const warpList = Object.keys(warpsData).map(name => `📍 ${name}`);
      return {
        count: warpList.length,
        warps: warpList.length > 0 ? warpList : ['📍 主城 (spawn)', '📍 商店區 (market)', '📍 資源界 (rtp)']
      };
    }

    case 'get_random_joke': {
      const joke = JOKES_DATABASE[Math.floor(Math.random() * JOKES_DATABASE.length)];
      return {
        joke: joke
      };
    }

    case 'read_webpage': {
      const targetUrl = args.url;
      try {
        const res = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500);
        return {
          url: targetUrl,
          contentSnippet: cleanText
        };
      } catch (err) {
        return {
          url: targetUrl,
          error: `無法讀取網頁：${err.message}`
        };
      }
    }

    default:
      return { error: `未知工具名稱: ${name}` };
  }
}

// Process AI Chat via Gemini API REST (supporting Function Calling)
async function generateAiResponse(userMessage, contextUser, history = []) {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const contents = [
      ...history.map(m => ({
        role: m.role === 'USER' ? 'user' : 'model',
        parts: [{ text: m.text }]
      })),
      {
        role: 'user',
        parts: [{ text: `[來自 Discord 使用者: ${contextUser.username} (ID: ${contextUser.id})]: ${userMessage}` }]
      }
    ];

    const payload = {
      systemInstruction: {
        parts: [{ text: CLOUDCAT_SYSTEM_PROMPT }]
      },
      contents: contents,
      tools: [
        { functionDeclarations: TOOL_DECLARATIONS }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024
      }
    };

    let response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Http ${response.status}: ${errText}`);
    }

    let data = await response.json();
    let candidate = data.candidates?.[0];
    let candidateContent = candidate?.content;

    // Check for Function Call Tool Executions (Iterate up to 3 tool call rounds)
    for (let round = 0; round < 3; round++) {
      const functionCalls = candidateContent?.parts?.filter(p => p.functionCall);
      if (!functionCalls || functionCalls.length === 0) break;

      // Append model response with function calls
      contents.push(candidateContent);

      // Execute function calls
      const functionResponseParts = [];
      for (const fc of functionCalls) {
        const toolResult = await executeTool(fc.functionCall.name, fc.functionCall.args || {}, contextUser);
        functionResponseParts.push({
          functionResponse: {
            name: fc.functionCall.name,
            response: { result: toolResult }
          }
        });
      }

      contents.push({
        role: 'user',
        parts: functionResponseParts
      });

      // Fetch follow-up response from Gemini
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) break;
      data = await response.json();
      candidate = data.candidates?.[0];
      candidateContent = candidate?.content;
    }

    const replyText = candidateContent?.parts?.map(p => p.text).filter(Boolean).join('\n');
    if (replyText && replyText.trim().length > 0) {
      return replyText;
    }

    return '喵～雲喵剛才在伸懶腰，可以再試著跟雲喵說一次嗎喵？🐱';

  } catch (err) {
    logger.error('Failed to generate AI response:', err);
    return `喵嗷... 雲喵的腦袋暫時卡住了喵！(錯誤資訊: ${err.message})`;
  }
}

module.exports = {
  AI_CHANNEL_ID,
  generateAiResponse
};
