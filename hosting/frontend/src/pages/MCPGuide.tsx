import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Bot, Check, Copy, Terminal, Cpu } from 'lucide-react';

export const MCPGuide: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const mcpConfigJson = JSON.stringify(
    {
      mcpServers: {
        "craft-core-hosting": {
          command: "node",
          args: ["/root/craft-core/hosting/backend/dist/mcp/server.js"],
          env: {
            HOSTING_API_URL: "https://hosting.craft-core.xyz/api",
            HOSTING_API_TOKEN: "YOUR_PERSONAL_ACCESS_TOKEN_HERE"
          }
        }
      }
    },
    null,
    2
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(mcpConfigJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" /> AI MCP 伺服器整合指南 (AI Model Context Protocol)
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          將您的 AI 助手 (Antigravity / Claude Desktop / Cursor) 與 Craft-Core Hosting 直連，實現自然語言機器管理與日誌查詢！
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">MCP 配置文件範例 (mcpServers Config)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            將下方 JSON 設定貼入您的 <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">claude_desktop_config.json</code> 或 <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">mcp.json</code> 中：
          </p>

          <div className="relative">
            <Textarea
              readOnly
              value={mcpConfigJson}
              className="font-mono text-xs h-48 bg-muted/40 text-foreground resize-none"
            />
            <Button
              size="sm"
              onClick={handleCopy}
              className="absolute top-3 right-3 gap-1 text-xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已複製' : '複製 JSON'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">支援的 AI 工具 (Supported MCP Tools)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="font-mono font-bold text-primary mb-1">list_instances</div>
              <div className="text-muted-foreground">查詢目前運行的所有託管機器清單與 CPU/RAM 使用配額</div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="font-mono font-bold text-primary mb-1">get_container_logs</div>
              <div className="text-muted-foreground">讀取指定機器的最新 Terminal 容器日誌</div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="font-mono font-bold text-primary mb-1">deploy_instance</div>
              <div className="text-muted-foreground">觸發 Git 最新代碼拉取、重新編譯與重新部署啟動</div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="font-mono font-bold text-primary mb-1">set_env_vars</div>
              <div className="text-muted-foreground">遠端設定/更新環境變數 (KEY=VALUE)，並自動重新配置容器生效</div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="font-mono font-bold text-primary mb-1">start_container</div>
              <div className="text-muted-foreground">遠端啟動指定的 Docker 容器服務</div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="font-mono font-bold text-primary mb-1">stop_container</div>
              <div className="text-muted-foreground">遠端停止指定的 Docker 容器服務</div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="font-mono font-bold text-primary mb-1">restart_container</div>
              <div className="text-muted-foreground">遠端重啟指定的 Docker 容器服務</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
