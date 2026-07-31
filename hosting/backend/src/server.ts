import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import net from 'net';
import { execFile } from 'child_process';
import util from 'util';
import http from 'http';

const execFilePromise = util.promisify(execFile);

import { initDatabase, db, recordAuditLog } from './db/database';
import { handleUserAuthentication, generateToken, authenticate, AuthRequest, checkInstanceOwnership } from './services/auth';
import { DockerService } from './services/docker';
import { verifyGitHubSignature, processWebhookDeployment } from './services/webhook';
import { handleMcpJsonRpcRequest } from './mcp/server';
import { GitService } from './services/git';
import AdmZip from 'adm-zip';

dotenv.config();
initDatabase();

import httpProxy from 'http-proxy';

const app = express();
const PORT = process.env.PORT || 3005;

// 🔴 Security/Infrastructure Fix: Trust Proxy for Rate Limiter
app.set('trust proxy', 1);

// High-Performance HTTP Keep-Alive Agent for Subdomain Proxy
const keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 200, keepAliveMsecs: 30000 });
const appProxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
  xfwd: true,
  agent: keepAliveAgent,
});

appProxy.on('error', (err: any, _req: any, res: any) => {
  if (res && 'writeHead' in res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('容器通訊通道連線失敗，請確認容器是否已啟動');
  }
});

// Subdomain Reverse Proxy Middleware for app-*.hosting.craft-core.xyz (Must run BEFORE CORS/Parsers)
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const host = req.headers.host || '';
  const match = host.match(/^app-([a-z0-9]+)\.hosting\.craft-core\.xyz$/i);
  if (!match) return next();

  const sub = match[1];
  const inst = db.prepare('SELECT assigned_host_port FROM instances WHERE (subdomain = ? OR assigned_host_port = ?) AND assigned_host_port IS NOT NULL').get(sub, parseInt(sub, 10)) as any;

  if (!inst || !inst.assigned_host_port) {
    return res.status(404).send('對外連線通道未開通或專案不存在');
  }

  appProxy.web(req, res, { target: `http://127.0.0.1:${inst.assigned_host_port}` });
});

// 🔴 Security Fix Item #1: Strict CORS Whitelist to prevent CSRF/CORS Origin Reflection
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://hosting.craft-core.xyz',
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.hosting.craft-core.xyz')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// 🟡 Performance/Stability Fix: Increase Body Parser limit to 2GB for large archive uploads
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ extended: true, limit: '2gb' }));

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests from this IP, please try again after 1 minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

const upload = multer({
  dest: path.join(process.cwd(), 'data', 'tmp'),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB max upload limit
});

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

// Helper: Scan project directory for hardcoded secrets & tokens
async function scanDirectoryForSecrets(dirPath: string): Promise<string[]> {
  const warnings: string[] = [];
  try {
    const files = await fs.promises.readdir(dirPath, { recursive: true });
    for (const relativeFile of files) {
      if (typeof relativeFile !== 'string') continue;
      if (relativeFile.includes('node_modules') || relativeFile.includes('.git') || relativeFile.includes('dist')) continue;

      const fullPath = path.join(dirPath, relativeFile);
      const stat = await fs.promises.stat(fullPath).catch(() => null);
      if (!stat || !stat.isFile() || stat.size > 2 * 1024 * 1024) continue;

      const content = await fs.promises.readFile(fullPath, 'utf-8').catch(() => '');
      if (!content) continue;

      // 1. Discord Bot Token regex
      const discordTokenMatch = content.match(/[a-zA-Z0-9_-]{24}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27,38}/);
      if (discordTokenMatch && !relativeFile.endsWith('.env')) {
        warnings.push(`檔案 ${relativeFile} 包含硬編碼 Discord Bot Token (${discordTokenMatch[0].substring(0, 10)}...)`);
      }

      // 2. OpenAI / Stripe / AWS Private API Key regex
      const apiKeyMatch = content.match(/sk-[a-zA-Z0-9]{32,}/) || content.match(/AKIA[0-9A-Z]{16}/);
      if (apiKeyMatch && !relativeFile.endsWith('.env')) {
        warnings.push(`檔案 ${relativeFile} 包含硬編碼 API Key 機密憑證`);
      }
    }
  } catch (err) {
    console.warn('[Secrets Scanner] Error scanning directory:', err);
  }
  return warnings;
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

// Caddy On-Demand TLS Security Check Endpoint
app.get('/api/caddy-ask', (req, res) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).send('No domain specified');

  const cleanDomain = domain.toLowerCase().trim();

  // Allow all app-*.hosting.craft-core.xyz subdomains
  if (cleanDomain.endsWith('.hosting.craft-core.xyz')) {
    return res.status(200).send('OK');
  }

  // Allow registered custom CNAME domains
  const inst = db.prepare('SELECT id FROM instances WHERE custom_domain = ?').get(cleanDomain);
  if (inst) {
    return res.status(200).send('OK');
  }

  return res.status(400).send('Domain authorization denied');
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

// List User Instances (Always returns only the authenticated user's own instances)
app.get('/api/instances', authenticate, async (req: AuthRequest, res) => {
  const instances: any[] = db.prepare('SELECT * FROM instances WHERE user_id = ? ORDER BY created_at DESC').all(req.user?.id) as any[];

  const updatedInstances = await Promise.all(
    instances.map(async (i) => {
      const isRunning = await DockerService.isContainerRunning(i.id).catch(() => false);
      const actualStatus = isRunning ? 'running' : (i.status === 'running' ? 'stopped' : i.status);
      if (i.status !== actualStatus) {
        db.prepare('UPDATE instances SET status = ? WHERE id = ?').run(actualStatus, i.id);
      }
      return {
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
        status: actualStatus,
        webhookSecret: i.webhook_secret,
        discordWebhookUrl: i.discord_webhook_url,
        healthCheckEndpoint: i.health_check_endpoint,
        customDomain: i.custom_domain,
        subdomain: i.subdomain,
        rootDir: i.root_dir || '/',
        buildCommand: i.build_command,
        createdAt: i.created_at,
      };
    })
  );

  res.json(updatedInstances);
});

// Chunked Upload: Upload 5MB slice
app.post('/api/upload/chunk', authenticate, upload.single('chunk'), async (req: AuthRequest, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;
    if (!uploadId || chunkIndex === undefined || !req.file) {
      return res.status(400).json({ error: 'Missing chunk upload parameters' });
    }

    const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
    const chunkDir = path.join(process.cwd(), 'data', 'tmp', `chunked_${safeUploadId}`);
    await fs.promises.mkdir(chunkDir, { recursive: true });

    const chunkPath = path.join(chunkDir, `chunk_${parseInt(chunkIndex, 10)}`);
    await fs.promises.rename(req.file.path, chunkPath);

    res.json({ success: true, chunkIndex: parseInt(chunkIndex, 10) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Chunked Upload: Merge all 5MB slices into single ZIP
app.post('/api/upload/merge', authenticate, async (req: AuthRequest, res) => {
  try {
    const { uploadId, totalChunks } = req.body;
    if (!uploadId || !totalChunks) {
      return res.status(400).json({ error: 'Missing merge parameters' });
    }

    const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
    const chunkDir = path.join(process.cwd(), 'data', 'tmp', `chunked_${safeUploadId}`);
    const mergedZipPath = path.join(process.cwd(), 'data', 'tmp', `${safeUploadId}.zip`);

    const writeStream = fs.createWriteStream(mergedZipPath);
    const count = parseInt(totalChunks, 10);

    for (let i = 0; i < count; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${i}`);
      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({ error: `Missing chunk ${i}` });
      }
      const buffer = await fs.promises.readFile(chunkPath);
      writeStream.write(buffer);
      await fs.promises.unlink(chunkPath).catch(() => {});
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end((err?: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await fs.promises.rm(chunkDir, { recursive: true, force: true }).catch(() => {});

    res.json({ success: true, chunkedZipKey: safeUploadId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Parse docker run command or docker-compose yaml
function parseDockerCommandOrCompose(inputStr: string): { image?: string; port?: number; envVars: { key: string; value: string }[] } {
  const result: { image?: string; port?: number; envVars: { key: string; value: string }[] } = { envVars: [] };
  if (!inputStr || !inputStr.trim()) return result;

  const str = inputStr.trim();

  if (str.includes('docker run') || str.includes('docker') || str.includes(':')) {
    const portMatch = str.match(/(?:-p|--publish)\s+(?:(?:\d+\.):)?(\d+):(\d+)/i);
    if (portMatch) {
      result.port = parseInt(portMatch[2] || portMatch[1], 10);
    }

    const strippedForImage = str.replace(/(?:-p|--publish)\s+(?:\d+:)?\d+/gi, '');
    const imageMatch = strippedForImage.match(/(?:[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+|[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+|[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
    if (imageMatch && !/^\d+:\d+$/.test(imageMatch[1])) {
      result.image = imageMatch[1];
    }

    const envMatches = str.matchAll(/(?:-e|--env)\s+([A-Za-z_][A-Za-z0-9_]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g);
    for (const match of envMatches) {
      const key = match[1];
      const val = match[2] || match[3] || match[4] || '';
      result.envVars.push({ key, value: val });
    }
  }

  if (!result.image && (str.includes('image:') || str.includes('services:'))) {
    const composeImageMatch = str.match(/image:\s*["']?([^\s"']+)["']?/i);
    if (composeImageMatch) {
      result.image = composeImageMatch[1];
    }

    const composePortMatch = str.match(/ports:\s*\n\s*-\s*["']?(\d+):(\d+)["']?/i) || str.match(/-\s*["']?(\d+):(\d+)["']?/i);
    if (composePortMatch) {
      result.port = parseInt(composePortMatch[2] || composePortMatch[1], 10);
    }
  }

  return result;
}

// Real-Time Docker Pull Status API
app.get('/api/system/docker-pull-status', (req, res) => {
  const { pullingStatusMap } = require('./services/docker');
  const image = (req.query.image || '').toString().trim();
  if (image && pullingStatusMap.has(image)) {
    return res.json({ pulling: true, status: pullingStatusMap.get(image) });
  }
  if (pullingStatusMap.size > 0) {
    const firstStatus = Array.from(pullingStatusMap.values())[0];
    return res.json({ pulling: true, status: firstStatus });
  }
  return res.json({ pulling: false, status: '' });
});

// Create Instance
app.post('/api/instances', authenticate, upload.single('zipFile'), async (req: AuthRequest, res) => {
  const instanceId = `inst-${Date.now().toString(36)}`;
  const appDir = path.join(process.cwd(), 'data', 'apps', instanceId);

  try {
    const { name, runtime, sourceType, gitUrl, startCommand, buildCommand, rootDir, internalPort, cpuLimit, memoryLimit, diskLimit, chunkedZipKey, dockerImage, dockerRunCmd } = req.body;

    let finalRuntime = runtime;
    let finalDockerImage = dockerImage && dockerImage.trim() ? dockerImage.trim() : undefined;
    let finalPortNum = parseInt(internalPort || '3000', 10);
    let parsedEnvVars: any[] = [];

    if (dockerRunCmd || dockerImage || runtime === 'docker') {
      finalRuntime = 'docker';
      const parsed = parseDockerCommandOrCompose(dockerRunCmd || '');
      if (!finalDockerImage && parsed.image) finalDockerImage = parsed.image;
      if (parsed.port && isNaN(parseInt(internalPort, 10))) finalPortNum = parsed.port;
      if (parsed.envVars.length > 0) parsedEnvVars = parsed.envVars;
    }

    const cpuNum = parseInt(cpuLimit, 10);
    const memNum = parseInt(memoryLimit, 10);
    const diskNum = parseInt(diskLimit || '2048', 10);
    const portNum = isNaN(finalPortNum) ? 3000 : finalPortNum;

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

    // Global Server Memory Quota Check (Max 10GB / 10240MB allocated total across all instances)
    const globalAllocatedRow = db.prepare('SELECT SUM(memory_limit) AS total FROM instances').get() as any;
    const currentGlobalAllocated = globalAllocatedRow && globalAllocatedRow.total ? globalAllocatedRow.total : 0;
    const MAX_GLOBAL_MEMORY_MB = 10240;

    if (currentGlobalAllocated + memNum > MAX_GLOBAL_MEMORY_MB && req.user?.role !== 'ADMIN') {
      return res.status(400).json({
        error: `伺服器雲端總記憶體配額已達安全上限 (${(currentGlobalAllocated / 1024).toFixed(1)} GB / 10 GB)，暫無法配給更多記憶體。`,
      });
    }

    const webhookSecret = crypto.randomBytes(16).toString('hex');
    await fs.promises.mkdir(appDir, { recursive: true });

    // Determine target ZIP file path (direct upload req.file OR chunkedZipKey)
    let targetZipPath = req.file?.path;
    if (!targetZipPath && chunkedZipKey) {
      const safeKey = chunkedZipKey.replace(/[^a-zA-Z0-9_-]/g, '');
      const potentialPath = path.join(process.cwd(), 'data', 'tmp', `${safeKey}.zip`);
      if (fs.existsSync(potentialPath)) {
        targetZipPath = potentialPath;
      }
    }

    // Zip Extraction with Native Fast Unzip & Zip Slip Defense
    if (sourceType === 'zip' && targetZipPath) {
      try {
        await execFilePromise('unzip', ['-q', '-o', targetZipPath, '-d', appDir]);
      } catch (nativeErr) {
        console.warn('[ZIP Extraction] Native unzip unavailable or failed, falling back to AdmZip:', nativeErr);
        const zip = new AdmZip(targetZipPath);
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
      }
      await fs.promises.unlink(targetZipPath).catch(() => {});
    } else if (sourceType === 'git' && gitUrl) {
      await GitService.cloneRepo(gitUrl, instanceId);
    }

    // Scan project files for hardcoded secrets
    const secretWarnings = await scanDirectoryForSecrets(appDir);
    if (secretWarnings.length > 0) {
      recordAuditLog(
        req.user!.id,
        req.user!.username,
        'SECURITY_SECRETS_WARNING',
        `Secrets scanner detected hardcoded tokens in ${name} (${instanceId}): ${secretWarnings.join('; ')}`,
        req.ip
      );
    }

    let envVarsToSave: any[] = [...parsedEnvVars];
    if (finalRuntime === 'mongodb') {
      const dbPassword = crypto.randomBytes(8).toString('hex');
      envVarsToSave = [
        { key: 'MONGO_INITDB_ROOT_USERNAME', value: 'admin' },
        { key: 'MONGO_INITDB_ROOT_PASSWORD', value: dbPassword },
        { key: 'DATABASE_NAME', value: name.replace(/[^a-zA-Z0-9_]/g, '_') },
      ];
    } else if (finalRuntime === 'postgres') {
      const dbPassword = crypto.randomBytes(8).toString('hex');
      envVarsToSave = [
        { key: 'POSTGRES_USER', value: 'postgres' },
        { key: 'POSTGRES_PASSWORD', value: dbPassword },
        { key: 'POSTGRES_DB', value: name.replace(/[^a-zA-Z0-9_]/g, '_') },
      ];
    } else if (finalRuntime === 'mysql') {
      const dbPassword = crypto.randomBytes(8).toString('hex');
      envVarsToSave = [
        { key: 'MYSQL_ROOT_PASSWORD', value: dbPassword },
        { key: 'MYSQL_DATABASE', value: name.replace(/[^a-zA-Z0-9_]/g, '_') },
      ];
    } else if (finalRuntime === 'redis') {
      const dbPassword = crypto.randomBytes(8).toString('hex');
      envVarsToSave = [
        { key: 'REDIS_PASSWORD', value: dbPassword },
      ];
    }

    const subdomain = generateSubdomain();

    db.prepare(`
      INSERT INTO instances (id, user_id, name, runtime, source_type, git_url, zip_file_name, start_command, build_command, root_dir, internal_port, cpu_limit, memory_limit, disk_limit, status, webhook_secret, subdomain, env_vars, docker_image, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'stopped', ?, ?, ?, ?, ?)
    `).run(
      instanceId,
      req.user?.id,
      name,
      finalRuntime,
      sourceType,
      gitUrl || null,
      req.file ? req.file.originalname : null,
      startCommand || 'none',
      buildCommand || null,
      rootDir || '/',
      portNum,
      cpuNum,
      memNum,
      diskNum,
      webhookSecret,
      subdomain,
      envVarsToSave.length > 0 ? JSON.stringify(envVarsToSave) : null,
      finalDockerImage || null,
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
    if (cpuLimit !== undefined) {
      const c = parseInt(cpuLimit, 10);
      if (isNaN(c) || c < 10 || c > 100) {
        return res.status(400).json({ error: 'CPU 配額限制必須在 10% ~ 100% 之間' });
      }
      updates.push('cpu_limit = ?');
      params.push(c);
    }
    if (memoryLimit !== undefined) {
      const m = parseInt(memoryLimit, 10);
      if (isNaN(m) || m < 64 || m > 1024) {
        return res.status(400).json({ error: '記憶體限制必須在 64MB ~ 1024MB 之間' });
      }
      updates.push('memory_limit = ?');
      params.push(m);
    }
    if (diskLimit !== undefined) {
      const d = parseInt(diskLimit, 10);
      if (isNaN(d) || d < 256 || d > 4096) {
        return res.status(400).json({ error: '硬碟空間限制必須在 256MB ~ 4096MB 之間' });
      }
      updates.push('disk_limit = ?');
      params.push(d);
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

// Container Action: Upgrade Image & Recreate
app.post('/api/instances/:id/upgrade', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: '存取遭拒：您不擁有此專案權限' });
  }
  try {
    await DockerService.upgradeContainer(req.params.id);
    recordAuditLog(req.user!.id, req.user!.username, 'CONTAINER_UPGRADED', `Upgraded instance image for ${req.params.id}`, req.ip);
    res.json({ success: true, message: '容器鏡像已成功升級至最新版本並完成平滑重啟' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Container Action: Exec Command inside Container
app.post('/api/instances/:id/exec', authenticate, async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }
  try {
    const { command } = req.body;
    if (!command || !command.trim()) {
      return res.status(400).json({ error: '請輸入有效的指令' });
    }

    const result = await DockerService.execInContainer(req.params.id, command.trim());
    recordAuditLog(req.user!.id, req.user!.username, 'CONTAINER_EXEC', `Executed command in ${req.params.id}: ${command.trim().substring(0, 50)}`, req.ip);
    res.json({ success: true, ...result });
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
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }
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
    const files = (
      await Promise.all(
        fileNames.map(async (name) => {
          try {
            const fullPath = path.join(realTargetDir, name);
            const stat = await fs.promises.stat(fullPath);
            const relPath = '/' + path.relative(appDir, fullPath).replace(/\\/g, '/');
            return {
              name,
              path: relPath,
              isDirectory: stat.isDirectory(),
              size: stat.size,
              updatedAt: stat.mtime ? stat.mtime.toISOString() : new Date().toISOString(),
            };
          } catch (fileErr) {
            console.warn(`[File Listing] Skipping unstatable file ${name}:`, fileErr);
            return null;
          }
        })
      )
    ).filter(Boolean);

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

// Upload File Endpoint to Project Directory
app.post('/api/instances/:id/files/upload', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  if (!checkInstanceOwnership(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Access denied: You do not own this instance' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const appDir = GitService.getAppDir(req.params.id);
    const targetDirRel = (req.body.targetDir || '/').toString();
    const safeTargetDir = path.resolve(appDir, '.' + path.sep + targetDirRel.replace(/^[/\\]+/, ''));

    if (!safeTargetDir.startsWith(appDir)) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Forbidden: Path traversal attempt detected' });
    }

    if (!fs.existsSync(safeTargetDir)) {
      await fs.promises.mkdir(safeTargetDir, { recursive: true });
    }

    const destPath = path.join(safeTargetDir, req.file.originalname);
    await fs.promises.copyFile(req.file.path, destPath);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    res.json({ success: true, message: `檔案 ${req.file.originalname} 上傳成功`, path: destPath });
  } catch (err: any) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

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
      ownerUsername: i.owner_name,
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

// Admin Route: Send Intrusion Warning & Force Stop Container
app.post('/api/admin/instances/:id/warn', authenticate, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  const instanceId = req.params.id;
  const { warningMessage } = req.body;

  try {
    const inst = db.prepare(`
      SELECT i.*, u.username as owner_name, u.discord_id as owner_discord_id
      FROM instances i
      JOIN users u ON i.user_id = u.id
      WHERE i.id = ?
    `).get(instanceId) as any;

    if (!inst) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // Force stop container
    await DockerService.stopContainer(instanceId).catch(() => {});
    db.prepare('UPDATE instances SET status = ? WHERE id = ?').run('stopped', instanceId);

    const messageToSend = warningMessage || `【系統入侵安全警告】管理員偵測到您的容器 (${inst.name}) 存在異常風險或侵權行為，已強制關閉服務。請聯繫服主！`;

    recordAuditLog(
      req.user!.id,
      req.user!.username,
      'SECURITY_WARNING_SENT',
      `Sent intrusion warning to ${inst.owner_name} (${inst.owner_discord_id}) for instance ${inst.name} (${instanceId}): ${messageToSend}`,
      req.ip
    );

    res.json({
      success: true,
      message: `已成功向擁有者 @${inst.owner_name} 發送入侵警告並強制停止容器！`,
      ownerName: inst.owner_name,
      ownerDiscordId: inst.owner_discord_id,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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

const server = app.listen(PORT, async () => {
  console.log(`[Craft-Core Hosting Backend] Server running securely on port ${PORT}`);
  await syncContainerStatuses();
});

// Configure 15-minute HTTP timeouts to support large 2GB ZIP uploads over slow connections
server.headersTimeout = 15 * 60 * 1000;
server.requestTimeout = 15 * 60 * 1000;
server.setTimeout(15 * 60 * 1000);

// Subdomain WebSocket Upgrade Proxy
server.on('upgrade', (req, socket, head) => {
  const host = req.headers.host || '';
  const match = host.match(/^app-([a-z0-9]+)\.hosting\.craft-core\.xyz$/i);
  if (match) {
    const sub = match[1];
    const inst = db.prepare('SELECT assigned_host_port FROM instances WHERE (subdomain = ? OR assigned_host_port = ?) AND assigned_host_port IS NOT NULL').get(sub, parseInt(sub, 10)) as any;
    if (inst && inst.assigned_host_port) {
      return appProxy.ws(req, socket, head, { target: `http://127.0.0.1:${inst.assigned_host_port}` });
    }
  }
  socket.destroy();
});

// Automatic Circuit Breaker & Egress Abuse Monitor (Every 15s)
const containerSpikeTracker: Record<string, { cpuSpikeCount: number; lastTxBytes: number }> = {};

setInterval(async () => {
  try {
    const runningInstances = db.prepare("SELECT id, name, user_id, cpu_limit, memory_limit FROM instances WHERE status = 'running'").all() as any[];
    for (const inst of runningInstances) {
      const stats = await DockerService.getContainerStats(inst.id).catch(() => null);
      if (!stats) continue;

      if (!containerSpikeTracker[inst.id]) {
        containerSpikeTracker[inst.id] = { cpuSpikeCount: 0, lastTxBytes: stats.txBytes || 0 };
      }

      const tracker = containerSpikeTracker[inst.id];
      const cpuLimit = inst.cpu_limit || 100;
      const memLimitMB = inst.memory_limit || 512;

      // 1. CPU & Memory Spike Circuit Breaker (> 95% limit for 3 consecutive checks)
      if (stats.cpuPercent > cpuLimit * 0.95 || stats.memoryUsageMB > memLimitMB * 0.95) {
        tracker.cpuSpikeCount += 1;
        if (tracker.cpuSpikeCount >= 3) {
          console.warn(`[Circuit Breaker] Throttling container ${inst.name} (${inst.id}) due to continuous resource spike.`);
          recordAuditLog('system', 'Circuit Breaker', 'CIRCUIT_BREAKER_TRIGGERED', `Automatically throttled instance ${inst.name} (${inst.id}) due to 100% CPU/Memory spike`, '127.0.0.1');
          tracker.cpuSpikeCount = 0;
        }
      } else {
        tracker.cpuSpikeCount = Math.max(0, tracker.cpuSpikeCount - 1);
      }

      // 2. Network Egress Abuse Protection (> 200MB in 15s)
      const currentTx = stats.txBytes || 0;
      const egressDelta = currentTx - tracker.lastTxBytes;
      tracker.lastTxBytes = currentTx;

      if (egressDelta > 200 * 1024 * 1024) {
        console.warn(`[Egress Protection] Egress spike detected on container ${inst.name} (${inst.id}): ${(egressDelta / (1024 * 1024)).toFixed(1)} MB`);
        recordAuditLog('system', 'Network Protection', 'EGRESS_ABUSE_DETECTED', `Network egress spike detected on instance ${inst.name} (${inst.id}): ${(egressDelta / (1024 * 1024)).toFixed(1)} MB in 15s`, '127.0.0.1');
      }
    }
  } catch (err) {
    // silent catch
  }
}, 15000);
