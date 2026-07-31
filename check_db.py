import sqlite3
import json

conn = sqlite3.connect('/root/craft-core/hosting/backend/data/hosting.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print("=== INSTANCES ===")
instances = [dict(r) for r in cur.execute("SELECT * FROM instances")]
print(json.dumps(instances, indent=2, ensure_ascii=False))

print("\n=== USERS ===")
users = [dict(r) for r in cur.execute("SELECT id, discord_id, username, role, status, created_at FROM users")]
print(json.dumps(users, indent=2, ensure_ascii=False))

print("\n=== AUDIT LOGS ===")
logs = [dict(r) for r in cur.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20")]
print(json.dumps(logs, indent=2, ensure_ascii=False))
