import crypto from 'crypto';
import { db } from '../db/database';
import { DockerService } from './docker';
import { GitService } from './git';

export function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret || !payload) return false;
  
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  const sigBuf = Buffer.from(signature);
  const digBuf = Buffer.from(digest);

  if (sigBuf.length !== digBuf.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(sigBuf, digBuf);
  } catch (err) {
    return false;
  }
}

export async function processWebhookDeployment(instanceId: string) {
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as any;
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }

  // Pull latest code and restart container
  await GitService.rollbackToCommit(instanceId, 'HEAD');
  await DockerService.restartContainer(instanceId);
}
