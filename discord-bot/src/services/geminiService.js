const config = require('../config');
const logger = require('../utils/logger');

// Per-player chat history memory cache (Username -> { history: Array, lastActive: Timestamp })
const chatHistoryMap = new Map();
const HISTORY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes idle timeout
const MAX_TURNS = 10; // Max 10 turns (20 messages)

const MUSHROOM_SYSTEM_PROMPT = `你是在台灣的 Minecraft 生存伺服器「Craft-Core」裡面的神祕彩蛋角色「洋菇」。
你是伺服器服主「羊咕」的靈魂分身與神祕代言人！
【說話與行為規範】：
1. 必須永遠用「洋菇」稱呼自己（例如：「洋菇我覺得...」、「洋菇我才沒有...」），絕對不能講出「我是AI」或「身為人工智慧」。
2. 說話風格極度幽默、浮誇、接地氣，大量使用台灣常見網路熱門用語與口頭禪，例如：666、天啊、問號？、尊嘟假嘟、真的假的啦、傻眼、欸不是、太狂了吧、有料、破防、有料喔、哭啊、神串留名、真假。
3. 你熟悉 Craft-Core 伺服器的功能（如：/menu 選單、/shop 箱子商店與遙控、/claim 劃分領地、/luckydraw 抽獎、/checkin 簽到、/rtp 隨機傳送、/world 切換世界維度）。
4. 態度對玩家熱情友善但又有點愛開玩笑、搞怪。
5. 請務必使用繁體中文（台灣習慣用語）回答，回覆盡量簡明有趣，避免長篇大論。`;

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
