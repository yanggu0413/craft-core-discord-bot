const discordQueue = require('../src/utils/discordQueue');
const { DiscordQueueManager, DiscordQueueError } = discordQueue;
const logger = require('../src/utils/logger');

// Mute logs during test execution
jest.spyOn(logger, 'info').mockImplementation(() => {});
jest.spyOn(logger, 'warn').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});

describe('DiscordQueue System - Adversarial Stress & Edge Cases', () => {
  let setTimeoutSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    // Spy on global.setTimeout and run the callback instantly to avoid hanging
    setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms) => {
      setImmediate(fn);
      return {};
    });
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
  });

  /**
   * Challenge 1: Concurrency Limits and High Load (100 enqueued requests)
   */
  test('Under high load (100 enqueued requests), concurrency does not exceed 5 and all execute', async () => {
    const manager = new DiscordQueueManager();
    let activeCalls = 0;
    let maxActiveCalls = 0;
    const executionOrder = [];

    const mockApiCall = async (id) => {
      activeCalls++;
      maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
      executionOrder.push({ id, event: 'start', active: activeCalls });

      // Simulate some async work to allow concurrency concurrency overlap
      await new Promise(resolve => setImmediate(resolve));

      activeCalls--;
      executionOrder.push({ id, event: 'end', active: activeCalls });
      return `result-${id}`;
    };

    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(manager.enqueue(() => mockApiCall(i), { id: i }));
    }

    const results = await Promise.all(promises);

    // Verify all 100 requests resolved successfully
    expect(results).toHaveLength(100);
    for (let i = 0; i < 100; i++) {
      expect(results[i]).toBe(`result-${i}`);
    }

    // Verify concurrency never exceeded 5
    expect(maxActiveCalls).toBeLessThanOrEqual(5);
    // Verify it actually reached maximum possible concurrency of 5
    expect(maxActiveCalls).toBe(5);

    // Verify that at no point in executionOrder did active count exceed 5
    executionOrder.forEach((evt) => {
      expect(evt.active).toBeLessThanOrEqual(5);
    });
  });

  /**
   * Challenge 2: Rapid Sequential 429 Rate Limits
   */
  test('Handles rapid sequential 429 errors and retries appropriately', async () => {
    const manager = new DiscordQueueManager();
    
    // We will enqueue 10 API calls, each designed to fail with 429 twice, then succeed
    const createMockApiCall = (id) => {
      let attempts = 0;
      return async () => {
        attempts++;
        if (attempts <= 2) {
          const rateLimitError = new Error('Rate Limited');
          rateLimitError.status = 429;
          rateLimitError.retryAfter = 50; // 50ms
          throw rateLimitError;
        }
        return `success-${id}`;
      };
    };

    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(manager.enqueue(createMockApiCall(i), { id: i }));
    }

    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
    results.forEach((res, i) => {
      expect(res).toBe(`success-${i}`);
    });

    // Each of the 10 calls should have retried twice (total 3 attempts each)
    // Total setTimeout calls should be 10 * 2 = 20
    expect(setTimeoutSpy).toHaveBeenCalledTimes(20);

    // Let's verify that the delay requested was indeed 50ms + 100ms = 150ms.
    // Wait! Because 50 < 120, let's see if the code incorrectly multiplied it by 1000!
    // If it did, setTimeout would be called with 50 * 1000 + 100 = 50100ms.
    const lastDelay = setTimeoutSpy.mock.calls[0][1];
    expect(lastDelay).toBe(150); // This will FAIL if the 50 < 120 bug is present!
  });

  /**
   * Challenge 3: Jitter and Backoff calculation for transient errors without retryAfter
   */
  test('Calculates backoff delays with exponential factor and jitter', async () => {
    const manager = new DiscordQueueManager();
    const transientError = { status: 503, message: 'Service Unavailable' };
    
    const apiCall = jest.fn()
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockResolvedValue('ok');

    await manager.enqueue(apiCall, { test: 'jitter' }, { initialRetryDelay: 200 });

    expect(apiCall).toHaveBeenCalledTimes(3);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

    // Attempt 1 backoff: 200 * 2^0 = 200 + jitter [0, 200)
    const delay1 = setTimeoutSpy.mock.calls[0][1];
    expect(delay1).toBeGreaterThanOrEqual(200);
    expect(delay1).toBeLessThan(400);

    // Attempt 2 backoff: 200 * 2^1 = 400 + jitter [0, 200)
    const delay2 = setTimeoutSpy.mock.calls[1][1];
    expect(delay2).toBeGreaterThanOrEqual(400);
    expect(delay2).toBeLessThan(600);
  });

  /**
   * Challenge 4: Bug check - string statuses or invalid status checks
   */
  test('Correctly identifies status code 429 when returned as string', async () => {
    const manager = new DiscordQueueManager();
    const rateLimitError = { status: '429', message: 'Rate Limited' };
    
    const apiCall = jest.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue('ok');

    // If status is a string, status === 429 will be false because '429' !== 429.
    // Let's see if the queue handles this or treats it as terminal.
    // If it treats it as terminal, enqueue will reject with DiscordQueueError immediately.
    let errorThrown = null;
    try {
      await manager.enqueue(apiCall, { test: 'string_status' });
    } catch (e) {
      errorThrown = e;
    }

    // If it's a bug, it will throw immediately and apiCall will only be called 1 time
    // Let's assert if the library behaves properly (it should NOT throw, or at least retry).
    // Let's expect it to retry, so apiCall is called 2 times.
    expect(apiCall).toHaveBeenCalledTimes(2);
  });
});
