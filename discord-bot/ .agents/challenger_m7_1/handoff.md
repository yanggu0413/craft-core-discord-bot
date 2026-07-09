# Handoff Report — Milestone 7 Verification & Robustness

## 1. Observation
We ran the complete bot test suite using the command:
```powershell
node node_modules/jest/bin/jest.js --runInBand --testTimeout=30000
```
Out of 15 test suites and 171 tests, 2 test suites failed:
- **`tests/discordQueue.stress.test.js`**
- **`tests/discordQueueAdversarial.test.js`**

### Verbatim Failures

#### Failure A: `tests/discordQueue.stress.test.js` - Rate Limiting Timeout/Calculation Mismatch
1. Test: `Rate Limiting: Rapid sequential 429 errors exhaust attempts and fail terminally`
   - Verbatim Error:
     ```
     expect(jest.fn()).toHaveBeenNthCalledWith(n, ...expected)

     n: 1
     Expected: Any<Function>, 150
     Received
     ->     1: [Function anonymous], 50100
            2: [Function anonymous], 50100
     ```
2. Test: `Concurrency slot blocking: rate-limited tasks block other tasks in the queue`
   - Verbatim Error:
     ```
     thrown: "Exceeded timeout of 30000 ms for a test."
     ```

#### Failure B: `tests/discordQueueAdversarial.test.js` - Delay/Retry Mismatch and String Status Check
1. Test: `Handles rapid sequential 429 errors and retries appropriately`
   - Verbatim Error:
     ```
     expect(received).toBe(expected) // Object.is equality

     Expected: 150
     Received: 50100
     ```
2. Test: `Correctly identifies status code 429 when returned as string`
   - Verbatim Error:
     ```
     expect(jest.fn()).toHaveBeenCalledTimes(expected)

     Expected number of calls: 2
     Received number of calls: 1
     ```

### Code Implementation Observations
1. In **`src/utils/discordQueue.js`** (lines 148-155):
   ```javascript
   if (typeof retryAfterVal === 'number' && !isNaN(retryAfterVal)) {
     // Discord raw API returns retry_after in seconds (as a float), but discord.js sometimes normalizes it to ms.
     // If the value is very small (< 120), assume it's in seconds and convert to ms.
     let parsedMs = retryAfterVal;
     if (retryAfterVal < 120) {
       parsedMs = retryAfterVal * 1000;
     }
     delayMs = parsedMs + 100;
   ```
2. In **`src/utils/discordQueue.js`** (lines 23, 57-69) in `isTransientError`:
   ```javascript
   const status = error.status || error.statusCode || error.httpStatus || (error.rawError && error.rawError.status);
   ...
   if (status === 429) {
     return true;
   }
   ...
   if (status >= 400 && status < 500) {
     return false;
   }
   ```
3. In **`src/websocket/server.js`** (lines 24-35):
   ```javascript
   const ipAttempts = new Map();
   ...
       let attempts = ipAttempts.get(ip) || [];
       attempts = attempts.filter(time => now - time < 60000);
       ...
       attempts.push(now);
       ipAttempts.set(ip, attempts);
   ```
4. In **`src/websocket/session.js`** (lines 43-49):
   ```javascript
       const timeout = setTimeout(() => {
         pendingCommands.delete(commandId);
         reject(new Error('指令執行超時（30 秒未收到回傳）'));
       }, timeoutMs);

       // Store callbacks
       pendingCommands.set(commandId, { resolve, reject, timeout });
   ```

---

## 2. Logic Chain
1. **Delay Calculation Bug (Heuristic Collision)**:
   - In tests where `retryAfter` is mocked as `50` (or `100`) expecting milliseconds, the `DiscordQueueManager` evaluates `retryAfterVal < 120` as `true` (since `50 < 120` and `100 < 120`).
   - The code multiplies the value by `1000`, setting the delay to `50,000ms` (or `100,000ms`).
   - Consequently, in test cases where `setTimeout` is not mocked (like `Concurrency slot blocking`), the test sleeps for `100,100ms` and times out (exceeding the 30-second Jest timeout threshold).
   - In test cases where `setTimeout` is mocked, the assertion expects a delay of `150ms` (`50 + 100`) but gets `50,100ms` (`50,000 + 100`).

2. **String Status Code Classification Bug**:
   - The test rejects an API call with an error payload containing a string status: `{ status: '429' }`.
   - `isTransientError` checks `status === 429` (strict equality). Since `'429' === 429` is `false`, it bypasses the transient rate-limit match.
   - It then checks `status >= 400 && status < 500`. Due to type coercion, `'429' >= 400 && '429' < 500` resolves to `true`.
   - As a result, the function returns `false` (terminal client error).
   - The manager treats this as terminal, throws a `DiscordQueueError` immediately, and skips retries.

3. **WebSocket IP Attempts Map Leak**:
   - Every unique IP trying to connect adds an entry to `ipAttempts`.
   - Old/inactive IP keys are never removed from the map. Over time, this leads to an unbounded memory leak.

4. **Dangling WebSocket Pending Commands**:
   - Active commands in `pendingCommands` are stored under `commandId`.
   - If a connection is closed (`ws.on('close')`), the connection is removed, but any active pending commands are not rejected or cleared, dangling in memory until their timeouts expire.

---

## 3. Caveats
- No caveats. The review was thoroughly focused on the requested test suites and code correctness.

---

## 4. Conclusion
The bot application demonstrates strong robustness across 13 of the 15 test suites (e2e, database, and pipeline are correct). However:
1. **Critical Defect**: The Discord queue rate limit retry delay heuristic is flawed. A raw float value in seconds less than 120 can collide with millisecond values.
2. **Critical Defect**: The type-strict check `status === 429` prevents string statuses from being handled as transient errors, skipping retrying.
3. **Robustness Concern**: The `ipAttempts` Map has a memory leak for long-running servers.
4. **Robustness Concern**: Pending command requests dangle when a WebSocket connection disconnects.

### Actionable Mitigations
1. In `src/utils/discordQueue.js`, convert `retryAfterVal` to a number, and only convert to milliseconds if it is indeed in seconds (e.g. check if the value is a small float or check headers specifically, or if < 120 is too high a threshold). A cleaner way is to coerce status to number:
   ```javascript
   const statusNum = Number(status);
   if (statusNum === 429) { ... }
   ```
2. For the heuristic check, standardise the unit of `retryAfter`. If we check `retryAfterVal < 120`, ensure we do not run into collision with small millisecond limits like `50` or `100`.

---

## 5. Verification Method
- Execute test command:
  ```powershell
  node node_modules/jest/bin/jest.js --runInBand --testTimeout=30000
  ```
- Inspect output showing failures in `tests/discordQueue.stress.test.js` and `tests/discordQueueAdversarial.test.js`.
- Compare code behavior against assertions to confirm mismatch of delay and string status evaluation.
