import path from 'path';
import fs from 'fs';

/**
 * Utility to load MCSManager / craft-core-shop JSON configuration files with fallback resolution.
 */
export function loadConfigJson<T = any>(filename: string): T | null {
  const safeFilename = path.basename(filename);
  const candidatePaths = [
    process.env.CRAFT_CORE_CONFIG_DIR ? path.join(process.env.CRAFT_CORE_CONFIG_DIR, safeFilename) : null,
    `/opt/mcsmanager/daemon/data/InstanceData/e73c05307a6b4259bd052b88706757df/config/craft-core-shop/${safeFilename}`,
    `/opt/mcsmanager/daemon/data/InstanceData/2010082ee9374bebbdf2be4bab7fe169/config/craft-core-shop/${safeFilename}`,
    `/root/craft-core/config/craft-core-shop/${safeFilename}`,
    `/craft-core/config/craft-core-shop/${safeFilename}`,
    path.resolve(__dirname, `../../../../config/craft-core-shop/${safeFilename}`),
    path.resolve(__dirname, `../../../../../fabric-mod/config/craft-core-shop/${safeFilename}`),
    path.resolve(`config/craft-core-shop/${safeFilename}`),
    path.resolve(`../config/craft-core-shop/${safeFilename}`)
  ].filter(Boolean) as string[];

  // Dynamic scan for any active MCSManager instances
  try {
    const instanceBase = '/opt/mcsmanager/daemon/data/InstanceData';
    if (fs.existsSync(instanceBase)) {
      const instances = fs.readdirSync(instanceBase);
      for (const inst of instances) {
        candidatePaths.unshift(path.join(instanceBase, inst, 'config/craft-core-shop', safeFilename));
      }
    }
  } catch (e) {}

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const rawContent = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(rawContent) as T;
      }
    } catch (err) {
      // Continue searching next path
    }
  }

  return null;
}

/**
 * Utility to write/save MCSManager / craft-core-shop JSON configuration files with fallback resolution.
 */
export function saveConfigJson(filename: string, data: any): boolean {
  const safeFilename = path.basename(filename);
  const candidatePaths = [
    process.env.CRAFT_CORE_CONFIG_DIR ? path.join(process.env.CRAFT_CORE_CONFIG_DIR, safeFilename) : null,
    `/opt/mcsmanager/daemon/data/InstanceData/e73c05307a6b4259bd052b88706757df/config/craft-core-shop/${safeFilename}`,
    `/opt/mcsmanager/daemon/data/InstanceData/2010082ee9374bebbdf2be4bab7fe169/config/craft-core-shop/${safeFilename}`,
    `/root/craft-core/config/craft-core-shop/${safeFilename}`,
    `/craft-core/config/craft-core-shop/${safeFilename}`,
    path.resolve(__dirname, `../../../../config/craft-core-shop/${safeFilename}`),
    path.resolve(`config/craft-core-shop/${safeFilename}`)
  ].filter(Boolean) as string[];

  for (const filePath of candidatePaths) {
    try {
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (err) {
      // Continue to next path
    }
  }

  return false;
}
