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

module.exports = {
  isActive,
  send,
  executeCommand,
  resolveCommand,
  setConnection,
  getConnection,
  removeConnection,
  hasConnection,
  pendingCommands
};
