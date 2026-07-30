import { execFile } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import { db } from '../db/database';

const execFilePromise = util.promisify(execFile);

export class GitService {
  static getAppDir(instanceId: string): string {
    const baseAppsDir = path.resolve(process.cwd(), 'data', 'apps');
    const safeAppDir = path.resolve(baseAppsDir, instanceId);
    if (!safeAppDir.startsWith(baseAppsDir)) {
      throw new Error('Invalid instance directory path');
    }
    return safeAppDir;
  }

  static async getCommitHistory(instanceId: string) {
    const appDir = this.getAppDir(instanceId);
    if (!fs.existsSync(path.join(appDir, '.git'))) {
      const records = db.prepare('SELECT * FROM deployments WHERE instance_id = ? ORDER BY created_at DESC').all(instanceId);
      return records;
    }

    try {
      const { stdout } = await execFilePromise('git', ['log', '-n', '10', '--pretty=format:%h|%s|%an|%ad'], { cwd: appDir });
      const lines = stdout.split('\n').filter(Boolean);
      return lines.map((line, idx) => {
        const [hash, msg, author, date] = line.split('|');
        return {
          id: `dep-${idx}`,
          instanceId,
          commitHash: hash,
          commitMessage: msg,
          author,
          timestamp: date,
          status: 'SUCCESS',
          isCurrent: idx === 0,
        };
      });
    } catch (err) {
      return [];
    }
  }

  static async rollbackToCommit(instanceId: string, commitHash: string) {
    // 🔴 Security: Sanitize & validate commitHash against Command Injection RCE
    if (commitHash !== 'HEAD' && !/^[a-f0-9]{4,40}$/i.test(commitHash)) {
      throw new Error('Invalid commit hash format');
    }

    const appDir = this.getAppDir(instanceId);
    if (!fs.existsSync(appDir)) {
      throw new Error(`App directory for instance ${instanceId} does not exist`);
    }

    // Use execFile with array arguments to prevent shell injection
    await execFilePromise('git', ['checkout', commitHash], { cwd: appDir });

    if (fs.existsSync(path.join(appDir, 'package.json'))) {
      await execFilePromise('npm', ['install'], { cwd: appDir }).catch(() => {});
    } else if (fs.existsSync(path.join(appDir, 'requirements.txt'))) {
      await execFilePromise('pip', ['install', '-r', 'requirements.txt'], { cwd: appDir }).catch(() => {});
    }

    return true;
  }

  static async cloneRepo(gitUrl: string, instanceId: string) {
    // 🔴 Security: Prevent Git Option Injection RCE (CVE-2017-1000117)
    const trimmedUrl = (gitUrl || '').trim();
    if (!/^https?:\/\/[^\s]+$/i.test(trimmedUrl) || trimmedUrl.startsWith('-') || trimmedUrl.toLowerCase().startsWith('file://')) {
      throw new Error('Invalid or unsafe Git repository URL');
    }

    const appDir = this.getAppDir(instanceId);
    if (!fs.existsSync(appDir)) {
      await fs.promises.mkdir(appDir, { recursive: true });
    }

    // Pass '--' separator to prevent option injection
    await execFilePromise('git', ['clone', '--', trimmedUrl, appDir]);

    if (fs.existsSync(path.join(appDir, 'package.json'))) {
      await execFilePromise('npm', ['install'], { cwd: appDir }).catch(() => {});
    } else if (fs.existsSync(path.join(appDir, 'requirements.txt'))) {
      await execFilePromise('pip', ['install', '-r', 'requirements.txt'], { cwd: appDir }).catch(() => {});
    }
  }
}
