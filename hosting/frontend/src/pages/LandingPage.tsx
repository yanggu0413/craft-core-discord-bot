import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Server, Zap, Code2, Globe, Cpu, HardDrive, Terminal, ArrowRight, BookOpen, ExternalLink } from 'lucide-react';

interface LandingPageProps {
  onDiscordLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onDiscordLogin }) => {
  return (
    <div className="w-full bg-background text-foreground flex flex-col justify-between selection:bg-primary selection:text-primary-foreground">
      {/* Top Header Navbar */}
      <header className="border-b bg-card/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-sm">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold text-sm leading-none tracking-tight">Craft-Core</div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Hosting Platform</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://wiki.hosting.craft-core.xyz"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <span>開發者文檔</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>

            <Button onClick={onDiscordLogin} className="gap-2 h-9 text-xs font-semibold shadow-sm">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              登入管理控制台
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-6 max-w-6xl mx-auto w-full text-center space-y-6">
        <div className="space-y-4 max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            次世代專屬容器託管平台 <br />
            <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
              打造極速運行的雲端應用
            </span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            免費提供每位玩家 2 台獨立專案容器機器、100% CPU 算力、1GB 記憶體與 4GB 高速硬碟空間。
            支援 HTTPS 自動安全加密連線、線上 Monaco Code Editor 檔案管理與即時 WebSocket 日誌監控。
          </p>
        </div>

        <div className="flex justify-center pt-2">
          <Button size="lg" onClick={onDiscordLogin} className="gap-2.5 h-12 px-8 text-sm font-bold shadow-md">
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            使用 Discord 帳號登入 / 免費開始使用
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Official Platform Preview Image */}
        <div className="pt-6 max-w-5xl mx-auto">
          <div className="rounded-xl overflow-hidden border shadow-2xl bg-card p-1.5 ring-1 ring-border">
            <img
              src="/craft-core-hosting.png"
              alt="Craft-Core Hosting Platform Showcase Preview"
              className="rounded-lg w-full h-auto object-cover"
            />
          </div>
        </div>
      </section>

      {/* Resource Highlights Grid */}
      <section className="py-8 px-6 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 border shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Server className="h-4 w-4" /> 2 台專屬機器
            </div>
            <p className="text-xs text-muted-foreground">每位玩家皆可自由建立最多 2 台獨立專案容器。</p>
          </Card>

          <Card className="p-5 border shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
              <Cpu className="h-4 w-4" /> 100% CPU 算力
            </div>
            <p className="text-xs text-muted-foreground">彈性分配算力配額，滿足各式後端運算需求。</p>
          </Card>

          <Card className="p-5 border shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-blue-500 font-bold text-sm">
              <HardDrive className="h-4 w-4" /> 1GB RAM & 4GB SSD
            </div>
            <p className="text-xs text-muted-foreground">配備大容量 SSD 儲存空間與獨立記憶體限制。</p>
          </Card>

          <Card className="p-5 border shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
              <Globe className="h-4 w-4" /> HTTPS 自動安全域名
            </div>
            <p className="text-xs text-muted-foreground">自動核發對外域名與 HTTPS 自動加密連線。</p>
          </Card>
        </div>
      </section>

      {/* Platform Features Section */}
      <section className="py-12 px-6 max-w-6xl mx-auto w-full border-t space-y-10 mb-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">打造最卓越的容器託管體驗</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">整合多項先進工具，讓部署與維運變得前所未有的簡單</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 border shadow-sm space-y-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 w-fit">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold">極速一鍵部署</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              支援 Git 儲存庫熱拉取或 ZIP 壓縮包檔案上傳，系統自動建立容器並執行開機專案。
            </p>
          </Card>

          <Card className="p-6 border shadow-sm space-y-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 w-fit">
              <Code2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold">線上 Monaco 代碼編輯器</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              瀏覽器內建專業 Monaco Editor，隨時線上檢視、編輯並保存容器專案原始碼，無須遠端連線。
            </p>
          </Card>

          <Card className="p-6 border shadow-sm space-y-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500 w-fit">
              <Terminal className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold">即時 WebSocket 日誌監控</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              即時串流容器 Console 控制台輸出，隨時掌握應用程式最新運行動態與報錯紀錄。
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
};
