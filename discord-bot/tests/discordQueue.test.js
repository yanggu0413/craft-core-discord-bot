const discordQueue = require('../src/utils/discordQueue');
const { DiscordQueueManager, DiscordQueueError } = discordQueue;
const logger = require('../src/utils/logger');

// Spy on logger to prevent console clutter during tests
jest.spyOn(logger, 'info').mockImplementation(() => {});
jest.spyOn(logger, 'warn').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});

describe('Discord Queue System (Milestone 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Successful API execution resolves with return value', async () => {
    const apiCallFn = jest.fn().mockResolvedValue('success_payload');
    const result = await discordQueue.enqueue(apiCallFn, { test: 'success' });
    
    expect(result).toBe('success_payload');
    expect(apiCallFn).toHaveBeenCalledTimes(1);
  });

  test('Transient error retries up to 3 times and then succeeds', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms) => {
      setImmediate(fn);
      return {};
    });

    const apiCallFn = jest.fn()
      .mockRejectedValueOnce({ status: 503, message: 'Server Error' })
      .mockRejectedValueOnce({ statusCode: 500, message: 'Internal Server Error' })
      .mockResolvedValueOnce('resolved_after_retries');

    const result = await discordQueue.enqueue(apiCallFn, { test: 'retry_success' }, { initialRetryDelay: 100 });

    expect(result).toBe('resolved_after_retries');
    expect(apiCallFn).toHaveBeenCalledTimes(3);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

    // Verify backoff delays were passed to setTimeout
    // Attempt 1 delay: 100 * 2^0 + jitter = 100 + jitter
    const delay1 = setTimeoutSpy.mock.calls[0][1];
    expect(delay1).toBeGreaterThanOrEqual(100);
    expect(delay1).toBeLessThanOrEqual(300);

    // Attempt 2 delay: 100 * 2^1 + jitter = 200 + jitter
    const delay2 = setTimeoutSpy.mock.calls[1][1];
    expect(delay2).toBeGreaterThanOrEqual(200);
    expect(delay2).toBeLessThanOrEqual(400);

    setTimeoutSpy.mockRestore();
  });

  test('Transient error fails terminally after 3 attempts', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms) => {
      setImmediate(fn);
      return {};
    });

    const apiCallFn = jest.fn().mockRejectedValue({ status: 502, message: 'Bad Gateway' });

    await expect(discordQueue.enqueue(apiCallFn, { test: 'retry_failure' }, { initialRetryDelay: 100 }))
      .rejects.toThrow(DiscordQueueError);

    expect(apiCallFn).toHaveBeenCalledTimes(3);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

    setTimeoutSpy.mockRestore();
  });

  test('Network issues are treated as transient and retried', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms) => {
      setImmediate(fn);
      return {};
    });

    const networkError = new Error('read ECONNRESET');
    networkError.code = 'ECONNRESET';
    
    const apiCallFn = jest.fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce('network_success');

    const result = await discordQueue.enqueue(apiCallFn, { test: 'network_retry' }, { initialRetryDelay: 100 });

    expect(result).toBe('network_success');
    expect(apiCallFn).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

    setTimeoutSpy.mockRestore();
  });

  test('Terminal errors (e.g. HTTP 403) fail immediately without retry', async () => {
    const apiCallFn = jest.fn().mockRejectedValue({ status: 403, message: 'Forbidden' });
    
    await expect(discordQueue.enqueue(apiCallFn, { test: 'terminal_403' }))
      .rejects.toThrow(DiscordQueueError);
    
    expect(apiCallFn).toHaveBeenCalledTimes(1);
  });

  test('Discord-specific terminal codes fail immediately without retry', async () => {
    const apiCallFn = jest.fn().mockRejectedValue({ code: 50013, message: 'Missing Permissions' });
    
    await expect(discordQueue.enqueue(apiCallFn, { test: 'terminal_discord_code' }))
      .rejects.toThrow(DiscordQueueError);
    
    expect(apiCallFn).toHaveBeenCalledTimes(1);
  });

  test('Respects HTTP 429 retryAfter property and waits retryAfter + 100ms', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms) => {
      setImmediate(fn);
      return {};
    });

    const rateLimitError = new Error('Rate Limited');
    rateLimitError.status = 429;
    rateLimitError.retryAfter = 250; // ms

    const apiCallFn = jest.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce('rate_limit_resolved');

    const result = await discordQueue.enqueue(apiCallFn, { test: 'rate_limit' });

    expect(result).toBe('rate_limit_resolved');
    expect(apiCallFn).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 350); // 250 + 100ms

    setTimeoutSpy.mockRestore();
  });

  test('Concurrency limit of 5 ensures at most 5 calls run in parallel', async () => {
    const manager = new DiscordQueueManager();
    let activeCalls = 0;
    let maxActiveCalls = 0;

    const apiCall = async () => {
      activeCalls++;
      maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
      // Let other promises resolve so they can run concurrently
      await new Promise(resolve => process.nextTick(resolve));
      activeCalls--;
      return 'done';
    };

    const promises = [];
    for (let i = 0; i < 12; i++) {
      promises.push(manager.enqueue(apiCall, { id: i }));
    }

    await Promise.all(promises);
    expect(maxActiveCalls).toBeLessThanOrEqual(5);
  });
});
