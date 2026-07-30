import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Check, Copy, ExternalLink, ShieldCheck, ArrowRight } from 'lucide-react';

export const GitHubGuide: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const sampleWebhook = 'https://hosting.craft-core.xyz/api/webhooks/github/YOUR_INSTANCE_ID';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-primary" /> GitHub 連接與自動部署教學 (GitHub Integration Guide)
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          只需 3 個步驟，輕鬆綁定 GitHub 儲存庫並實現 Push 自動建置與無縫重啟！
        </p>
      </div>

      {/* Step 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Badge variant="default">Step 1</Badge> 取得專案的 Webhook Payload URL & Secret
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <p className="text-muted-foreground">
            點擊您專案頁面中的 <strong>「設定 (Settings)」</strong> 頁籤，複製該機器的專屬 Webhook URL 與 Secret。
          </p>
          <div className="flex gap-2">
            <Input readOnly value={sampleWebhook} className="font-mono text-xs bg-muted" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(sampleWebhook);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="gap-1 text-xs shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已複製範例' : '複製 URL'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Badge variant="default">Step 2</Badge> 至 GitHub 儲存庫新增 Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>前往您的 GitHub 儲存庫頁面，點選頂部選單 <strong>Settings ➔ Webhooks</strong>。</li>
            <li>點擊右上角 <strong>Add webhook</strong> 按鈕。</li>
            <li>在 <strong>Payload URL</strong> 輸入步驟 1 複製的專屬網址。</li>
            <li><strong>Content type</strong> 務必選擇 <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">application/json</code>。</li>
            <li>在 <strong>Secret</strong> 欄位貼上機器的 Webhook Secret 密鑰。</li>
            <li>Which events: 保持預設 <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">Just the push event</code>。</li>
            <li>點擊綠色 <strong>Add webhook</strong> 完成綁定。</li>
          </ol>
        </CardContent>
      </Card>

      {/* Step 3 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Badge variant="default">Step 3</Badge> Push 程式碼並驗證極速部署
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p>
            當您在本地 <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">git push origin main</code> 後，GitHub 會自動向伺服器發送校驗請求。
            系統將自動執行 <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">git pull</code> ➔ <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">npm install / pip install</code> ➔ 重啟容器。
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
