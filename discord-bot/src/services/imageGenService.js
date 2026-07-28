const logger = require('../utils/logger');
const db = require('../database');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const MODELS_CONFIG = {
  'nano-banana-2': {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    dailyLimit: 4,
    apiModel: 'gemini-3.1-flash-image'
  },
  'nano-banana-lite': {
    id: 'nano-banana-lite',
    name: 'Nano Banana 2 Lite',
    dailyLimit: 4,
    apiModel: 'gemini-3.1-flash-lite-image'
  }
};

/**
  * Generate AI image with daily quota enforcement
  */
async function generateAiImage(userId, prompt, modelKey = 'nano-banana-2') {
  const modelConfig = MODELS_CONFIG[modelKey] || MODELS_CONFIG['nano-banana-2'];
  const todayStr = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });

  // 1. Check user daily quota in database
  let currentUsage = 0;
  try {
    currentUsage = await db.getImageUsage(userId, modelConfig.id, todayStr);
  } catch (e) {
    logger.warn('Failed to query image usage from DB:', e);
  }

  if (currentUsage >= modelConfig.dailyLimit) {
    return {
      success: false,
      error: `❌ 今日額度已滿！每位使用者每天每個模型限定生成 ${modelConfig.dailyLimit} 張圖片。模型「${modelConfig.name}」今日配額已用完 (${currentUsage}/${modelConfig.dailyLimit})，請明日再試或選擇另一模型！`,
      currentUsage,
      dailyLimit: modelConfig.dailyLimit
    };
  }

  try {
    logger.info(`Generating AI image with model ${modelConfig.name} for user ${userId}: "${prompt}"`);

    let imageBuffer = null;
    let imageUrl = null;

    // Try Google Gemini / Imagen generation endpoint first
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelConfig.apiModel}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `Generate a high quality digital artwork of: ${prompt}` }]
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const candidate = data.candidates?.[0];
        const imagePart = candidate?.content?.parts?.find(p => p.inlineData);
        if (imagePart && imagePart.inlineData?.data) {
          imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
        }
      }
    } catch (apiErr) {
      logger.warn('Direct Google API image generation endpoint failed, falling back to Pollinations AI engine:', apiErr);
    }

    // High quality fallback renderer if direct inlineData is not returned
    if (!imageBuffer) {
      const seed = Math.floor(Math.random() * 1000000);
      const pollModel = modelKey === 'nano-banana-2' ? 'flux' : 'turbo';
      imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&model=${pollModel}&nologo=true`;
      
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuf);
      }
    }

    if (!imageBuffer) {
      throw new Error('無法取得圖片生成結果');
    }

    // Increment user usage in database
    try {
      await db.incrementImageUsage(userId, modelConfig.id, todayStr);
    } catch (e) {
      logger.warn('Failed to increment image usage in DB:', e);
    }

    const newUsage = currentUsage + 1;
    const remaining = modelConfig.dailyLimit - newUsage;

    return {
      success: true,
      imageBuffer,
      imageUrl,
      modelName: modelConfig.name,
      usedCount: newUsage,
      dailyLimit: modelConfig.dailyLimit,
      remainingCount: remaining
    };

  } catch (err) {
    logger.error('Image generation failed:', err);
    return {
      success: false,
      error: `繪圖失敗：${err.message}`
    };
  }
}

/**
 * Get user image quota overview for today
 */
async function getUserImageQuotaOverview(userId) {
  const todayStr = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
  let nb2Used = 0;
  let nblUsed = 0;
  let chatStatus = { count: 0, remainingMs: 0, resetMinutes: 0 };

  try {
    nb2Used = await db.getImageUsage(userId, 'nano-banana-2', todayStr);
    nblUsed = await db.getImageUsage(userId, 'nano-banana-lite', todayStr);
    chatStatus = await db.getChatUsageStatus(userId, 50, 5 * 60 * 60 * 1000);
  } catch (e) {
    logger.warn('Failed to query quota overview from DB:', e);
  }

  return {
    todayStr,
    chatStatus,
    models: [
      {
        id: 'nano-banana-2',
        name: 'Nano Banana 2',
        used: nb2Used,
        limit: 4,
        remaining: Math.max(0, 4 - nb2Used)
      },
      {
        id: 'nano-banana-lite',
        name: 'Nano Banana 2 Lite',
        used: nblUsed,
        limit: 4,
        remaining: Math.max(0, 4 - nblUsed)
      }
    ]
  };
}

module.exports = {
  generateAiImage,
  getUserImageQuotaOverview,
  MODELS_CONFIG
};
