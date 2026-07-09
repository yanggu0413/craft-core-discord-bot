const PQueue = require('p-queue').default;
const logger = require('./logger');
const { AppError } = require('./AppError');

/**
 * Custom error class for Discord Queue operations.
 */
class DiscordQueueError extends AppError {
  constructor(message, metadata = {}) {
    super(message, 'DISCORD_QUEUE_ERROR', 502, true, metadata);
    this.status = 502;
  }
}

/**
 * Checks if a given error should be treated as a transient error.
 * Transient errors include HTTP 429, HTTP 5xx, or network issues (ECONNRESET, ETIMEDOUT, etc.).
 * Terminal errors include HTTP 400, 403, 404, or Discord-specific terminal codes.
 */
function isTransientError(error) {
  if (!error) return false;

  const rawStatus = error.status || error.statusCode || error.httpStatus || (error.rawError && error.rawError.status);
  const status = rawStatus !== undefined && rawStatus !== null && !isNaN(Number(rawStatus)) ? Number(rawStatus) : undefined;
  const discordCode = error.code || (error.rawError && error.rawError.code);

  // 1. Identify network issues
  const networkErrorCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE', 'UND_ERR_CONNECT_TIMEOUT'];
  if (error.code && networkErrorCodes.includes(error.code)) {
    return true;
  }

  // Fallback check on error message for common network-related substrings
  if (error.message) {
    const msgLower = error.message.toLowerCase();
    if (
      msgLower.includes('econnreset') ||
      msgLower.includes('etimedout') ||
      msgLower.includes('enotfound') ||
      msgLower.includes('eai_again') ||
      msgLower.includes('econnrefused') ||
      msgLower.includes('socket hang up') ||
      msgLower.includes('timeout') ||
      msgLower.includes('network error')
    ) {
      return true;
    }
  }

  // 2. Identify Discord-specific terminal codes
  // e.g. 50001 (Missing Access), 50013 (Missing Permissions), 10003 (Unknown Channel), 10008 (Unknown Message), 10015 (Unknown Webhook)
  const terminalCodes = [50001, 50013, 10003, 10008, 10015];
  if (discordCode && terminalCodes.includes(Number(discordCode))) {
    return false;
  }

  // 3. HTTP 429 (Rate Limited) is transient
  if (status === 429) {
    return true;
  }

  // 4. HTTP 5xx (Server Error) is transient
  if (status >= 500 && status < 600) {
    return true;
  }

  // 5. HTTP 400, 403, 404 are terminal client errors
  if (status >= 400 && status < 500) {
    return false;
  }

  // If status/code doesn't match any criteria, default to terminal
  return false;
}

/**
 * Queue manager for Discord API calls.
 * Ensures a global concurrency of 5.
 */
class DiscordQueueManager {
  constructor() {
    this.queue = new PQueue({ concurrency: 5 });
  }

  /**
   * Enqueues a Discord API call with retry and backoff logic.
   *
   * @param {Function} apiCallFn - Async function returning the API call promise
   * @param {Object} [metadata={}] - Metadata for logging purposes
   * @param {Object} [options={}] - Custom configuration options
   * @param {number} [options.maxAttempts=3] - Maximum execution attempts
   * @param {number} [options.initialRetryDelay=1000] - Initial delay for retries in ms
   */
  async enqueue(apiCallFn, metadata = {}, options = {}) {
    return this.queue.add(async () => {
      let attempt = 0;
      const maxAttempts = options.maxAttempts || 3;
      const initialRetryDelay = options.initialRetryDelay || 1000;

      while (true) {
        attempt++;
        try {
          logger.info(`Discord API call execution started (attempt ${attempt}/${maxAttempts})`, { metadata, attempt });
          const result = await apiCallFn();
          logger.info(`Discord API call completed successfully (attempt ${attempt}/${maxAttempts})`, { metadata, attempt });
          return result;
        } catch (error) {
          const rawStatus = error.status || error.statusCode || error.httpStatus || (error.rawError && error.rawError.status);
          const status = rawStatus !== undefined && rawStatus !== null && !isNaN(Number(rawStatus)) ? Number(rawStatus) : undefined;
          const discordCode = error.code || (error.rawError && error.rawError.code);

          logger.warn(`Discord API call failed (attempt ${attempt}/${maxAttempts})`, {
            metadata,
            attempt,
            errorMessage: error.message,
            errorCode: discordCode,
            errorStatus: status
          });

          // Check if we should retry
          if (attempt >= maxAttempts || !isTransientError(error)) {
            logger.error(`Discord API call failed terminally (attempt ${attempt}/${maxAttempts})`, {
              metadata,
              attempt,
              errorMessage: error.message,
              errorCode: discordCode,
              errorStatus: status
            });
            throw new DiscordQueueError(
              `Discord API call failed: ${error.message}`,
              { originalError: error, metadata }
            );
          }

          // Calculate delay
          let delayMs = initialRetryDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);

          // Respect HTTP 429 retryAfter header/property if it exists
          let retryAfterVal;
          let isSeconds = false;

          if (error.retry_after !== undefined) {
            retryAfterVal = error.retry_after;
            isSeconds = true;
          } else if (error.rawError && error.rawError.retry_after !== undefined) {
            retryAfterVal = error.rawError.retry_after;
            isSeconds = true;
          } else if (error.headers) {
            const headerVal = typeof error.headers.get === 'function' ? error.headers.get('retry-after') : error.headers['retry-after'];
            if (headerVal) {
              retryAfterVal = parseFloat(headerVal);
              isSeconds = true;
            }
          }

          if (retryAfterVal === undefined && error.retryAfter !== undefined) {
            retryAfterVal = error.retryAfter;
            isSeconds = false;
          }

          if (typeof retryAfterVal === 'number' && !isNaN(retryAfterVal)) {
            let parsedMs = retryAfterVal;
            if (isSeconds) {
              parsedMs = retryAfterVal * 1000;
            }
            delayMs = parsedMs + 100;
            logger.info(`Respecting retryAfter rate limit delay: waiting for ${delayMs}ms`, { metadata, retryAfterVal });
          } else {
            logger.info(`Backing off for transient error: waiting for ${delayMs}ms`, { metadata, delayMs });
          }

          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    });
  }
}

const discordQueue = new DiscordQueueManager();
discordQueue.DiscordQueueManager = DiscordQueueManager;
discordQueue.DiscordQueueError = DiscordQueueError;

module.exports = discordQueue;
