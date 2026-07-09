const crypto = require('crypto');
const pendingCommands = new Map();
let activeWSConnection = null;

function isActive() {
  if (activeWSConnection === null) return false;
  if (activeWSConnection.readyState !== undefined && activeWSConnection.readyState !== 1) {
    return false;
  }
  return activeWSConnection.readyState === 1 || activeWSConnection.isActive === true;
}

function send(packet) {
  if (isActive()) {
    if (typeof activeWSConnection.send === 'function') {
      activeWSConnection.send(JSON.stringify(packet));
    }
    return true;
  }
  return false;
}

function executeCommand(commandString, adminTag) {
  return new Promise((resolve, reject) => {
    if (!isActive()) {
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
    if (typeof activeWSConnection.send === 'function') {
      activeWSConnection.send(JSON.stringify({
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

function setConnection(ws) {
  activeWSConnection = ws;
}

function getConnection() {
  return activeWSConnection;
}

module.exports = {
  isActive,
  send,
  executeCommand,
  resolveCommand,
  setConnection,
  getConnection,
  pendingCommands
};
