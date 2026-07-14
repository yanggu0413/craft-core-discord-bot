import Head from 'next/head';
import { useState } from 'react';
import { BookOpen, BarChart3, Copy, Check, ExternalLink, ShieldCheck, Mail, Sparkles, Server, MessageSquare, Play, HelpCircle } from 'lucide-react';

export default function Home() {
  const [copiedJava, setCopiedJava] = useState(false);
  const [copiedBedrock, setCopiedBedrock] = useState(false);
  const [copiedGeneral, setCopiedGeneral] = useState(false);

  const copyToClipboard = (text, setCopied) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleScrollToJoin = (e) => {
    e.preventDefault();
    const joinSection = document.getElementById('join');
    if (joinSection) {
      joinSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-800">
      <Head>
        <title>CRAFT-CORE | 官方入口網站</title>
        <meta name="description" content="歡迎加入 CRAFT-CORE 生存伺服器。支援 Java 26.2 (Fabric) 與基岩版最新版雙端連入。" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="font-black text-xl tracking-wider text-blue-600">CRAFT-CORE</span>
            <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded">原味生存</span>
          </div>

          <nav className="flex items-center space-x-8">
            <a href="https://docs.craft-core.xyz" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-zinc-600 hover:text-blue-600 transition-colors">
              官方維基
            </a>
            <a href="https://dash.craft-core.xyz" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-zinc-600 hover:text-blue-600 transition-colors">
              玩家面板
            </a>
            <a href="https://discord.gg/invite" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-zinc-600 hover:text-blue-600 transition-colors">
              Discord
            </a>
            <a 
              href="#join"
              onClick={handleScrollToJoin}
              className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-colors"
            >
              立即加入
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section with Custom Generated Background */}
      <section 
        className="relative w-full h-[540px] bg-cover bg-center flex flex-col items-center justify-center text-center px-4"
        style={{ backgroundImage: `url('/hero-bg.jpg')` }}
      >
        {/* Dark overlay mask for clean contrast */}
        <div className="absolute inset-0 bg-black/45 z-0"></div>

        <div className="relative z-10 max-w-3xl text-white">
          <div className="text-sm font-extrabold tracking-widest text-blue-400 uppercase mb-3">
            FABRIC 1.21+ / BE LATEST / 雙端互通
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-none mb-6 drop-shadow-md">
            CRAFT-CORE
          </h1>
          <p className="text-base md:text-lg font-medium opacity-90 mb-8 max-w-xl mx-auto leading-relaxed">
            體驗最純粹的生存冒險！搭載先進自動化設施、自定義商業經濟與郵局包裹。在這裡，與志同道合的夥伴建立繁榮的科技城鎮。
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => copyToClipboard('mc.craft-core.xyz', setCopiedGeneral)}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-extrabold shadow-lg transition-colors flex items-center justify-center space-x-2.5 cursor-pointer"
            >
              {copiedGeneral ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedGeneral ? '已複製 IP！' : '複製伺服器 IP'}</span>
            </button>
            <a
              href="https://discord.gg/invite"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 text-sm font-extrabold backdrop-blur-sm transition-colors flex items-center justify-center space-x-2.5"
            >
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span>加入 Discord 社群</span>
            </a>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-4xl w-full mx-auto px-4 py-20 flex flex-col items-center">
        
        {/* Features list (Taiwanese Server Style) */}
        <section className="w-full max-w-2xl space-y-16 text-center mb-24">
          
          <div className="space-y-4">
            <div className="flex justify-center text-blue-600">
              <Server className="w-8 h-8" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">原味生存 × 科技經濟</h2>
            <p className="text-sm md:text-base text-zinc-500 max-w-lg mx-auto leading-relaxed">
              享受最純粹的生存冒險，配合先進自動化紅石建設，與成熟的玩家自由交易市場！
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center text-blue-600">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">實用指令與快捷 GUI</h2>
            <p className="text-sm md:text-base text-zinc-500 max-w-lg mx-auto leading-relaxed">
              支援經典實用指令 <code className="bg-zinc-100 text-blue-600 px-1.5 py-0.5 rounded font-mono text-xs md:text-sm">/home</code>、<code className="bg-zinc-100 text-blue-600 px-1.5 py-0.5 rounded font-mono text-xs md:text-sm">/tpa</code>、<code className="bg-zinc-100 text-blue-600 px-1.5 py-0.5 rounded font-mono text-xs md:text-sm">/back</code>、<code className="bg-zinc-100 text-blue-600 px-1.5 py-0.5 rounded font-mono text-xs md:text-sm">/spawn</code> 等，一鍵便捷操作。
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center text-blue-600">
              <Mail className="w-8 h-8" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">離線雲端郵箱快遞</h2>
            <p className="text-sm md:text-base text-zinc-500 max-w-lg mx-auto leading-relaxed">
              支援遊戲內或網頁端跨界發信，隨時傳遞物資給在線或離線好友，上線即自動派發通知。
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center text-blue-600">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">財產領地防爆保護</h2>
            <p className="text-sm md:text-base text-zinc-500 max-w-lg mx-auto leading-relaxed">
              自訂防爆、防噴、防破壞領地，密碼鎖直接與個人帳號綁定，並支持網頁後端即時配置管理。
            </p>
          </div>

        </section>

        {/* Dynamic MOTD Banner Container */}
        <section className="w-full max-w-3xl border border-zinc-200 bg-zinc-50 rounded-xl overflow-hidden shadow-sm p-5 mb-24 text-center">
          <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider mb-4">伺服器即時狀態</h3>
          <div className="bg-black flex items-center justify-center p-3 rounded-lg border border-zinc-200 shadow-inner">
            <img 
              src="https://sr-api.sfirew.com/server/mc.craft-core.xyz/banner/motd.png?hl=tw&v=mpvEEcngwP" 
              alt="CRAFT-CORE Minecraft Server MOTD Status Banner" 
              className="w-full h-auto max-w-[1836px] object-contain rounded"
            />
          </div>
        </section>

        {/* Connection Guides (Java / Bedrock Specs) */}
        <section id="join" className="w-full max-w-3xl text-center mb-20 scroll-mt-24">
          <h2 className="text-3xl font-black tracking-tight mb-10">加入伺服器</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Java Card */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-8 text-left flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-blue-600 mb-3">
                  <span className="text-xs font-extrabold bg-blue-100 px-2.5 py-1 rounded">Java 版 (PC)</span>
                </div>
                <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
                  支援原版 Java 客戶端。採用先進的 Fabric 框架，效能出眾。<strong className="text-blue-600 font-bold block mt-2">注意：必須使用 26.2 版本連入，其餘版本皆無法加入！</strong>
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between px-4 py-3 bg-white border border-zinc-200 rounded-lg text-sm md:text-base font-mono text-zinc-700">
                  <span>mc.craft-core.xyz</span>
                  <button
                    onClick={() => copyToClipboard('mc.craft-core.xyz', setCopiedJava)}
                    className="p-1.5 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-700 transition-colors"
                  >
                    {copiedJava ? <Check className="w-4 h-4 text-blue-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span>支援版本: 26.2 (必須使用此版本)</span>
                  {copiedJava && <span className="text-blue-600 font-bold">IP 已複製！</span>}
                </div>
              </div>
            </div>

            {/* Bedrock Card */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-8 text-left flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-blue-600 mb-3">
                  <span className="text-xs font-extrabold bg-blue-100 px-2.5 py-1 rounded">基岩版 (BE)</span>
                </div>
                <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
                  支援手機、平板及 Win10 基岩版連入，請手動新增伺服器並指定端口進入。
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between px-4 py-3 bg-white border border-zinc-200 rounded-lg text-sm md:text-base font-mono text-zinc-700">
                  <span>mc.craft-core.xyz : 19132</span>
                  <button
                    onClick={() => copyToClipboard('mc.craft-core.xyz:19132', setCopiedBedrock)}
                    className="p-1.5 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-700 transition-colors"
                  >
                    {copiedBedrock ? <Check className="w-4 h-4 text-blue-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span>支援版本: 最新版本</span>
                  {copiedBedrock && <span className="text-blue-600 font-bold">IP 已複製！</span>}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Regulations button */}
        <section className="w-full max-w-3xl">
          <a
            href="https://docs.craft-core.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 bg-white border border-zinc-200 hover:border-blue-500 rounded-xl text-sm font-bold text-center text-zinc-600 hover:text-blue-600 transition-all shadow-sm flex items-center justify-center space-x-2"
          >
            <BookOpen className="w-4.5 h-4.5" />
            <span>點我查看伺服器規章與詳細玩法介紹</span>
          </a>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-200 bg-zinc-50 py-10 text-sm text-zinc-400">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} CRAFT-CORE 生存伺服器. 保留所有權利。</p>
          <div className="flex space-x-6">
            <a href="https://docs.craft-core.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600">伺服器規章</a>
            <a href="https://dash.craft-core.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600">聯絡我們</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
