const discordQueue = require('../src/utils/discordQueue');
const { DiscordQueueManager, DiscordQueueError } = discordQueue;
const logger = require('../src/utils/logger');

// Suppress log output during tests
jest.spyOn(logger, 'info').mockImplementation(() => {});
jest.spyOn(logger, 'warn').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});

describe('Discord Queue System Stress and Adversarial Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('High Load: 100 enqueued requests run, concurrency never exceeds 5', async () => {
    const manager = new DiscordQueueManager();
    let currentConcurrency = 0;
    let maxConcurrency = 0;
    const completed = [];

    const apiCallFn = async (id) => {
      currentConcurrency++;
      maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
      // Simulate slight network/processing delay (1-5ms)
      await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 5) + 1));
      currentConcurrency--;
      completed.push(id);
      return id;
    };

    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(manager.enqueue(() => apiCallFn(i), { id: i }));
    }

    const results = await Promise.all(promises);

    expect(results).toHaveLength(100);
    expect(completed).toHaveLength(100);
    expect(maxConcurrency).toBeLessThanOrEqual(5);
    // Confirm it reached 5 under high load
    expect(maxConcurrency).toBe(5);
  });

  test('Rate Limiting: Rapid sequential 429 errors exhaust attempts and fail terminally', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms) => {
      setImmediate(fn);
      return {};
    });

    const manager = new DiscordQueueManager();
    const rateLimitError = new Error('Rate Limited');
    rateLimitError.status = 429;
    rateLimitError.retryAfter = 50; // ms

    const apiCallFn = jest.fn().mockRejectedValue(rateLimitError);

    // Should fail terminally after 3 attempts
    await expect(manager.enqueue(apiCallFn, { test: '429_exhaustion' }, { maxAttempts: 3 }))
      .rejects.toThrow(DiscordQueueError);

    expect(apiCallFn).toHaveBeenCalledTimes(3);
    // Should have backed off twice
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 150); // 50 + 100
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 150); // 50 + 100

    setTimeoutSpy.mockRestore();
  });

  test('Rate Limiting Bug: retryAfter >= 120 seconds is not converted to milliseconds', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms) => {
      setImmediate(fn);
      return {};
    });

    const manager = new DiscordQueueManager();
    const rateLimitError = new Error('Rate Limited');
    rateLimitError.status = 429;
    // Mock retryAfter to be exactly 120 (seconds)
    rateLimitError.retryAfter = 120;

    const apiCallFn = jest.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce('success');

    const result = await manager.enqueue(apiCallFn, { test: '429_large_seconds' });

    expect(result).toBe('success');
    expect(apiCallFn).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    
    // BUG VERIFICATION: The code has a condition: if (retryAfterVal < 120) { parsedMs = retryAfterVal * 1000; }
    // Since 120 is not < 120, it is treated as milliseconds instead of seconds.
    // So the wait time is 120ms + 100ms = 220ms instead of 120000ms + 100ms = 120100ms!
    const delayUsed = setTimeoutSpy.mock.calls[0][1];
    expect(delayUsed).toBe(220); // This confirms the bug is present!

    setTimeoutSpy.mockRestore();
  });

  test('Concurrency slot blocking: rate-limited tasks block other tasks in the queue', async () => {
    const manager = new DiscordQueueManager();
    const startTimes = {};
    const endTimes = {};
    
    const rateLimitError = new Error('Rate Limited');
    rateLimitError.status = 429;
    rateLimitError.retryAfter = 100; // ms

    // We will enqueue 5 tasks that fail with 429 once, then succeed.
    // They will sleep for 200ms (100 + 100ms).
    // While they sleep, they block the 5 concurrency slots.
    // A 6th task that succeeds immediately is enqueued at the same time.
    // If the slots are blocked during sleep, the 6th task will ONLY start after
    // one of the first 5 tasks completes (which is > 200ms).
    // If slots were NOT blocked during sleep, the 6th task would run immediately.

    const makeRateLimitedTask = (id) => {
      let called = false;
      return async () => {
        if (!called) {
          called = true;
          startTimes[id] = Date.now();
          throw rateLimitError;
        }
        endTimes[id] = Date.now();
        return `task_${id}`;
      };
    };

    const makeImmediateTask = (id) => {
      return async () => {
        startTimes[id] = Date.now();
        endTimes[id] = Date.now();
        return `task_${id}`;
      };
    };

    const promises = [];
    // Enqueue 5 rate-limited tasks
    for (let i = 1; i <= 5; i++) {
      promises.push(manager.enqueue(makeRateLimitedTask(i), { id: i }));
    }
    // Enqueue 1 immediate task (6th task)
    // We delay enqueuing slightly to make sure the first 5 are picked up first
    await new Promise(resolve => setTimeout(resolve, 5));
    promises.push(manager.enqueue(makeImmediateTask(6), { id: 6 }));

    const results = await Promise.all(promises);

    expect(results).toHaveLength(6);
    
    // Let's analyze start time of task 6 relative to the others.
    // Task 6 could only have started after one of the first 5 tasks released its slot.
    // The first 5 tasks hit 429, sleep for 200ms, then retry and succeed.
    // Thus, task 6's start time should be at least ~200ms after the first 5 tasks started.
    const task6Start = startTimes[6];
    const firstTaskStart = startTimes[1];
    const duration = task6Start - firstTaskStart;

    logger.warn(`Task 6 started after ${duration}ms (demonstrating queue slot blocking)`);
    // It should be around 200ms (we allow some timer jitter, say > 150ms)
    expect(duration).toBeGreaterThanOrEqual(150);
  });
});
