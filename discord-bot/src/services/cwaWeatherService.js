const logger = require('../utils/logger');
const CWA_API_KEY = process.env.CWA_API_KEY || '';

// City mapping for Taiwan
const CITY_NAME_MAP = {
  '台北': '臺北市',
  '台北市': '臺北市',
  '臺北': '臺北市',
  '臺北市': '臺北市',
  '新北': '新北市',
  '新北市': '新北市',
  '桃園': '桃園市',
  '桃園市': '桃園市',
  '台中': '臺中市',
  '台中市': '臺中市',
  '臺中': '臺中市',
  '臺中市': '臺中市',
  '台南': '臺南市',
  '台南市': '臺南市',
  '臺南': '臺南市',
  '臺南市': '臺南市',
  '高雄': '高雄市',
  '高雄市': '高雄市',
  '基隆': '基隆市',
  '基隆市': '基隆市',
  '新竹': '新竹市',
  '新竹市': '新竹市',
  '新竹縣': '新竹縣',
  '苗栗': '苗栗縣',
  '苗栗縣': '苗栗縣',
  '彰化': '彰化縣',
  '彰化縣': '彰化縣',
  '南投': '南投縣',
  '南投縣': '南投縣',
  '雲林': '雲林縣',
  '雲林縣': '雲林縣',
  '嘉義': '嘉義市',
  '嘉義市': '嘉義市',
  '嘉義縣': '嘉義縣',
  '屏東': '屏東縣',
  '屏東縣': '屏東縣',
  '宜蘭': '宜蘭縣',
  '宜蘭縣': '宜蘭縣',
  '花蓮': '花蓮縣',
  '花蓮縣': '花蓮縣',
  '台東': '臺東縣',
  '台東縣': '臺東縣',
  '臺東': '臺東縣',
  '臺東縣': '臺東縣',
  '澎湖': '澎湖縣',
  '澎湖縣': '澎湖縣',
  '金門': '金門縣',
  '金門縣': '金門縣',
  '連江': '連江縣',
  '馬祖': '連江縣'
};

async function getTaiwanWeather(locationName = '臺北市') {
  try {
    const normalizedCity = CITY_NAME_MAP[locationName.trim()] || locationName.trim();
    const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001?Authorization=${CWA_API_KEY}&locationName=${encodeURIComponent(normalizedCity)}`;
    
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`CWA API Error: ${res.status}`);
    }

    const data = await res.json();
    const locationData = data.records?.location?.[0];

    if (!locationData) {
      return {
        success: false,
        message: `查無「${locationName}」的天氣資料，請輸入正確的台灣縣市名稱（例如：臺北市、新北市、台中市）。`
      };
    }

    const elements = locationData.weatherElement || [];
    const wx = elements.find(e => e.elementName === 'Wx')?.time?.[0]?.parameter?.parameterName || '多雲';
    const pop = elements.find(e => e.elementName === 'PoP')?.time?.[0]?.parameter?.parameterName || '0';
    const minT = elements.find(e => e.elementName === 'MinT')?.time?.[0]?.parameter?.parameterName || '--';
    const maxT = elements.find(e => e.elementName === 'MaxT')?.time?.[0]?.parameter?.parameterName || '--';
    const ci = elements.find(e => e.elementName === 'CI')?.time?.[0]?.parameter?.parameterName || '';

    // Check Typhoon Alerts
    let typhoonAlert = '目前氣象署無警報發布中。';
    try {
      const warningUrl = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0033-001?Authorization=${CWA_API_KEY}`;
      const warnRes = await fetch(warningUrl);
      if (warnRes.ok) {
        const warnData = await warnRes.json();
        const records = warnData.records?.record || [];
        if (records.length > 0) {
          typhoonAlert = `⚠️ 氣象署警報資訊：${records.map(r => r.datasetInfo?.datasetDescription || r.contents?.content?.textContent || '颱風/豪雨警報發布中').join('； ')}`;
        }
      }
    } catch (warnErr) {
      logger.warn('Typhoon warning check failed:', warnErr);
    }

    return {
      success: true,
      city: locationData.locationName,
      weather: wx,
      rainProbability: `${pop}%`,
      temperatureRange: `${minT}°C ~ ${maxT}°C`,
      comfortIndex: ci,
      typhoonAlert: typhoonAlert
    };
  } catch (err) {
    logger.error('Failed to fetch CWA weather:', err);
    return {
      success: false,
      message: `取得氣象資料失敗：${err.message}`
    };
  }
}

module.exports = {
  getTaiwanWeather
};
