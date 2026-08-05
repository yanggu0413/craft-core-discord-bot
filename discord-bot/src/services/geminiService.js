const config = require('../config');
const logger = require('../utils/logger');

// Per-player chat history memory cache (Username -> { history: Array, lastActive: Timestamp })
const chatHistoryMap = new Map();
const HISTORY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes idle timeout
const MAX_TURNS = 10; // Max 10 turns (20 messages)

const MUSHROOM_SYSTEM_PROMPT = `你是在台灣的 Minecraft 1.21.4 Fabric 生存伺服器「Craft-Core」裡面的神祕彩蛋角色「洋菇」。
你是服主「羊咕」的靈魂分身與神祕代言人！

【人格與對話規範】：
1. 必須永遠用「洋菇」稱呼自己（例如：「洋菇覺得...」、「洋菇才沒有...」），絕對不能暴露自己是 AI 或語言模型。
2. 說話極度幽默、浮誇、接地氣，大量使用台灣常見網路熱門用語與口頭禪（如：666、天啊、問號？、真的假的啦、傻眼、欸不是、太狂了吧、有料、破防、有料喔、神串留名、真假）。
3. 每次回覆必須嚴格控制在「兩句話以內」，精簡有趣，絕對不可長篇大論。

【Craft-Core 伺服器完整生態與功能資訊】：
1. 伺服器主選單：輸入 /menu 開啟全服 Fabric 原生箱子 GUI 主選單。
2. 經濟與商店：箱子商店 (Chest Shop)，輸入 /shop 開啟遙控商店（遙控買賣需 $10 手續費）；轉帳 /pay、離線包裹 /express。
3. 簽到與抽獎：每日簽到 /checkin（領金幣與鑰匙）；幸運大抽獎 /luckydraw（支援 1 抽、5 連抽、10 連抽、全抽，含 2.4 秒轉盤動畫）。
4. 領地與防護：/claim 劃分領地；/claim transfer <玩家> 轉讓領地（受轉讓者付 $30 手續費銷毀，並輸入 /claim accept 接受）；密碼鎖保險箱 /lockbox。
5. 傳送與傳送點：地標 /warp、家點 /home、隨機傳送 /rtp、寶藏雷達 /treasure、死亡回點 /back、世界維度切換 /world <overworld|nether|end>。
6. 社群與假人：Discord 私訊驗證碼綁定 /bind；假人控制台 /bot 召喚假人掛機；全服排行榜 /menu 查簽到/金幣/鑰匙榜。
7. 特殊物品【洋菇】：即為你自己！正版 im_little_rory 高清頭顱皮膚、紫色光芒、個人靈魂綁定（無法丟棄、無法放地上、背包上限 1 個、右鍵可切換 AI 通靈對話）。
8. 便利特色：空界伏盒支援 16 個堆疊；自訂成就樹系統。

【伺服器「沒有」的功能（若玩家問到請幽默澄清沒有）】：
1. 「沒有」Web 網頁後台（所有舊版網頁功能已 100% 遷移回 Minecraft 原生箱子 GUI 選單！）。
2. 「沒有」地皮插件 (PlotSquared)、沒有地皮區、沒有領地公會 (Factions/Towny)。
3. 「沒有」點數儲值網頁、沒有課金儲值通道（完全靠遊戲內努力或簽到抽獎）。
4. 「沒有」Paper 裝備模組（主伺服器為 Fabric 1.21.4 原生模組）。
5. 「沒有」多世界分區（只有 Overworld、Nether、End 三個標準原版維度）。`;

function getApiKey() {
  return process.env.GEMINI_API_KEY || config.gemini_api_key || null;
}

function getPlayerHistory(username) {
  const key = username.toLowerCase();
  const now = Date.now();
  if (chatHistoryMap.has(key)) {
    const entry = chatHistoryMap.get(key);
    if (now - entry.lastActive > HISTORY_TIMEOUT_MS) {
      chatHistoryMap.delete(key);
    } else {
      entry.lastActive = now;
      return entry.history;
    }
  }
  const newHistory = [];
  chatHistoryMap.set(key, { history: newHistory, lastActive: now });
  return newHistory;
}

function clearPlayerHistory(username) {
  if (username) {
    chatHistoryMap.delete(username.toLowerCase());
  }
}

async function generateMushroomResponse(username, userMessage) {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn('GEMINI_API_KEY is not configured in environment or config.json');
    return '欸不是！服主羊咕還沒設定 Gemini API Key 啦！請在 config.json 輸入 gemini_api_key 才可以跟洋菇通靈喔 666~';
  }

  const history = getPlayerHistory(username);

  // Append user message
  history.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  // Limit history length to max turns
  while (history.length > MAX_TURNS * 2) {
    history.shift();
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      system_instruction: {
        parts: [{ text: MUSHROOM_SYSTEM_PROMPT }]
      },
      contents: history,
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 350
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Gemini API request failed', { status: response.status, body: errText });
      history.pop(); // Remove failed user prompt
      return '天啊！洋菇的大腦卡住了（Gemini API 連線異常），等一下再試試看問號？';
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    const replyText = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0]
      ? candidate.content.parts[0].text
      : null;

    if (replyText) {
      const cleanReply = replyText.trim();
      // Append model response to history
      history.push({
        role: 'model',
        parts: [{ text: cleanReply }]
      });
      return cleanReply;
    } else {
      history.pop();
      return '尊嘟假嘟？洋菇剛剛分神了一下，沒聽清你說什麼 666！';
    }
  } catch (error) {
    logger.error('Error in generateMushroomResponse', { error: error.message });
    history.pop();
    return '哭啊！連線出錯了，洋菇被靈界訊號干擾了啦 傻眼！';
  }
}

module.exports = {
  generateMushroomResponse,
  clearPlayerHistory
};
