const WebSocket = require('ws');
const EventEmitter = require('events');

class MockMinecraftClient extends EventEmitter {
  constructor(url, secret) {
    super();
    this.url = url;
    this.secret = secret;
    this.ws = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.on('open', () => {
        // Send Auth Handshake
        this.ws.send(JSON.stringify({
          type: 'auth',
          payload: { secret: this.secret }
        }));
      });

      this.ws.on('message', (data) => {
        try {
          const packet = JSON.parse(data.toString());
          const { type, payload } = packet;

          if (type === 'auth_response') {
            if (payload && payload.success) {
              resolve();
            } else {
              reject(new Error('Auth failed: ' + (payload ? payload.message : 'No payload')));
            }
          } else {
            // Emit specific message type and raw message packet
            this.emit(type, payload);
            this.emit('message', packet);
          }
        } catch (error) {
          this.emit('error', error);
        }
      });

      this.ws.on('error', (err) => {
        reject(err);
        this.emit('error', err);
      });

      this.ws.on('close', () => {
        this.emit('close');
      });
    });
  }

  send(packet) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet));
      return true;
    }
    return false;
  }

  chat(sender, uuid, message) {
    return this.send({
      type: 'chat',
      payload: { sender, uuid, message }
    });
  }

  event(event_type, username, uuid, details) {
    return this.send({
      type: 'event',
      payload: { event_type, username, uuid, details }
    });
  }

  status({ online = true, tps = 20.00, ping = 10, current_players = 0, max_players = 20, players = [] } = {}) {
    return this.send({
      type: 'status',
      payload: { online, tps, ping, current_players, max_players, players }
    });
  }

  bind_code_request(username, uuid) {
    return this.send({
      type: 'bind_code_request',
      payload: { username, uuid }
    });
  }

  whitelist_response(username, action, success, message) {
    return this.send({
      type: 'whitelist_response',
      payload: { username, action, success, message }
    });
  }

  command_response(command_id, success, output) {
    return this.send({
      type: 'command_response',
      payload: { command_id, success, output }
    });
  }

  close() {
    if (this.ws) {
      this.ws.terminate();
    }
  }
}

module.exports = MockMinecraftClient;
