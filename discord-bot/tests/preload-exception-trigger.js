// Preload script to spy on shut down hooks and trigger exceptions
const path = require('path');

// 1. Load the mock discord preload
require('./e2e/preload-mock.js');

// 2. Add destroy method to MockClient and spy on it
const mockDiscord = require('discord.js');
mockDiscord.Client.prototype.destroy = function() {
  console.log('[VERIFY-SHUTDOWN] client.destroy called');
};

// 3. Spy on websocket server stop
const wsServer = require('../src/websocket/server');
const originalStop = wsServer.stop;
wsServer.stop = function() {
  console.log('[VERIFY-SHUTDOWN] wsServer.stop called');
  return originalStop.apply(this, arguments);
};

// 4. Spy on db close
const db = require('../src/database');
const originalClose = db.close;
db.close = function() {
  console.log('[VERIFY-SHUTDOWN] db.close called');
  return originalClose.apply(this, arguments);
};

// 5. IPC listener to trigger errors on demand
process.on('message', (msg) => {
  if (msg && msg.type === 'TRIGGER_UNCAUGHT_EXCEPTION') {
    console.log('[TRIGGER] Throwing uncaught exception...');
    throw new Error('Triggered Uncaught Exception');
  }
  if (msg && msg.type === 'TRIGGER_UNHANDLED_REJECTION') {
    console.log('[TRIGGER] Rejecting promise...');
    Promise.reject(new Error('Triggered Unhandled Rejection'));
  }
});
