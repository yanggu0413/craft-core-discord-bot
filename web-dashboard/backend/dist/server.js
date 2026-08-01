"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const ws_1 = require("ws");
const wsClient_1 = require("./websocket/wsClient");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const claims_routes_1 = __importDefault(require("./routes/claims.routes"));
const shops_routes_1 = __importDefault(require("./routes/shops.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const events_routes_1 = __importDefault(require("./routes/events.routes"));
const backup_routes_1 = __importDefault(require("./routes/backup.routes"));
const title_routes_1 = __importDefault(require("./routes/title.routes"));
const announcements_routes_1 = __importDefault(require("./routes/announcements.routes"));
const retention_routes_1 = __importDefault(require("./routes/retention.routes"));
const PORT = parseInt(process.env.PORT || '3000', 10);
const app = (0, express_1.default)();
app.set('case sensitive routing', true);
// Bug 46: CORS whitelist
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'https://craft-core.com'];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        }
        else {
            callback(null, true);
        }
    },
    credentials: true
}));
// Bug 48: IP Rate Limiting
const ipRequestCounts = new Map();
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = ipRequestCounts.get(ip) || { count: 0, resetTime: now + 60000 };
    if (now > entry.resetTime) {
        entry.count = 1;
        entry.resetTime = now + 60000;
    }
    else {
        entry.count++;
    }
    ipRequestCounts.set(ip, entry);
    if (entry.count > 300) {
        return res.status(429).json({ success: false, message: '請求過於頻繁，請稍後再試' });
    }
    next();
});
app.use(express_1.default.json({ limit: '10kb' }));
// Mount Modular Express Routers
app.use('/api/auth', auth_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/claims', claims_routes_1.default);
app.use('/api/admin/backup', backup_routes_1.default);
app.use('/api', shops_routes_1.default);
app.use('/api', user_routes_1.default);
app.use('/api', events_routes_1.default);
app.use('/api', title_routes_1.default);
app.use('/api', announcements_routes_1.default);
app.use('/api', retention_routes_1.default);
// Bug 50: Optional HTTPS / WSS configuration
let server;
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;
if (sslKeyPath && sslCertPath && fs_1.default.existsSync(sslKeyPath) && fs_1.default.existsSync(sslCertPath)) {
    server = https_1.default.createServer({
        key: fs_1.default.readFileSync(sslKeyPath),
        cert: fs_1.default.readFileSync(sslCertPath)
    }, app);
    console.log('[Web Server] HTTPS / WSS SSL Enabled.');
}
else {
    server = http_1.default.createServer(app);
}
// WebSocket Server for Web Frontend Real-time Events
const wss = new ws_1.WebSocketServer({ server });
(0, wsClient_1.setWssInstance)(wss);
// Bug 47: WS connection heartbeat & ping interval
const wsPingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false)
            return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);
wss.on('close', () => {
    clearInterval(wsPingInterval);
});
wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    console.log('[Web Server] Frontend WebSocket client connected.');
    ws.on('close', () => {
        console.log('[Web Server] Frontend WebSocket client disconnected.');
    });
});
// Connect WebSocket Bridge Client to Discord Bot / Minecraft
(0, wsClient_1.connectToBotWS)();
server.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(` Craft-Core Dashboard Backend Running on Port: ${PORT}`);
    console.log(` Mode: Express Router Modularized (v2.2.0)`);
    console.log(`===================================================`);
});
