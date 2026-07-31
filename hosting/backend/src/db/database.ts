import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const dbPath = path.join(DB_DIR, 'hosting.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('busy_timeout = 5000');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'USER',
      status TEXT NOT NULL DEFAULT 'PENDING',
      api_token TEXT UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      runtime TEXT NOT NULL,
      source_type TEXT NOT NULL,
      git_url TEXT,
      zip_file_name TEXT,
      start_command TEXT NOT NULL,
      internal_port INTEGER NOT NULL,
      assigned_host_port INTEGER,
      cpu_limit INTEGER NOT NULL,
      memory_limit INTEGER NOT NULL,
      disk_limit INTEGER NOT NULL DEFAULT 2048,
      env_vars TEXT,
      status TEXT NOT NULL DEFAULT 'stopped',
      webhook_secret TEXT,
      discord_webhook_url TEXT,
      health_check_endpoint TEXT,
      custom_domain TEXT,
      root_dir TEXT DEFAULT '/',
      build_command TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      commit_hash TEXT NOT NULL,
      commit_message TEXT NOT NULL,
      author TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SUCCESS',
      created_at TEXT NOT NULL,
      FOREIGN KEY (instance_id) REFERENCES instances (id)
    );

    CREATE TABLE IF NOT EXISTS port_requests (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      internal_port INTEGER NOT NULL,
      assigned_host_port INTEGER,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL,
      FOREIGN KEY (instance_id) REFERENCES instances (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
  `);

  try {
    db.exec("ALTER TABLE instances ADD COLUMN root_dir TEXT DEFAULT '/'");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE instances ADD COLUMN build_command TEXT");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE instances ADD COLUMN subdomain TEXT");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE instances ADD COLUMN logs_cleared_at TEXT");
  } catch (e) {}
}

export function recordAuditLog(userId: string, username: string, action: string, details?: string, ipAddress?: string) {
  const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, username, action, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(logId, userId, username, action, details || '', ipAddress || '127.0.0.1', new Date().toISOString());
  try {
    db.exec(`ALTER TABLE instances ADD COLUMN docker_image TEXT;`);
  } catch (e) {
    // column already exists
  }
}
