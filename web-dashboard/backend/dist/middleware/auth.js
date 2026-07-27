"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.requireAdmin = requireAdmin;
const auth_service_1 = require("../services/auth.service");
const wsClient_1 = require("../websocket/wsClient");
/**
 * Authentication middleware verifying Bearer tokens
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    let token;
    if (authHeader) {
        if (authHeader.toLowerCase().startsWith('bearer ')) {
            token = authHeader.substring(7).trim();
        }
        else {
            token = authHeader.trim();
        }
    }
    // Fallback check: query param token or x-access-token header
    if (!token && typeof req.query.token === 'string') {
        token = req.query.token;
    }
    if (!token && typeof req.headers['x-access-token'] === 'string') {
        token = req.headers['x-access-token'];
    }
    if (!token) {
        return res.status(401).json({ success: false, message: '尚未登入，請先進行身份驗證' });
    }
    const user = (0, auth_service_1.verifyToken)(token);
    if (!user) {
        return res.status(401).json({ success: false, message: '認證憑證無效或已過期' });
    }
    req.user = user;
    next();
}
/**
 * Authorization middleware ensuring user has admin privileges
 */
function requireAdmin(req, res, next) {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ success: false, message: '尚未登入，請先進行身份驗證' });
    }
    const isAdmin = Boolean(user.profile?.isAdmin ||
        (user.discord_id && wsClient_1.ADMIN_DISCORD_IDS.has(user.discord_id)));
    if (!isAdmin) {
        return res.status(403).json({ success: false, message: 'Forbidden: 您不是系統管理員' });
    }
    next();
}
