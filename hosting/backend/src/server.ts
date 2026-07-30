import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import net from 'net';

import { initDatabase, db, recordAuditLog } from './db/database';
import { handleUserAuthentication, generateToken, authenticate, AuthRequest, checkInstanceOwnership } from './services/auth';
import { DockerService } from './services/docker';
import { verifyGitHubSignature, processWebhookDeployment } from './services/webhook';
import { handleMcpJsonRpcRequest } from './mcp/server';
import { GitService } from './services/git';
import AdmZip from 'adm-zip';

dotenv.config();
initDatabase();

const app = express();
const PORT = process.env.PORT || 3005;

// 🔴 Security/Infrastructure Fix: Trust Proxy for Rate Limiter
app.set('trust proxy', 1);

// 🔴 Security Fix Item #1: Strict CORS Whitelist to prevent CSRF/CORS Origin Reflection
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://hosting.craft-core.xyz',
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// 🟡 Performance/Stability Fix Item #3: Increase Body Parser limit to 10MB
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests from this IP, please try again after 1 minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

const upload = multer({ dest: path.join(process.cwd(), 'data', 'tmp') });

// Helper: Test physical host port availability
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

// Helper: Find available host port without collision
async function findAvailableHostPort(): Promise<number> {
  const usedPorts = (
    db.prepare('SELECT assigned_host_port FROM instances WHERE assigned_host_port IS NOT NULL').all() as any[]
  ).map((r) => r.assigned_host_port);

  // Try random ports first in 30000-39999 range
  for (let attempt = 0; attempt < 500; attempt++) {
    const candidate = Math.floor(Math.random() * 10000) + 30000;
    if (!usedPorts.includes(candidate)) {
      const available = await isPortAvailable(candidate);
      if (available) return candidate;
    }
  }

  // Fallback sequential search
  for (let port = 30000; port <= 39999; port++) {
    if (!usedPorts.includes(port)) {
      const available = await isPortAvailable(port);
      if (available) return port;
    }
  }
  throw new Error('No available host ports in range 30000-39999');
}

// Helper: Synchronize Docker container status with SQLite DB on startup
async function syncContainerStatuses() {
  try {
    // Backfill 8-character random subdomain for any existing instances missing one
    const instancesWithoutSubdomain = db.prepare("SELECT id FROM instances WHERE subdomain IS NULL OR subdomain = ''").all() as any[];
    for (const inst of instancesWithoutSubdomain) {
      const newSub = generateSubdomain();
      db.prepare('UPDATE instances SET subdomain = ? WHERE id = ?').run(newSub, inst.id);
    }

    const instances = db.prepare('SELECT id, status FROM instances').all() as any[];
    for (const inst of instances) {
      const isRunning = await DockerService.isContainerRunning(inst.id);
      const actualStatus = isRunning ? 'running' : 'stopped';
      if (inst.status !== actualStatus) {
        db.prepare('UPDATE instances SET status = ? WHERE id = ?').run(actualStatus, inst.id);
      }
    }
    console.log('[Craft-Core Hosting] Docker container status & subdomain alignment completed.');
  } catch (err) {
    console.error('Failed to sync container statuses on startup:', err);
  }
}

// Discord OAuth Login
app.get('/api/auth/discord/login', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI || 'https://hosting.craft-core.xyz/api/auth/discord/callback');
  const scope = encodeURIComponent('identify');
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  res.redirect(discordAuthUrl);
});

// OAuth Callback
app.get('/api/auth/discord/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || '',
        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI || 'https://hosting.craft-core.xyz/api/auth/discord/callback',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return res.status(500).send(`Discord Token Exchange Error: ${tokenData.error_description || tokenData.error}`);
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const discordUser = await userResponse.json();
    const user = handleUserAuthentication({
      id: discordUser.id,
      username: `${discordUser.username}#${discordUser.discriminator || '0'}`,
      avatar: discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png',
    });

    const jwtToken = generateToken(user);

    // Set httpOnly Cookie and pass token parameter for SPA initialization
    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    recordAuditLog(user.id, user.username, 'USER_LOGIN', 'Discord OAuth Login Success', req.ip);

    res.redirect(`/?token=${jwtToken}`);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Logout Endpoint
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get Current Logged In User
app.get('/api/auth/me', authenticate, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });

  const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
  if (!dbUser) return res.status(404).json({ error: 'User not found' });

  res.json({
    user: {
      id: dbUser.id,
      discordId: dbUser.discord_id,
      username: dbUser.username,
      avatar: dbUser.avatar,
      role: dbUser.role,
      status: dbUser.status,
      apiToken: dbUser.api_token,
      createdAt: dbUser.created_at,
    },
  });
});

// Generate Personal Access Token (PAT)
const generatePatHandler = (req: AuthRequest, res: express.Response) => {
  const newPat = `cch_pat_${crypto.randomBytes(24).toString('hex')}`;
  db.prepare('UPDATE users SET api_token = ? WHERE id = ?').run(newPat, req.user?.id);
  recordAuditLog(req.user!.id, req.user!.username, 'PAT_REGENERATED', 'Generated new API Access Token', req.ip);
  res.json({ success: true, apiToken: newPat });
};
app.post('/api/user/pat/generate', authenticate, generatePatHandler);
app.post('/api/user/token', authenticate, generatePatHandler);

function generateSubdomain(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// List User Instances
app.get('/api/instances', authenticate, (req: AuthRequest, res) => {
  let instances: any[];
  if (req.user?.role === 'ADMIN') {
    instances = db.prepare('SELECT * FROM instances ORDER BY created_at DESC').all();
  } else {
    instances = db.prepare('SELECT * FROM instances WHERE user_id = ? ORDER BY created_at DESC').all(req.user?.id);
  }

  res.json(
    instances.map((i) => ({
      id: i.id,
      userId: i.user_id,
      name: i.name,
      runtime: i.runtime,
      sourceType: i.source_type,
      gitUrl: i.git_url,
      zipFileName: i.zip_file_name,
      startCommand: i.start_command,
      internalPort: i.internal_port,
      assignedHostPort: i.assigned_host_port,
      cpuLimit: i.cpu_limit,
      memoryLimit: i.memory_limit,
      diskLimit: i.disk_limit || 2048,
      envVars: i.env_vars ? JSON.parse(i.env_vars) : [],
      status: i.status,
      webhookSecret: i.webhook_secret,
      discordWebhookUrl: i.discord_webhook_url,
      healthCheckEndpoint: i.health_check_endpoint,
      customDomain: i.custom_domain,
      subdomain: i.subdomain,
      rootDir: i.root_dir || '/',
      buildCommand: i.build_command,
      createdAt: i.created_at,
    }))
  );
});

// Create Instance
app.post('/api/instances', authenticate, upload.single('zipFile'), async (req: AuthRequest, res) => {
  const instanceId = `inst-${Date.now().toString(36)}`;
  const appDir = path.join(process.cwd(), 'data', 'apps', instanceId);

  try {
    const { name, runtime, sourceType, gitUrl, startCommand, buildCommand, rootDir, internalPort, cpuLimit, memoryLimit, diskLimit } = req.body;

    const cpuNum = parseInt(cpuLimit, 10);
    const memNum = parseInt(memoryLimit, 10);
    const diskNum = parseInt(diskLimit || '2048', 10);
    const portNum = parseInt(internalPort, 10);

    if (isNaN(cpuNum) || cpuNum < 10 || cpuNum > 100) {
      return res.status(400).json({ error: 'cpuLimit must be between 10 and 100' });
    }
    if (isNaN(memNum) || memNum < 64 || memNum > 1024) {
      return res.status(400).json({ error: 'memoryLimit must be between 64 and 1024' });
    }
    if (isNaN(diskNum) || diskNum < 256 || diskNum > 4096) {
      return res.status(400).json({ error: 'diskLimit must be between 256 and 4096' });
    }
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return res.status(400).json({ error: 'internalPort must be valid (1-65535)' });
    }

    const userInstances = db.prepare('SELECT cpu_limit, memory_limit, disk_limit FROM instances WHERE user_id = ?').all(req.user?.id) as any[];
    if (userInstances.length >= 2 && req.user?.role !== 'ADMIN') {
      return res.status(400).json({ error: 'Instance quota limit reached (Max 2 instances)' });
    }

    const webhookSecret = crypto.randomBytes(16).toString('hex');
    await fs.promises.mkdir(appDir, { recursive: true });

    // Zip Slip Defense with Symlink/Path checks
    if (sourceType === 'zip' && req.file) {
      const zip = new AdmZip(req.file.path);
      const entries = zip.getEntries();
      for (const entry of entries) {
        const entryTargetPath = path.resolve(appDir, entry.entryName);
        if (!entryTargetPath.startsWith(appDir)) {
          console.error(`Zip Slip attack attempt detected: ${entry.entryName}`);
          continue;
        }
        if (entry.isDirectory) {
          await fs.promises.mkdir(entryTargetPath, { recursive: true });
        } else {
          const parentDir = path.dirname(entryTargetPath);
          if (!fs.existsSync(parentDir)) {
            await fs.promises.mkdir(parentDir, { recursive: true });
          }
          await fs.promises.writeFile(entryTargetPath, entry.getData());
        }
      }
      await fs.promises.unlink(req.file.path).catch(() => {});
    } else if (sourceType === 'git' && gitUrl) {
      await GitService.cloneRepo(gitUrl, instanceId);
    }

    const subdomain = generateSubdomain();

    db.prepare(`
      INSERT INTO instances (id, user_id, name, runtime, source_type, git_url, zip_file_name, start_command, build_command, root_dir, internal_port, cpu_limit, memory_limit, disk_limit, status, webhook_secret, subdomain, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'stopped', ?, ?, ?)
    `).run(
      instanceId,
      req.user?.id,
      name,
      runtime,
      sourceType,
      gitUrl || null,
      req.file ? req.file.originalname : null,
      startCommand,
      buildCommand || null,
      rootDir || '/',
      portNum,
      cpuNum,
      memNum,
      diskNum,
      webhookSecret,
      subdomain,
      new Date().toISOString()
    );

    recordAuditLog(req.user!.id, req.user!.username, 'CONTAINER_CREATED', `Created instance ${name} (${instanceId})`, req.ip);

    res.json({ success: true, instanceId });
  } catch (err: any) {
    if (fs.existsSync(appDir)) {
      await fs.promises.rm(appDir, { recursive: true, force: true }).catch(() => {});
    }
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      await fs.promises.unlink(req.file.path).catch(() => {});
    }
  }
});

// Delete Instance Endpoint
app.delete('/api/instances/:id', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }

  try {
    const instanceId = req.params.id;

    await DockerService.removeContainer(instanceId).catch(() => {});

    const appDir = GitService.getAppDir(instanceId);
    if (fs.existsSync(appDir)) {
      await fs.promises.rm(appDir, { recursive: true, force: true }).catch(() => {});
    }

    db.prepare('DELETE FROM deployments WHERE instance_id = ?').run(instanceId);
    db.prepare('DELETE FROM port_requests WHERE instance_id = ?').run(instanceId);
    db.prepare('DELETE FROM instances WHERE id = ?').run(instanceId);

    recordAuditLog(req.user!.id, req.user!.username, 'CONTAINER_DELETED', `Deleted instance ${instanceId}`, req.ip);

    res.json({ success: true, message: 'Instance deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Instance Settings
const saveSettingsHandler = async (req: AuthRequest, res: express.Response) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }

  try {
    const { startCommand, buildCommand, rootDir, internalPort, envVars, cpuLimit, memoryLimit, diskLimit, discordWebhookUrl, healthCheckEndpoint, customDomain } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (startCommand) {
      updates.push('start_command = ?');
      params.push(startCommand);
    }
    if (buildCommand !== undefined) {
      updates.push('build_command = ?');
      params.push(buildCommand);
    }
    if (rootDir !== undefined) {
      updates.push('root_dir = ?');
      params.push(rootDir);
    }
    if (internalPort) {
      updates.push('internal_port = ?');
      params.push(parseInt(internalPort, 10));
    }
    if (envVars) {
      updates.push('env_vars = ?');
      params.push(JSON.stringify(envVars));
    }
    if (cpuLimit) {
      updates.push('cpu_limit = ?');
      params.push(parseInt(cpuLimit, 10));
    }
    if (memoryLimit) {
      updates.push('memory_limit = ?');
      params.push(parseInt(memoryLimit, 10));
    }
    if (diskLimit) {
      updates.push('disk_limit = ?');
      params.push(parseInt(diskLimit, 10));
    }
    if (discordWebhookUrl !== undefined) {
      updates.push('discord_webhook_url = ?');
      params.push(discordWebhookUrl);
    }
    if (healthCheckEndpoint !== undefined) {
      updates.push('health_check_endpoint = ?');
      params.push(healthCheckEndpoint);
    }
    if (customDomain !== undefined) {
      updates.push('custom_domain = ?');
      params.push(customDomain);
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      db.prepare(`UPDATE instances SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      await DockerService.recreateContainer(req.params.id).catch((err) => {
        console.error('Failed to recreate container on settings change:', err);
      });
    }

    recordAuditLog(req.user!.id, req.user!.username, 'SETTINGS_UPDATED', `Updated settings for instance ${req.params.id}`, req.ip);

    res.json({ success: true, message: 'Settings saved and container updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

app.post('/api/instances/:id/settings', authenticate, saveSettingsHandler);
app.post('/api/instances/:id/config', authenticate, saveSettingsHandler);

// Container Action: Start
app.post('/api/instances/:id/start', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }
  try {
    await DockerService.startContainer(req.params.id);
    db.prepare("UPDATE instances SET status = 'running' WHERE id = ?").run(req.params.id);
    recordAuditLog(req.user!.id, req.user!.username, 'CONTAINER_STARTED', `Started instance ${req.params.id}`, req.ip);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Container Action: Stop
app.post('/api/instances/:id/stop', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }
  try {
    await DockerService.stopContainer(req.params.id);
    db.prepare("UPDATE instances SET status = 'stopped' WHERE id = ?").run(req.params.id);
    recordAuditLog(req.user!.id, req.user!.username, 'CONTAINER_STOPPED', `Stopped instance ${req.params.id}`, req.ip);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Container Action: Restart
app.post('/api/instances/:id/restart', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }
  try {
    await DockerService.restartContainer(req.params.id);
    recordAuditLog(req.user!.id, req.user!.username, 'CONTAINER_RESTARTED', `Restarted instance ${req.params.id}`, req.ip);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Container Logs
app.get('/api/instances/:id/logs', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }
  try {
    const logs = await DockerService.getContainerLogs(req.params.id);
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear Container Logs (Permanently wipe logs for instance)
app.delete('/api/instances/:id/logs', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }
  try {
    await DockerService.clearContainerLogs(req.params.id);
    recordAuditLog(req.user!.id, req.user!.username, 'LOGS_CLEARED', `Cleared container logs for ${req.params.id}`, req.ip);
    res.json({ success: true, message: '日誌已完全清空' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Workspace Files Listing (🔴 Security Fix Item #2: Symlink Realpath Traversal Protection)
app.get('/api/instances/:id/files', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }

  try {
    const appDir = GitService.getAppDir(req.params.id);
    const reqDir = (req.query.dir || req.query.path || req.query.filePath || '/').toString();

    const safeTargetDir = path.resolve(appDir, '.' + path.sep + reqDir.replace(/^[/\\]+/, ''));
    if (!safeTargetDir.startsWith(appDir)) {
      return res.status(403).json({ error: 'Forbidden: Path traversal attempt detected' });
    }

    if (!fs.existsSync(safeTargetDir)) {
      return res.json({ success: true, files: [] });
    }

    // Resolve real canonical path to detect symlink escape
    const realTargetDir = await fs.promises.realpath(safeTargetDir).catch(() => safeTargetDir);
    if (!realTargetDir.startsWith(appDir)) {
      return res.status(403).json({ error: 'Forbidden: Symlink path traversal attempt detected' });
    }

    const fileNames = await fs.promises.readdir(realTargetDir);
    const files = await Promise.all(
      fileNames.map(async (name) => {
        const fullPath = path.join(realTargetDir, name);
        const stat = await fs.promises.stat(fullPath);
        const relPath = '/' + path.relative(appDir, fullPath).replace(/\\/g, '/');
        return {
          name,
          path: relPath,
          isDirectory: stat.isDirectory(),
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
        };
      })
    );

    res.json({ success: true, files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Read File Content (🔴 Security Fix Item #2: Symlink Realpath Traversal Protection)
const readFileHandler = async (req: AuthRequest, res: express.Response) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }

  try {
    const appDir = GitService.getAppDir(req.params.id);
    const reqPath = (req.query.path || req.query.filePath || req.body?.path || req.body?.filePath || '').toString();

    const safeFilePath = path.resolve(appDir, '.' + path.sep + reqPath.replace(/^[/\\]+/, ''));
    if (!safeFilePath.startsWith(appDir)) {
      return res.status(403).json({ error: 'Forbidden: Path traversal attempt detected' });
    }

    if (!fs.existsSync(safeFilePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // 🔴 Resolve canonical real path to block Symlink escape to host filesystem
    const realFilePath = await fs.promises.realpath(safeFilePath).catch(() => safeFilePath);
    if (!realFilePath.startsWith(appDir)) {
      return res.status(403).json({ error: 'Forbidden: Symlink path traversal attempt detected' });
    }

    const content = await fs.promises.readFile(realFilePath, 'utf-8');
    res.json({ success: true, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
app.get('/api/instances/:id/files/read', authenticate, readFileHandler);
app.post('/api/instances/:id/files/read', authenticate, readFileHandler);

// Save File Content (🔴 Security Fix Item #2: Symlink Realpath Traversal Protection)
app.post('/api/instances/:id/files/save', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }

  try {
    const reqPath = (req.body.path || req.body.filePath || '').toString();
    const content = req.body.content || '';
    if (!reqPath) return res.status(400).json({ error: 'Path is required' });

    const appDir = GitService.getAppDir(req.params.id);

    const safeFilePath = path.resolve(appDir, '.' + path.sep + reqPath.replace(/^[/\\]+/, ''));
    if (!safeFilePath.startsWith(appDir)) {
      return res.status(403).json({ error: 'Forbidden: Path traversal attempt detected' });
    }

    const parentDir = path.dirname(safeFilePath);
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true });
    }

    // 🔴 Resolve parent directory canonical real path to block Symlink escape
    const realParentDir = await fs.promises.realpath(parentDir).catch(() => parentDir);
    if (!realParentDir.startsWith(appDir)) {
      return res.status(403).json({ error: 'Forbidden: Symlink path traversal attempt detected' });
    }

    await fs.promises.writeFile(safeFilePath, content, 'utf-8');
    recordAuditLog(req.user!.id, req.user!.username, 'FILE_SAVED', `Saved file ${reqPath} in instance ${req.params.id}`, req.ip);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Deployments History
app.get('/api/instances/:id/deployments', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }
  try {
    const history = await GitService.getCommitHistory(req.params.id);
    res.json({ success: true, deployments: history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Container Real-time Resource Stats
app.get('/api/instances/:id/stats', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }

  try {
    const stats = await DockerService.getContainerStats(req.params.id);
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rollback Commit
app.post('/api/instances/:id/rollback', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }

  try {
    const { commitHash } = req.body;
    if (!commitHash) {
      return res.status(400).json({ error: 'commitHash is required' });
    }

    await GitService.rollbackToCommit(req.params.id, commitHash);
    await DockerService.restartContainer(req.params.id);

    recordAuditLog(req.user!.id, req.user!.username, 'ROLLBACK_EXECUTED', `Rolled back instance ${req.params.id} to ${commitHash}`, req.ip);

    res.json({ success: true, message: `Rolled back to commit ${commitHash} and restarted container.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Route: Get ALL Users
app.get('/api/admin/users', authenticate, (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  const users = db.prepare('SELECT id, discord_id as discordId, username, avatar, role, status, created_at as createdAt FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// Admin Route: Approve User
app.post('/api/admin/users/:id/approve', authenticate, (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  db.prepare("UPDATE users SET status = 'APPROVED' WHERE id = ?").run(req.params.id);
  recordAuditLog(req.user!.id, req.user!.username, 'USER_APPROVED', `Approved user ${req.params.id}`, req.ip);
  res.json({ success: true });
});

// Admin Route: Reject User
app.post('/api/admin/users/:id/reject', authenticate, (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  db.prepare("UPDATE users SET status = 'REJECTED' WHERE id = ?").run(req.params.id);
  recordAuditLog(req.user!.id, req.user!.username, 'USER_REJECTED', `Rejected user ${req.params.id}`, req.ip);
  res.json({ success: true });
});

// Admin Route: Port Requests List
const getPortRequestsHandler = (req: AuthRequest, res: express.Response) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  const requests = db.prepare(`
    SELECT pr.*, u.username, i.name as instance_name
    FROM port_requests pr
    JOIN users u ON pr.user_id = u.id
    JOIN instances i ON pr.instance_id = i.id
    ORDER BY pr.created_at DESC
  `).all() as any[];

  res.json(
    requests.map((r) => ({
      id: r.id,
      instanceId: r.instance_id,
      userId: r.user_id,
      username: r.username,
      instanceName: r.instance_name,
      internalPort: r.internal_port,
      assignedHostPort: r.assigned_host_port,
      status: r.status,
      createdAt: r.created_at,
    }))
  );
};
// Submit & Auto-Approve Port Request (Instant allocation, no admin manual approval needed!)
app.post('/api/port-requests', authenticate, async (req: AuthRequest, res) => {
  try {
    const { instanceId, internalPort } = req.body;
    if (!instanceId) {
      return res.status(400).json({ error: 'instanceId is required' });
    }

    const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as any;
    if (!inst) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    if (inst.user_id !== req.user?.id && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied: You do not own this instance' });
    }

    // Auto allocate host port & 8-character subdomain
    let assignedHostPort = inst.assigned_host_port;
    if (!assignedHostPort) {
      assignedHostPort = await findAvailableHostPort();
    }

    let subdomain = inst.subdomain;
    if (!subdomain) {
      subdomain = generateSubdomain();
    }

    // Write to DB instantly as APPROVED
    db.prepare('UPDATE instances SET assigned_host_port = ?, subdomain = ? WHERE id = ?').run(assignedHostPort, subdomain, instanceId);

    const requestId = `port-req-${Date.now().toString(36)}`;
    db.prepare(`
      INSERT INTO port_requests (id, instance_id, user_id, internal_port, assigned_host_port, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'APPROVED', ?)
    `).run(requestId, instanceId, req.user?.id, parseInt(internalPort || inst.internal_port, 10), assignedHostPort, new Date().toISOString());

    // Recreate container so Docker exposes the allocated host port
    await DockerService.recreateContainer(instanceId).catch(() => {});

    recordAuditLog(req.user!.id, req.user!.username, 'PORT_AUTO_APPROVED', `System auto-assigned Host Port ${assignedHostPort} & Subdomain app-${subdomain} for ${instanceId}`, req.ip);

    res.json({
      success: true,
      requestId,
      assignedHostPort,
      subdomain,
      message: 'Port 與專屬子域名已由系統自動核發成功！',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
// Delete / Release assigned public port & subdomain
app.delete('/api/instances/:id/port', authenticate, async (req: AuthRequest, res) => {
  try {
    const instanceId = req.params.id;
    const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as any;
    if (!inst) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    if (inst.user_id !== req.user?.id && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied: You do not own this instance' });
    }

    db.prepare('UPDATE instances SET assigned_host_port = NULL, subdomain = NULL WHERE id = ?').run(instanceId);
    db.prepare('DELETE FROM port_requests WHERE instance_id = ?').run(instanceId);

    await DockerService.recreateContainer(instanceId).catch(() => {});

    recordAuditLog(req.user!.id, req.user!.username, 'PORT_RELEASED', `Released Host Port & Subdomain for ${instanceId}`, req.ip);

    res.json({ success: true, message: '已成功移除對外 Port 與專屬域名' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Re-issue a brand new public port & 8-char random subdomain
app.post('/api/instances/:id/port/reissue', authenticate, async (req: AuthRequest, res) => {
  try {
    const instanceId = req.params.id;
    const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as any;
    if (!inst) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    if (inst.user_id !== req.user?.id && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied: You do not own this instance' });
    }

    // Allocate new port and brand new 8-char random subdomain
    const newHostPort = await findAvailableHostPort();
    const newSubdomain = generateSubdomain();

    db.prepare('UPDATE instances SET assigned_host_port = ?, subdomain = ? WHERE id = ?').run(newHostPort, newSubdomain, instanceId);

    const requestId = `port-req-${Date.now().toString(36)}`;
    db.prepare(`
      INSERT INTO port_requests (id, instance_id, user_id, internal_port, assigned_host_port, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'APPROVED', ?)
    `).run(requestId, instanceId, req.user?.id, inst.internal_port, newHostPort, new Date().toISOString());

    await DockerService.recreateContainer(instanceId).catch(() => {});

    recordAuditLog(req.user!.id, req.user!.username, 'PORT_REISSUED', `Re-issued Host Port ${newHostPort} & Subdomain app-${newSubdomain} for ${instanceId}`, req.ip);

    res.json({
      success: true,
      assignedHostPort: newHostPort,
      subdomain: newSubdomain,
      message: '已重新核發全新對外 Port 與 8 位專屬域名！',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/port-requests', authenticate, getPortRequestsHandler);
app.get('/api/admin/ports', authenticate, getPortRequestsHandler);

// Admin Route: Approve Port Request
const approvePortRequestHandler = async (req: AuthRequest, res: express.Response) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });

  const portReq = db.prepare('SELECT * FROM port_requests WHERE id = ?').get(req.params.id) as any;
  if (!portReq) return res.status(404).json({ error: 'Port request not found' });

  try {
    const assignedHostPort = await findAvailableHostPort();

    db.prepare("UPDATE port_requests SET status = 'APPROVED', assigned_host_port = ? WHERE id = ?").run(assignedHostPort, req.params.id);
    db.prepare('UPDATE instances SET assigned_host_port = ? WHERE id = ?').run(assignedHostPort, portReq.instance_id);

    await DockerService.recreateContainer(portReq.instance_id).catch(() => {});

    recordAuditLog(req.user!.id, req.user!.username, 'PORT_APPROVED', `Assigned Host Port ${assignedHostPort} for instance ${portReq.instance_id}`, req.ip);

    res.json({ success: true, assignedHostPort });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
app.post('/api/admin/port-requests/:id/approve', authenticate, approvePortRequestHandler);
app.post('/api/admin/ports/:id/approve', authenticate, approvePortRequestHandler);

// Admin Route: Reject Port Request
const rejectPortRequestHandler = (req: AuthRequest, res: express.Response) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  db.prepare("UPDATE port_requests SET status = 'REJECTED' WHERE id = ?").run(req.params.id);
  recordAuditLog(req.user!.id, req.user!.username, 'PORT_REJECTED', `Rejected port request ${req.params.id}`, req.ip);
  res.json({ success: true });
};
app.post('/api/admin/port-requests/:id/reject', authenticate, rejectPortRequestHandler);
app.post('/api/admin/ports/:id/reject', authenticate, rejectPortRequestHandler);

// Admin Route: Get ALL instances
app.get('/api/admin/instances', authenticate, (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  const instances = db.prepare(`
    SELECT i.*, u.username as owner_name, u.discord_id as owner_discord_id
    FROM instances i
    JOIN users u ON i.user_id = u.id
    ORDER BY i.created_at DESC
  `).all() as any[];

  res.json({
    success: true,
    instances: instances.map((i) => ({
      id: i.id,
      userId: i.user_id,
      ownerName: i.owner_name,
      ownerDiscordId: i.owner_discord_id,
      name: i.name,
      runtime: i.runtime,
      sourceType: i.source_type,
      gitUrl: i.git_url,
      zipFileName: i.zip_file_name,
      startCommand: i.start_command,
      internalPort: i.internal_port,
      assignedHostPort: i.assigned_host_port,
      cpuLimit: i.cpu_limit,
      memoryLimit: i.memory_limit,
      diskLimit: i.disk_limit || 2048,
      envVars: i.env_vars ? JSON.parse(i.env_vars) : [],
      status: i.status,
      webhookSecret: i.webhook_secret,
      discordWebhookUrl: i.discord_webhook_url,
      healthCheckEndpoint: i.health_check_endpoint,
      customDomain: i.custom_domain,
      subdomain: i.subdomain,
      rootDir: i.root_dir || '/',
      buildCommand: i.build_command,
      createdAt: i.created_at,
    })),
  });
});

// Admin Route: Force Stop Instance
app.post('/api/admin/instances/:id/stop', authenticate, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  try {
    await DockerService.stopContainer(req.params.id);
    db.prepare("UPDATE instances SET status = 'stopped' WHERE id = ?").run(req.params.id);
    recordAuditLog(req.user!.id, req.user!.username, 'ADMIN_FORCE_STOP', `Admin stopped instance ${req.params.id}`, req.ip);
    res.json({ success: true, message: 'Instance stopped by Admin' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Route: Get Security Audit Logs
app.get('/api/admin/audit-logs', authenticate, (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50').all();
  res.json({ success: true, logs });
});

// AI MCP Server JSON-RPC Endpoint
app.post('/api/mcp', authenticate, (req: AuthRequest, res) => {
  res.setHeader('Content-Type', 'application/json');
  handleMcpJsonRpcRequest(req.body, res);
});

// GitHub Webhook Endpoint
app.post('/api/webhooks/github/:instanceId', async (req, res) => {
  const instanceId = req.params.instanceId;
  const signature = req.headers['x-hub-signature-256'] as string;

  const instance = db.prepare('SELECT webhook_secret FROM instances WHERE id = ?').get(instanceId) as any;
  if (!instance || !instance.webhook_secret) {
    return res.status(404).json({ error: 'Webhook secret not configured' });
  }

  const payload = JSON.stringify(req.body);

  if (!verifyGitHubSignature(payload, signature, instance.webhook_secret)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  try {
    await processWebhookDeployment(instanceId);
    res.json({ success: true, message: 'Webhook deployment triggered' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`[Craft-Core Hosting Backend] Server running securely on port ${PORT}`);
  await syncContainerStatuses();
});
