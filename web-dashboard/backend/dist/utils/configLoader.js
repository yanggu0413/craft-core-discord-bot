"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfigJson = loadConfigJson;
exports.saveConfigJson = saveConfigJson;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/**
 * Utility to load MCSManager / craft-core-shop JSON configuration files with fallback resolution.
 */
function loadConfigJson(filename) {
    const safeFilename = path_1.default.basename(filename);
    const candidatePaths = [
        process.env.CRAFT_CORE_CONFIG_DIR ? path_1.default.join(process.env.CRAFT_CORE_CONFIG_DIR, safeFilename) : null,
        `/opt/mcsmanager/daemon/data/InstanceData/2010082ee9374bebbdf2be4bab7fe169/config/craft-core-shop/${safeFilename}`,
        `/craft-core/config/craft-core-shop/${safeFilename}`,
        path_1.default.resolve(__dirname, `../../../../config/craft-core-shop/${safeFilename}`),
        path_1.default.resolve(__dirname, `../../../../../fabric-mod/config/craft-core-shop/${safeFilename}`),
        path_1.default.resolve(`config/craft-core-shop/${safeFilename}`),
        path_1.default.resolve(`../config/craft-core-shop/${safeFilename}`)
    ].filter(Boolean);
    for (const filePath of candidatePaths) {
        try {
            if (fs_1.default.existsSync(filePath)) {
                const rawContent = fs_1.default.readFileSync(filePath, 'utf8');
                return JSON.parse(rawContent);
            }
        }
        catch (err) {
            // Continue searching next path
        }
    }
    return null;
}
/**
 * Utility to write/save MCSManager / craft-core-shop JSON configuration files with fallback resolution.
 */
function saveConfigJson(filename, data) {
    const safeFilename = path_1.default.basename(filename);
    const candidatePaths = [
        process.env.CRAFT_CORE_CONFIG_DIR ? path_1.default.join(process.env.CRAFT_CORE_CONFIG_DIR, safeFilename) : null,
        `/opt/mcsmanager/daemon/data/InstanceData/2010082ee9374bebbdf2be4bab7fe169/config/craft-core-shop/${safeFilename}`,
        `/craft-core/config/craft-core-shop/${safeFilename}`,
        path_1.default.resolve(__dirname, `../../../../config/craft-core-shop/${safeFilename}`),
        path_1.default.resolve(`config/craft-core-shop/${safeFilename}`)
    ].filter(Boolean);
    for (const filePath of candidatePaths) {
        try {
            const dirPath = path_1.default.dirname(filePath);
            if (!fs_1.default.existsSync(dirPath)) {
                fs_1.default.mkdirSync(dirPath, { recursive: true });
            }
            fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            return true;
        }
        catch (err) {
            // Continue to next path
        }
    }
    return false;
}
