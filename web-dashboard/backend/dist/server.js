"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
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
dotenv_1.default.config();
const PORT = parseInt(process.env.PORT || '3000', 10);
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
app.use((0, cors_1.default)());
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
// WebSocket Server for Web Frontend Real-time Events
const wss = new ws_1.WebSocketServer({ server });
(0, wsClient_1.setWssInstance)(wss);
wss.on('connection', (ws) => {
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
