# REST API 參考手冊 (REST API Reference)

Craft-Core Hosting 提供 RESTful API，允許開發者從 Bash 腳本、CI/CD 流程或外部工具呼叫 API 操控機器。

---

## 認證標頭 (Authentication Header)

在所有 API 請求的 Header 帶入您的 Personal Access Token (PAT) 或 JWT Token：

```http
Authorization: Bearer cch_pat_your_token_here
Content-Type: application/json
```

---

## API Endpoints 總覽

### 1. 查詢所有機器清單
- **Endpoint**: `GET /api/instances`
- **回應範例 (`200 OK`)**:
```json
[
  {
    "id": "inst-ms6xyq3h",
    "name": "discord-bot-service",
    "runtime": "nodejs",
    "sourceType": "git",
    "gitUrl": "https://github.com/craft-core/discord-bot",
    "startCommand": "node index.js",
    "internalPort": 3000,
    "assignedHostPort": 34512,
    "subdomain": "a8k2m9x1",
    "cpuLimit": 50,
    "memoryLimit": 512,
    "status": "running",
    "createdAt": "2026-07-30T07:00:00.000Z"
  }
]
```

---

### 2. 建立新託管機器
- **Endpoint**: `POST /api/instances`
- **請求體 (FormData / JSON Payload)**:
```json
{
  "name": "my-python-app",
  "runtime": "nodejs",
  "sourceType": "git",
  "gitUrl": "https://github.com/user/my-python-app",
  "startCommand": "node index.js",
  "internalPort": 3000,
  "cpuLimit": 50,
  "memoryLimit": 512
}
```

---

### 3. 啟動機器容器
- **Endpoint**: `POST /api/instances/:id/start`

### 4. 停止機器容器
- **Endpoint**: `POST /api/instances/:id/stop`

### 5. 重啟機器容器
- **Endpoint**: `POST /api/instances/:id/restart`

---

### 6. 擷取實時 Terminal 容器日誌
- **Endpoint**: `GET /api/instances/:id/logs`

### 7. 物理清空容器日誌
- **Endpoint**: `DELETE /api/instances/:id/logs`
- **說明**: 截斷實體 Docker 日誌檔案並上記清空時間戳記，確保舊 Log 不再重複出現。

---

### 8. 自動開啟對外 Port 與 8 位子域名
- **Endpoint**: `POST /api/instances/:id/port`

### 9. 重新核發對外 Port 與全新 8 位子域名
- **Endpoint**: `POST /api/instances/:id/port/reissue`

### 10. 刪除與釋放對外 Port
- **Endpoint**: `DELETE /api/instances/:id/port`

---

### 11. 銷毀機器容器
- **Endpoint**: `DELETE /api/instances/:id`
- **說明**: 物理刪除 Docker 容器、銷毀磁碟檔案並即時秒級歸還用戶配額。
