const logger = require('./logger');

let clockOffset = 0;

async function syncClock() {
  try {
    const start = Date.now();
    // Fetch from Discord API gateway endpoint
    const res = await fetch('https://discord.com/api/v10/gateway', { signal: AbortSignal.timeout(3000) });
    const dateHeader = res.headers.get('date') || res.headers.get('Date');
    if (dateHeader) {
      const serverMs = new Date(dateHeader).getTime();
      const end = Date.now();
      const latency = (end - start) / 2;
      clockOffset = (serverMs + latency) - end;
      logger.info(`Clock offset synchronized with Discord: ${clockOffset}ms`);
    }
  } catch (error) {
    logger.warn(`Failed to sync clock with Discord: ${error.message}. Using offset: ${clockOffset}ms`);
  }
}

function getCorrectedDate() {
  return new Date(Date.now() + clockOffset);
}

function getClockOffset() {
  return clockOffset;
}

function setClockOffset(offset) {
  clockOffset = offset;
}

module.exports = {
  syncClock,
  getCorrectedDate,
  getClockOffset,
  setClockOffset
};
