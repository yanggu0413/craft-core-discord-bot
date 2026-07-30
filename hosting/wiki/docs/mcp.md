# AI MCP 伺服器整合指南 (Model Context Protocol)

Craft-Core Hosting 提供原生的 **Model Context Protocol (JSON-RPC 2.0)** 伺服器端點 (位於 `/api/mcp`)，允許 AI 助手進行機器管理、遠端設定環境變數、觸發 Git 構建與日誌查詢。

---

## 配置文件範例 (`mcpServers`)

將下方 JSON 貼入您的 `claude_desktop_config.json` 或 `mcp.json` 中：

```json
{
  "mcpServers": {
    "craft-core-hosting": {
      "command": "node",
      "args": ["/root/craft-core/hosting/backend/dist/mcp/server.js"],
      "env": {
        "HOSTING_API_URL": "https://hosting.craft-core.xyz/api",
        "HOSTING_API_TOKEN": "YOUR_PERSONAL_ACCESS_TOKEN_HERE"
      }
    }
  }
}
```

---

## 支援的 7 大 MCP Tools

| Tool 名稱 | 說明 | 輸入參數 |
| --- | --- | --- |
| `list_instances` | 查詢目前運行的所有容器清單與 CPU/RAM 資源限制 | 無 |
| `get_container_logs` | 讀取指定容器的最新 Terminal 輸出日誌 | `instanceId` |
| `deploy_instance` | 觸發 Git 最新代碼拉取、自動編譯與重新部署啟動 | `instanceId` |
| `set_env_vars` | 遠端設定/更新環境變數 (`KEY=VALUE`)，並自動重新配置容器生效 | `instanceId`, `envVars` |
| `start_container` | 遠端啟動指定的 Docker 容器服務 | `instanceId` |
| `stop_container` | 遠端停止指定的 Docker 容器服務 | `instanceId` |
| `restart_container` | 遠端重啟指定的 Docker 容器服務 | `instanceId` |
