const crypto = require('crypto');
const pendingCommands = new Map();
const connections = new Map();

function isWsActive(ws) {
  if (!ws) return false;
  if (ws.readyState !== undefined && ws.readyState !== 1) {
    return false;
  }
  return ws.readyState === 1 || ws.isActive === true;
}

function isActive(serverId) {
  if (serverId !== undefined) {
    return isWsActive(connections.get(serverId));
  }
  for (const ws of connections.values()) {
    if (isWsActive(ws)) return true;
  }
  return false;
}

function send(packet, serverId = 'default') {
  const ws = getConnection(serverId);
  if (ws && isWsActive(ws)) {
    if (typeof ws.send === 'function') {
      ws.send(JSON.stringify(packet));
    }
    return true;
  }
  return false;
}

function executeCommand(commandString, adminTag, serverId = 'default') {
  return new Promise((resolve, reject) => {
    const ws = getConnection(serverId);
    if (!ws || !isWsActive(ws)) {
      return reject(new Error('遊戲伺服器未連線'));
    }

    const commandId = crypto.randomUUID();
    const timeoutMs = process.env.NODE_ENV === 'test' ? 500 : 30000;
    const timeout = setTimeout(() => {
      pendingCommands.delete(commandId);
      reject(new Error('指令執行超時（30 秒未收到回傳）'));
    }, timeoutMs);

    // Store callbacks
    pendingCommands.set(commandId, { resolve, reject, timeout });

    // Send payload
    if (typeof ws.send === 'function') {
      ws.send(JSON.stringify({
        type: 'command_request',
        payload: {
          command_id: commandId,
          command: commandString,
          admin_username: adminTag
        }
      }));
    } else {
      // Mock for testing or manual triggers
      setTimeout(() => {
        resolveCommand(commandId, true, `Executed: ${commandString}`);
      }, 50);
    }
  });
}

function resolveCommand(commandId, success, output) {
  const pending = pendingCommands.get(commandId);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingCommands.delete(commandId);
    pending.resolve({ success, output });
  }
}

function setConnection(serverId, ws) {
  if (ws === undefined) {
    ws = serverId;
    serverId = 'default';
  }
  connections.set(serverId, ws);
}

function getConnection(serverId = 'default') {
  return connections.get(serverId) || null;
}

function removeConnection(serverId) {
  connections.delete(serverId);
  // Reject and clear all pending commands when connection closes
  for (const [commandId, pending] of pendingCommands.entries()) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('遊戲伺服器已斷開連線'));
    pendingCommands.delete(commandId);
  }
}

function hasConnection(serverId) {
  return connections.has(serverId);
}

const pendingRequests = new Map();

function queryBalance(username, serverId = 'default') {
  return new Promise((resolve, reject) => {
    const ws = getConnection(serverId);
    if (!ws || !isWsActive(ws)) {
      return reject(new Error('遊戲伺服器未連線'));
    }

    const queryId = crypto.randomUUID();
    const timeoutMs = process.env.NODE_ENV === 'test' ? 500 : 30000;
    const timeout = setTimeout(() => {
      pendingRequests.delete(queryId);
      reject(new Error('查詢餘額超時'));
    }, timeoutMs);

    pendingRequests.set(queryId, { resolve, reject, timeout });

    if (typeof ws.send === 'function') {
      ws.send(JSON.stringify({
        type: 'balance_query',
        payload: {
          query_id: queryId,
          username: username
        }
      }));
    } else {
      setTimeout(() => {
        resolveRequest(queryId, { success: true, username, balance: 1000 });
      }, 50);
    }
  });
}

function queryShopStats(username, serverId = 'default') {
  return new Promise((resolve, reject) => {
    const ws = getConnection(serverId);
    if (!ws || !isWsActive(ws)) {
      return reject(new Error('遊戲伺服器未連線'));
    }

    const queryId = crypto.randomUUID();
    const timeoutMs = process.env.NODE_ENV === 'test' ? 500 : 30000;
    const timeout = setTimeout(() => {
      pendingRequests.delete(queryId);
      reject(new Error('查詢商店數據超時'));
    }, timeoutMs);

    pendingRequests.set(queryId, { resolve, reject, timeout });

    if (typeof ws.send === 'function') {
      ws.send(JSON.stringify({
        type: 'shop_stats_query',
        payload: {
          query_id: queryId,
          username: username
        }
      }));
    } else {
      setTimeout(() => {
        resolveRequest(queryId, {
          success: true,
          username,
          shops: [
            { location: '100, 64, -200', item: 'minecraft:diamond', stock: 10, revenue: 500 }
          ]
        });
      }, 50);
    }
  });
}

function queryRichList(limit = 10, serverId = 'default') {
  return new Promise((resolve, reject) => {
    const ws = getConnection(serverId);
    if (!ws || !isWsActive(ws)) {
      return reject(new Error('遊戲伺服器未連線'));
    }

    const queryId = crypto.randomUUID();
    const timeoutMs = process.env.NODE_ENV === 'test' ? 500 : 30000;
    const timeout = setTimeout(() => {
      pendingRequests.delete(queryId);
      reject(new Error('查詢富豪榜超時'));
    }, timeoutMs);

    pendingRequests.set(queryId, { resolve, reject, timeout });

    if (typeof ws.send === 'function') {
      ws.send(JSON.stringify({
        type: 'rich_list_query',
        payload: {
          query_id: queryId,
          limit: limit
        }
      }));
    } else {
      setTimeout(() => {
        resolveRequest(queryId, {
          success: true,
          leaderboard: [
            { username: 'MockRich1', balance: 10000 },
            { username: 'MockRich2', balance: 5000 }
          ]
        });
      }, 50);
    }
  });
}

function queryDailyTasks(username, serverId = 'default') {
  return new Promise((resolve, reject) => {
    const ws = getConnection(serverId);
    if (!ws || !isWsActive(ws)) {
      return reject(new Error('遊戲伺服器未連線'));
    }

    const queryId = crypto.randomUUID();
    const timeoutMs = process.env.NODE_ENV === 'test' ? 500 : 30000;
    const timeout = setTimeout(() => {
      pendingRequests.delete(queryId);
      reject(new Error('查詢每日任務超時'));
    }, timeoutMs);

    pendingRequests.set(queryId, { resolve, reject, timeout });

    if (typeof ws.send === 'function') {
      ws.send(JSON.stringify({
        type: 'daily_tasks_query',
        payload: {
          query_id: queryId,
          username: username
        }
      }));
    } else {
      setTimeout(() => {
        resolveRequest(queryId, {
          success: true,
          username,
          tasks: [
            { type: 1, target: 'Zombie', count: 15, reward: 250, progress: 0 },
            { type: 2, target: 'Coal Ore', count: 20, reward: 200, progress: 0 }
          ],
          date: '2026-07-13'
        });
      }, 50);
    }
  });
}

let webDashboardWs = null;

function setWebDashboardWs(ws) {
  webDashboardWs = ws;
}

function getWebDashboardWs() {
  return webDashboardWs;
}

function resolveRequest(queryId, data) {
  const pending = pendingRequests.get(queryId);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingRequests.delete(queryId);
    pending.resolve(data);
  }
}

module.exports = {
  isActive,
  send,
  executeCommand,
  resolveCommand,
  setConnection,
  getConnection,
  removeConnection,
  hasConnection,
  pendingCommands,
  pendingRequests,
  queryBalance,
  queryShopStats,
  queryRichList,
  queryDailyTasks,
  resolveRequest,
  setWebDashboardWs,
  getWebDashboardWs
};
