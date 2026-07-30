import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Server, Lock, Cpu, Globe } from 'lucide-react';

interface LoginProps {
  onDiscordLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onDiscordLogin }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl border overflow-hidden">
        <div className="bg-gradient-to-br from-primary/5 to-background p-8 text-center border-b">
          <div className="h-14 w-14 mx-auto rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow mb-3">
            <Server className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-extrabold text-foreground">Craft-Core Hosting</h1>
          <p className="text-xs text-muted-foreground mt-1">雲端容器託管平台</p>
        </div>

        <CardContent className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border">
              <Cpu className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold">專屬資源配額</h4>
                <p className="text-[11px] text-muted-foreground">每位用戶最高 100% CPU 與 1GB RAM，最多 2 台容器。</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border">
              <Globe className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold">獨立專案管理與 Commit 還原</h4>
                <p className="text-[11px] text-muted-foreground">獨立總覽/日誌/檔案/部署歷史頁面，一鍵還原過往 Git Commit。</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t space-y-3">
            <Button
              onClick={onDiscordLogin}
              className="w-full py-5 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs gap-2"
            >
              使用 Discord 帳號登入 (Login with Discord)
            </Button>
            <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" /> 新註冊用戶須經由 Admin 人工審核核准後方可存取
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
