"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_SECRET = void 0;
exports.signToken = signToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
exports.JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_99881122';
/**
 * Sign JWT token for user profile
 */
function signToken(payload, expiresIn = '7d') {
    return jsonwebtoken_1.default.sign(payload, exports.JWT_SECRET, { expiresIn: expiresIn });
}
/**
 * Verify JWT token
 */
function verifyToken(token) {
    if (!token)
        return null;
    const trimmedToken = token.trim();
    try {
        const decoded = jsonwebtoken_1.default.verify(trimmedToken, exports.JWT_SECRET);
        return decoded;
    }
    catch (err) {
        return null;
    }
}
