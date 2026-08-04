const http = require('http');
const logger = require('./utils/logger');
const statusService = require('./services/statusService');

let server = null;

function startApiStatusServer(port = 9967) {
  server = http.createServer((req, res) => {
    // Enable CORS for external proxy and web browsers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/' || req.url === '/api/status') {
      const data = statusService.getStatusForApi();
      res.writeHead(200);
      res.end(JSON.stringify(data));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Status API port ${port} already in use, skipping HTTP server bind.`);
    } else {
      logger.error('Status API server error:', err);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info(`Status API HTTP server listening on port ${port}`);
  });
}

function stopApiStatusServer() {
  if (server) {
    server.close();
    server = null;
  }
}

module.exports = {
  startApiStatusServer,
  stopApiStatusServer
};
