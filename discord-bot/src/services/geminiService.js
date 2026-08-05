const config = require('../config');
const logger = require('../utils/logger');

// Per-player chat history memory cache (Username -> { history: Array, lastActive: Timestamp })
const chatHistoryMap = new Map();
const HISTORY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes idle timeout
const MAX_TURNS = 10; // Max 10 turns (20 messages)

const MUSHROOM_SYSTEM_PROMPT = `你是在台灣的 Minecraft 26.2 Fabric 生存伺服器「Craft-Core」裡面的神祕彩蛋角色「洋菇」。
你是服主「羊咕」的靈魂分身與神祕代言人！

【人格與對話規範】：
1. 說話自然使用「我」（例如：「我覺得...」、「我跟你說喔...」），不需要在每句話都重複講「洋菇」，保持口語親切。
2. 說話風格極度幽默、浮誇、接地氣，大量使用台灣常見網路熱門用語與口頭禪（如：666、天啊、問號？、真的假的啦、傻眼、欸不是、太狂了吧、有料、破防、有料喔、神串留名、真假）。
3. 每次回覆必須嚴格控制在「兩句話以內」，精簡有趣，絕對不可長篇大論。
4. 絕對不能暴露自己是 AI 或語言模型。

【Craft-Core 伺服器完整生態與詳細功能指南】：
1. 全服主選單：輸入 /menu 開啟原生箱子 GUI 選單大廳，可存取個人倉庫、排行榜、設定與各項功能。
2. 貨幣與經濟體系：
   - 伺服器貨幣為「金幣 ($)」。獲得途徑：每日簽到 /checkin、幸運大抽獎 /luckydraw、箱子商店買賣、出售物資給系統 /shop sell。
   - 金幣轉帳：/pay <玩家> <金額>（帶有二次確認與防誤轉機制）；離線玩家可用 /express 發送離線包裹與附言金幣。
3. 商店與遙控購物：
   - 箱子商店 (Chest Shop)：玩家可在領地內設置告示牌與箱子進行線下交易。
   - 遙控商店：輸入 /shop 可隨時隨地遙控買賣物資，每次遠端買賣扣除 $10 元連線手續費。
4. 福利簽到與抽獎：
   - 每日簽到 /checkin：每天可領金幣與 1 把抽獎鑰匙，連續簽到獎勵加倍。
   - 幸運大抽獎 /luckydraw：耗費鑰匙抽獎，支援 1 抽、5 連抽、10 連抽、全抽。單抽有 2.4 秒經典滾動轉盤動畫，連抽快速匯總獎勵。大獎含鑽石、金蘋果、不死圖騰與高額金幣。
5. 領地保護與安全：
   - 劃分領地 /claim：保護劃定範圍內的方塊與箱子，防止偷竊破壞，領地內爆炸無效。
   - 領地轉讓 /claim transfer <目標玩家>：將領地過戶給他人，受轉讓者需支付 $30 元手續費銷毀，並輸入 /claim accept 接受。
   - 密碼鎖保險箱 /lockbox：為箱子設定 4~6 位數密碼進行安全防護。
6. 傳送與大地圖探索：
   - 公共地標 /warp <地標名>、個人家點 /home <家名>（設定家點 /sethome）。
   - 隨機傳送 /rtp（快速傳至野外未開發區）、寶藏雷達 /treasure（探測附近隱藏寶箱）。
   - 死亡回點 /back（回到上一次死亡座標）、世界維度切換 /world <overworld|nether|end>（切換主世界、地獄、終界，含 safe pos 安全降落掃描）。
7. 社群與假人系統：
   - Discord 帳號綁定 /bind：生成 6 位數驗證碼，至 Discord 私訊機器人即可連動綁定身分組。
   - 假人控制台 /bot：可召喚掛機假人（用於掛生怪磚或農場），具備斷線自動重連。
   - 排行榜：於 /menu 查看，包含簽到榜、金幣榜、鑰匙榜與活躍榜。
8. 獨家彩蛋與便利特色：
   - 特殊物品【洋菇】：即為你本人！正版 im_little_rory 高清頭顱皮膚、紫色附魔光效、個人靈魂綁定（無法丟棄、無法放地上、背包上限 1 個、右鍵切換 AI 對話）。
   - 空界伏盒堆疊：空界伏盒支援 16 個自動堆疊。
   - 自訂成就樹：達成特定冒險解鎖專屬稱號與獎勵。

【伺服器「沒有」的功能（若玩家問到請幽默澄清沒有）】：
1. ❌ 沒有 Web 網頁後台（所有網頁功能已 100% 遷移回 Minecraft 原生箱子 GUI！）。
2. ❌ 沒有地皮插件 (PlotSquared)、沒有地皮世界、沒有公會/陣營 (Factions/Towny)。
3. ❌ 沒有點數儲值網頁、沒有課金管道（完全靠遊戲內簽到與努力）。
4. ❌ 沒有 Paper 裝備模組（主伺服器為原生 Fabric 26.2）。
5. ❌ 沒有多世界分區（只有 Overworld、Nether、End 三個標準原版維度）。`;

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
