import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BookOpen, Key, GitBranch, Bot, Copy, Check, Terminal } from 'lucide-react';

export const Wiki: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sampleToken = 'cch_pat_sample_key_94fd344e';

  const curlListInstances = `curl -X GET https://hosting.craft-core.xyz/api/instances \\\n  -H "Authorization: Bearer ${sampleToken}" \\\n  -H "Content-Type: application/json"`;
  const curlStartInstance = `curl -X POST https://hosting.craft-core.xyz/api/instances/inst-node-01/start \\\n  -H "Authorization: Bearer ${sampleToken}"`;
  const curlStopInstance = `curl -X POST https://hosting.craft-core.xyz/api/instances/inst-node-01/stop \\\n  -H "Authorization: Bearer ${sampleToken}"`;
  const curlGetLogs = `curl -X GET https://hosting.craft-core.xyz/api/instances/inst-node-01/logs \\\n  -H "Authorization: Bearer ${sampleToken}"`;

  const mcpConfigJson = JSON.stringify(
    {
      mcpServers: {
        "craft-core-hosting": {
          command: "node",
          args: ["mcp-server.js"],
          env: {
            HOSTING_API_URL: "https://hosting.craft-core.xyz/api",
            HOSTING_API_TOKEN: sampleToken
          }
        }
      }
    },
    null,
    2
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> Craft-Core Hosting Wiki 文檔
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          REST API 存取範例、GitHub Webhook 自動部署與 AI MCP 整合設定
        </p>
      </div>

      <Tabs defaultValue="api">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="api" className="gap-1.5 text-xs">
            <Key className="h-3.5 w-3.5" /> API 請求範例
          </TabsTrigger>
          <TabsTrigger value="github" className="gap-1.5 text-xs">
            <GitBranch className="h-3.5 w-3.5" /> GitHub Webhook
          </TabsTrigger>
          <TabsTrigger value="mcp" className="gap-1.5 text-xs">
            <Bot className="h-3.5 w-3.5" /> AI MCP 設定
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="pt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" /> HTTP REST API 請求標頭
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <p className="text-muted-foreground">在 Header 帶入您的 Personal Access Token (PAT) 即可呼叫 API：</p>
              <code className="font-mono bg-muted p-2.5 rounded text-foreground block border text-xs">
                Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN
              </code>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span>1. 查詢個人機器清單 (`GET /api/instances`)</span>
                    <Badge variant="outline" className="font-mono text-[10px]">GET</Badge>
                  </div>
                  <div className="relative bg-slate-950 text-slate-100 p-3 rounded font-mono text-[11px]">
                    <pre>{curlListInstances}</pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(curlListInstances, 'list')}
                      className="absolute top-2 right-2 h-7 text-[10px] text-slate-300 hover:text-white"
                    >
                      {copiedKey === 'list' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedKey === 'list' ? '已複製' : '複製 cURL'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span>2. 啟動機器 (`POST /api/instances/:id/start`)</span>
                    <Badge variant="success" className="font-mono text-[10px]">POST</Badge>
                  </div>
                  <div className="relative bg-slate-950 text-slate-100 p-3 rounded font-mono text-[11px]">
                    <pre>{curlStartInstance}</pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(curlStartInstance, 'start')}
                      className="absolute top-2 right-2 h-7 text-[10px] text-slate-300 hover:text-white"
                    >
                      {copiedKey === 'start' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedKey === 'start' ? '已複製' : '複製 cURL'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span>3. 停止機器 (`POST /api/instances/:id/stop`)</span>
                    <Badge variant="destructive" className="font-mono text-[10px]">POST</Badge>
                  </div>
                  <div className="relative bg-slate-950 text-slate-100 p-3 rounded font-mono text-[11px]">
                    <pre>{curlStopInstance}</pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(curlStopInstance, 'stop')}
                      className="absolute top-2 right-2 h-7 text-[10px] text-slate-300 hover:text-white"
                    >
                      {copiedKey === 'stop' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedKey === 'stop' ? '已複製' : '複製 cURL'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span>4. 讀取 Terminal 日誌 (`GET /api/instances/:id/logs`)</span>
                    <Badge variant="outline" className="font-mono text-[10px]">GET</Badge>
                  </div>
                  <div className="relative bg-slate-950 text-slate-100 p-3 rounded font-mono text-[11px]">
                    <pre>{curlGetLogs}</pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(curlGetLogs, 'logs')}
                      className="absolute top-2 right-2 h-7 text-[10px] text-slate-300 hover:text-white"
                    >
                      {copiedKey === 'logs' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedKey === 'logs' ? '已複製' : '複製 cURL'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="github" className="pt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" /> GitHub Webhook 自動部署設定
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>在 GitHub 儲存庫進入 <strong>Settings ➔ Webhooks ➔ Add webhook</strong>。</li>
                <li><strong>Payload URL</strong>: 輸入機器專屬 Webhook URL。</li>
                <li><strong>Content type</strong>: 選擇 <code className="font-mono bg-muted px-1 rounded text-foreground">application/json</code>。</li>
                <li><strong>Secret</strong>: 輸入機器的 Webhook Secret 密鑰。</li>
                <li>點擊 <strong>Add webhook</strong>，當 <code className="font-mono bg-muted px-1 rounded text-foreground">git push</code> 時將自動建置並重啟容器。</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mcp" className="pt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" /> AI MCP 伺服器設定
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <p className="text-muted-foreground">將下方 JSON 貼入 <code className="font-mono bg-muted px-1 rounded text-foreground">claude_desktop_config.json</code> 設定 AI 工具：</p>
              <div className="relative bg-slate-950 text-slate-100 p-3 rounded font-mono text-[11px]">
                <pre>{mcpConfigJson}</pre>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(mcpConfigJson, 'mcp')}
                  className="absolute top-2 right-2 h-7 text-[10px] text-slate-300 hover:text-white"
                >
                  {copiedKey === 'mcp' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedKey === 'mcp' ? '已複製' : '複製 JSON'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
