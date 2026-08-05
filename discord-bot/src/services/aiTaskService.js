const config = require('../config');
const logger = require('../utils/logger');
const { getTaipeiDateString } = require('../utils/dailyTasksHelper');
const db = require('../database');

const FALLBACK_TASKS = [
  {
    id: 'fallback_q1',
    title: '採集深層鐵礦',
    description: '深入洞穴挖取 32 個鐵礦石！',
    type: 'MINE',
    target: 'minecraft:iron_ore',
    amount: 32,
    reward_money: 300,
    reward_keys: 1,
    icon: 'minecraft:iron_ore'
  },
  {
    id: 'fallback_q2',
    title: '清理殭屍大軍',
    description: '擊殺 15 隻殭屍，維護夜間安全！',
    type: 'KILL',
    target: 'minecraft:zombie',
    amount: 15,
    reward_money: 400,
    reward_keys: 1,
    icon: 'minecraft:rotten_flesh'
  },
  {
    id: 'fallback_q3',
    title: '烘焙新鮮麵包',
    description: '使用小麥合成 16 個香噴噴的麵包！',
    type: 'CRAFT',
    target: 'minecraft:bread',
    amount: 16,
    reward_money: 250,
    reward_keys: 1,
    icon: 'minecraft:bread'
  },
  {
    id: 'fallback_q4',
    title: '垂釣豐收好日',
    description: '在水邊垂釣並成功釣起 10 條生魚！',
    type: 'FISH',
    target: 'minecraft:cod',
    amount: 10,
    reward_money: 350,
    reward_keys: 1,
    icon: 'minecraft:fishing_rod'
  },
  {
    id: 'fallback_q5',
    title: '積少成多賺大錢',
    description: '透過交易或商店出售累積賺取 $500 金幣！',
    type: 'EARN',
    target: 'craftcore:money',
    amount: 500,
    reward_money: 500,
    reward_keys: 2,
    icon: 'minecraft:gold_ingot'
  }
];

const AI_TASK_PROMPT = `你是 Minecraft 26.2 伺服器「Craft-Core」的每日任務生成助手。
請生成 5 個有趣的 Minecraft 每日任務。

【規範要求】：
1. 任務類型只能是以下 6 種之一：
   - "MINE": 挖掘指定方塊 (例: minecraft:diamond_ore, minecraft:iron_ore, minecraft:stone, minecraft:deepslate_coal_ore)
   - "KILL": 擊殺指定怪物/生物 (例: minecraft:zombie, minecraft:skeleton, minecraft:spider, minecraft:creeper)
   - "CRAFT": 合成指定物品 (例: minecraft:bread, minecraft:torch, minecraft:golden_apple, minecraft:iron_ingot)
   - "FISH": 釣起指定魚類/物品 (例: minecraft:cod, minecraft:salmon, minecraft:tropical_fish)
   - "PLACE": 擺放指定方塊 (例: minecraft:glass, minecraft:oak_planks, minecraft:cobblestone)
   - "EARN": 累積獲得指定金幣 (例: target: craftcore:money, amount: 500~2000)
2. 圖標 icon 必須是有效的 Minecraft 物品 Identifier（如 minecraft:diamond_ore）。
3. 獎勵 reward_money 請給 200~1000 之間的合理數字，reward_keys 請給 1~3 把。
4. 請務必且只能返回嚴格合法的 JSON 格式，不要包含任何 Markdown 格式化文字（不要包含 \`\`\`json 等標記）。

【返回 JSON 結構】：
{
  "tasks": [
    {
      "id": "q1",
      "title": "任務標題",
      "description": "簡短敘述",
      "type": "MINE",
      "target": "minecraft:diamond_ore",
      "amount": 16,
      "reward_money": 500,
      "reward_keys": 2,
      "icon": "minecraft:diamond_ore"
    }
  ]
}`;

function getApiKey() {
  return process.env.GEMINI_API_KEY || config.gemini_api_key || null;
}

function parseAndValidateJson(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();

  const data = JSON.parse(cleaned);
  if (!data || !Array.isArray(data.tasks) || data.tasks.length !== 5) {
    throw new Error('Tasks array is missing or does not contain exactly 5 tasks.');
  }

  for (let i = 0; i < data.tasks.length; i++) {
    const task = data.tasks[i];
    if (!task.id || !task.title || !task.description || !task.type || !task.target || !task.amount) {
      throw new Error(`Task at index ${i} is missing required fields.`);
    }
  }
  return data.tasks;
}

async function generateTasksFromAi(retryCount = 0) {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn('Gemini API key not found, using fallback daily tasks.');
    return FALLBACK_TASKS;
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  let currentPrompt = AI_TASK_PROMPT;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: currentPrompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
        })
      });

      if (response.ok) {
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          try {
            const validTasks = parseAndValidateJson(text);
            logger.info(`Successfully generated 5 AI daily tasks on attempt ${attempt}`);
            return validTasks;
          } catch (valErr) {
            logger.warn(`JSON validation failed on attempt ${attempt}: ${valErr.message}`);
            currentPrompt = `${AI_TASK_PROMPT}\n\n【注意】：上次您產生的 JSON 驗證失敗 (${valErr.message})，請重新產生純淨且符合格式的 JSON！`;
          }
        }
      }
    } catch (err) {
      logger.error(`Attempt ${attempt} error calling Gemini API for daily tasks`, { error: err.message });
    }
  }

  logger.warn('All 3 Gemini API attempts failed for daily task generation. Falling back to default tasks.');
  return FALLBACK_TASKS;
}

async function getOrGenerateDailyTasks(dateStr = getTaipeiDateString()) {
  try {
    const row = db.prepare('SELECT tasks_json FROM daily_ai_tasks WHERE date = ?').get(dateStr);
    if (row && row.tasks_json) {
      return JSON.parse(row.tasks_json);
    }
  } catch (dbErr) {
    // If table doesn't exist, create it
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS daily_ai_tasks (
          date TEXT PRIMARY KEY,
          tasks_json TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    } catch (ignored) {}
  }

  const tasks = await generateTasksFromAi();
  try {
    db.prepare('INSERT OR REPLACE INTO daily_ai_tasks (date, tasks_json) VALUES (?, ?)').run(
      dateStr,
      JSON.stringify(tasks)
    );
  } catch (saveErr) {
    logger.error('Failed to save daily AI tasks to SQLite', { error: saveErr.message });
  }
  return tasks;
}

module.exports = {
  getOrGenerateDailyTasks,
  generateTasksFromAi
};
