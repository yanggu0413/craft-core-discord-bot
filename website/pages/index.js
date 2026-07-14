import Head from 'next/head';
import { useState, useEffect } from 'react';
import { BookOpen, BarChart3, Sun, Moon, Copy, Check, ExternalLink, ShieldCheck, Mail, Sparkles, Server } from 'lucide-react';

export default function Home() {
  const [copiedJava, setCopiedJava] = useState(false);
  const [copiedBedrock, setCopiedBedrock] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Initialize theme based on preference
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const copyToClipboard = (text, setCopied) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-height-screen flex flex-col font-sans bg-background text-foreground transition-colors duration-150">
      <Head>
        <title>CRAFT-CORE | 官方入口網站</title>
        <meta name="description" content="歡迎光臨 CRAFT-CORE 生存伺服器入口網站。連入遊戲、查詢百科與管理個人網頁面板。" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Nav Header */}
      <header className="sticky top-0 z-40 w-full border-b border-card-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Server className="w-4.5 h-4.5 text-primary" />
            </div>
            <span className="font-extrabold text-sm tracking-widest uppercase">CRAFT-CORE</span>
          </div>

          <div className="flex items-center space-x-4">
            <a href="https://docs.craft-core.xyz" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-muted hover:text-foreground transition-colors flex items-center space-x-1">
              <span>維基文檔</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://dash.craft-core.xyz" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-muted hover:text-foreground transition-colors flex items-center space-x-1">
              <span>玩家面板</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg border border-card-border hover:bg-card/50 transition-colors"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-accent" /> : <Moon className="w-4 h-4 text-primary" />}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-12 md:py-20 flex flex-col items-center">
        
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-card-border bg-card text-[11px] font-bold text-primary mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>全新簽到與抽獎功能網頁版已上線</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-center max-w-3xl leading-[1.1] mb-6">
          歡迎來到 <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">CRAFT-CORE</span> 生存伺服器
        </h1>

        <p className="text-sm md:text-base text-muted text-center max-w-2xl mb-10 leading-relaxed">
          一個專為硬派與休閒玩家設計的經濟體系生存伺服器。擁有實體箱子商店、郵局快遞系統、網頁簽到提醒與大抽獎，帶給您 1:1 的完美多端網頁交互體驗。
        </p>

        {/* Dynamic MOTD Banner Container */}
        <div className="w-full max-w-3xl border border-card-border bg-card rounded-xl overflow-hidden shadow-xl mb-12">
          <div className="px-4 py-3 bg-card/60 border-b border-card-border flex items-center justify-between text-xs">
            <span className="font-bold text-muted flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
              <span>伺服器實時狀態</span>
            </span>
            <span className="font-mono text-muted">mc.craft-core.xyz</span>
          </div>
          <div className="p-3 bg-black flex items-center justify-center">
            {/* Embedded dynamic 1836 x 222 MOTD banner image */}
            <img 
              src="https://sr-api.sfirew.com/server/mc.craft-core.xyz/banner/motd.png?hl=tw&v=mpvEEcngwP" 
              alt="CRAFT-CORE Minecraft Server MOTD Status Banner" 
              className="w-full h-auto max-w-[1836px] object-contain rounded border border-zinc-800"
            />
          </div>
        </div>

        {/* Join Server Connection Guides */}
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
          
          {/* Java Card */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm hover:border-primary/30 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-primary mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10">JAVA EDITION</span>
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">電腦版（爪哇版）連入</h3>
              <p className="text-xs text-muted mb-4">支援常規電腦客戶端，使用主域名直連進入遊戲。</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-background border border-card-border rounded-lg text-xs font-mono">
                <span className="text-foreground select-all">mc.craft-core.xyz</span>
                <button
                  onClick={() => copyToClipboard('mc.craft-core.xyz', setCopiedJava)}
                  className="p-1 rounded hover:bg-card text-muted hover:text-foreground transition-colors"
                  title="複製網址"
                >
                  {copiedJava ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {copiedJava && <p className="text-[10px] text-primary font-bold">✓ 複製 Java 版 IP 成功！</p>}
            </div>
          </div>

          {/* Bedrock Card */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm hover:border-secondary/30 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-secondary mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-secondary/10">BEDROCK EDITION</span>
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">手機與基岩版連入</h3>
              <p className="text-xs text-muted mb-4">支援手機、平板及主機基岩版，請手動指定通訊埠。</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-background border border-card-border rounded-lg text-xs font-mono">
                <span className="text-foreground select-all">mc.craft-core.xyz (Port: 19132)</span>
                <button
                  onClick={() => copyToClipboard('mc.craft-core.xyz:19132', setCopiedBedrock)}
                  className="p-1 rounded hover:bg-card text-muted hover:text-foreground transition-colors"
                  title="複製網址與端口"
                >
                  {copiedBedrock ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {copiedBedrock && <p className="text-[10px] text-primary font-bold">✓ 複製基岩版 IP 與端口成功！</p>}
            </div>
          </div>

        </div>

        {/* Server Highlights */}
        <div className="w-full max-w-4xl mb-16">
          <h2 className="text-xl font-extrabold text-center mb-8 tracking-tight">CRAFT-CORE 核心特色系統</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="bg-card border border-card-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-extrabold mb-1">每日簽到與鑰匙抽獎</h4>
              <p className="text-xs text-muted leading-relaxed">
                在 Discord 或網頁端一鍵簽到，累積連續簽到獲取額外鑰匙。線上點擊大抽獎，遊戲內立即彈出 Title 並且派發裝備！
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-card border border-card-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center border border-secondary/20 text-secondary mb-4">
                <Mail className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-extrabold mb-1">離線郵局快遞系統</h4>
              <p className="text-xs text-muted leading-relaxed">
                即使朋友離線也能透過網頁端或指令為他寄送物品！伺服器收到信件後會寄存在雲端郵局，玩家上線時會獲得快遞通知。
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-card border border-card-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-600 dark:text-amber-400 mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-extrabold mb-1">領地保護與安全鎖</h4>
              <p className="text-xs text-muted leading-relaxed">
                強大的領地系統與密碼安全鎖功能。您可以直接在網頁儀表板上更改密碼鎖、查詢領地剩餘時效，保障個人資產安全。
              </p>
            </div>

          </div>
        </div>

        {/* Portal Shortcuts */}
        <div className="w-full max-w-3xl bg-card border border-card-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-base font-black">準備好開始您的冒險了嗎？</h3>
            <p className="text-xs text-muted">查閱完整維基百科或登入您的個人玩家面板進行管理。</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <a 
              href="https://docs.craft-core.xyz" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-5 py-2.5 rounded-lg bg-card border border-card-border text-xs font-bold text-center hover:bg-background transition-colors flex items-center justify-center space-x-1.5"
            >
              <BookOpen className="w-4 h-4" />
              <span>官方維基百科</span>
            </a>
            <a 
              href="https://dash.craft-core.xyz" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold text-center hover:opacity-90 transition-opacity flex items-center justify-center space-x-1.5"
            >
              <BarChart3 className="w-4 h-4" />
              <span>玩家管理面板</span>
            </a>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-card-border bg-card/40 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between text-xs text-muted gap-4">
          <p>&copy; {new Date().getFullYear()} CRAFT-CORE 生存伺服器. 保留所有權利。</p>
          <div className="flex space-x-6">
            <a href="https://docs.craft-core.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">使用條款</a>
            <a href="https://dash.craft-core.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">網頁後台</a>
            <span className="text-[10px] text-primary/70 font-semibold px-2 py-0.5 rounded bg-primary/5 border border-primary/10">Java 1.21+ / 基岩版</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
