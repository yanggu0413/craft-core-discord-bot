import Head from 'next/head';
import { useState, useEffect } from 'react';
import { BookOpen, Copy, Check, ShieldCheck, Mail, Sparkles, Server, MessageSquare, ClipboardList, Menu, X, Cpu, Compass, Banknote, Trophy, Gift, Globe } from 'lucide-react';

const translations = {
  'zh-TW': {
    title: 'Craft-Core 原味生存｜Minecraft 伺服器｜高效能主機穩定營運',
    metaDesc: '歡迎加入 Craft-Core Minecraft 原味生存伺服器！支援 Java 版 (1.20 至 26.2) 與基岩版雙端連入。內含箱子商店市場、實體銀行支票、野外定向尋寶、福利中心轉盤抽獎、領地極致防爆與全服排行榜！',
    navWiki: '官方維基',
    navDiscord: 'Discord',
    navJoin: '立即加入',
    badgeSurvival: '原味生存',
    heroSubtitle: 'JAVA 1.20 - 26.2 / 基岩最新 / 雙端互通',
    heroTitle: 'CRAFT-CORE',
    heroDesc: '最純粹的原味生存冒險 ‧ 豐富的視覺化選單與社群互動',
    copyIpBtn: '複製伺服器 IP',
    copiedIpBtn: '已複製 IP！',
    joinDiscordBtn: '加入 Discord 社群',
    featuresTitle: '伺服器特色與全新玩法',
    featuresSubtitle: '經典原味生存結合先進箱子 GUI，帶給您最順暢的冒險體驗',
    feature1Title: '箱子商店與實體銀行支票',
    feature1Desc: '全服箱子市場一鍵遠端瀏覽，搭配實體紙張支票系統，隨時開立具備防偽標籤的支票進行交易與兌現。',
    feature2Title: '野外定向尋寶雷達',
    feature2Desc: '每隔 2 小時地表自動刷新藏寶箱！配合 100x100 廣域提示、天空聲納脈衝與羅盤雷達，感受 10~25 分鐘的刺激尋寶趣。',
    feature3Title: '福利中心與動態轉盤抽獎',
    feature3Desc: '每日簽到、遊玩時數自動換鑰匙！開啟 9x3 動態滾動轉盤，抽取豐富金幣、稀有道具與炫彩稱號。',
    feature4Title: '全服排行榜與每週目標',
    feature4Desc: '即時查看財富、鑰匙與簽到排行榜！每週全服共同挑戰，全員解鎖豪華紅包與限定獨家稱號。',
    feature5Title: '領地極致防爆與保險箱',
    feature5Desc: '完美的領地爆炸與流體完全隔離防護，搭配 4 位數密碼鎖保險箱，保障玩家財產絕對安全無虞。',
    feature6Title: '虛擬快遞與假人助手',
    feature6Desc: '支援線上與離線物品快遞寄送 (/express)，以及可自訂掛機動作與看管背包的實用假人助手。',
    statusTitle: '伺服器狀態：',
    statusConnecting: '正在連線中...',
    statusOnline: '正常',
    statusOffline: '關閉',
    onlinePlayers: '線上玩家：',
    playersUnit: '人',
    offlineNotice: '伺服器目前處於關閉維護或重啟狀態，請關注 Discord 頻道公告資訊。',
    playerListTitle: '目前線上玩家名單',
    noPlayersOnline: '目前無人在線，快成為第一個連入的冒險家！',
    joinSectionTitle: '加入伺服器',
    javaBadge: 'Java 版',
    javaDesc: '支援原版 Java 客戶端。採用 Fabric 框架架設，效能出眾。',
    javaNotice: '注意：支援 1.20 至 26.2 版本連入！',
    javaVersion: '支援版本: 1.20 至 26.2',
    bedrockBadge: '基岩版',
    bedrockDesc: '支援手機、平板及 Win10 基岩版連入，請手動新增伺服器並指定端口進入。',
    bedrockVersion: '支援版本: 最新版本',
    copiedNotice: 'IP 已複製！',
    rulesBtn: '點我查看伺服器規章與詳細玩家手冊',
    footerRights: 'Craft-Core 原味生存伺服器. 保留所有權利。',
    footerRules: '伺服器規章',
    footerContact: '聯絡我們'
  },
  'zh-CN': {
    title: 'Craft-Core 原味生存｜Minecraft 服务器｜高效能主机稳定营运',
    metaDesc: '欢迎加入 Craft-Core Minecraft 原味生存服务器！支持 Java 版 (1.20 至 26.2) 与基岩版双端连入。内含箱子商店市场、实体银行支票、野外定向寻宝、福利中心转盘抽奖、领地极致防爆与全服排行榜！',
    navWiki: '官方维基',
    navDiscord: 'Discord',
    navJoin: '立即加入',
    badgeSurvival: '原味生存',
    heroSubtitle: 'JAVA 1.20 - 26.2 / 基岩最新 / 双端互通',
    heroTitle: 'CRAFT-CORE',
    heroDesc: '最纯粹的原味生存冒险 ‧ 丰富的视觉化菜单与社群互动',
    copyIpBtn: '复制服务器 IP',
    copiedIpBtn: '已复制 IP！',
    joinDiscordBtn: '加入 Discord 社群',
    featuresTitle: '服务器特色与全新玩法',
    featuresSubtitle: '经典原味生存结合先进箱子 GUI，带给您最顺畅的冒险体验',
    feature1Title: '箱子商店与实体银行支票',
    feature1Desc: '全服箱子市场一键远程浏览，搭配实体纸张支票系统，随时开立具备防伪标签的支票进行交易与兑现。',
    feature2Title: '野外定向寻宝雷达',
    feature2Desc: '每隔 2 小时地表自动刷新藏宝箱！配合 100x100 广域提示、天空声纳脉冲与罗盘雷达，感受 10~25 分钟的刺激寻宝趣。',
    feature3Title: '福利中心与动态转盘抽奖',
    feature3Desc: '每日签到、游玩时数自动换钥匙！开启 9x3 动态滚动转盘，抽取丰富金币、稀有道具与炫彩称号。',
    feature4Title: '全服排行榜与每周目标',
    feature4Desc: '即时查看财富、钥匙与签到排行榜！每周全服共同挑战，全员解锁豪华红包与限定独家称号。',
    feature5Title: '领地极致防爆与保险箱',
    feature5Desc: '完美的领地爆炸与流体完全隔离防护，搭配 4 位数密码锁保险箱，保障玩家财产绝对安全无虞。',
    feature6Title: '虚拟快递与假人助手',
    feature6Desc: '支持线上与离线物品快递寄送 (/express)，以及可自订挂机动作与看管背包的实用假人助手。',
    statusTitle: '服务器状态：',
    statusConnecting: '正在连线中...',
    statusOnline: '正常',
    statusOffline: '关闭',
    onlinePlayers: '线上玩家：',
    playersUnit: '人',
    offlineNotice: '服务器目前处于关闭维护或重启状态，请关注 Discord 频道公告资讯。',
    playerListTitle: '目前线上玩家名单',
    noPlayersOnline: '目前无人在线，快成为第一个连入的冒险家！',
    joinSectionTitle: '加入服务器',
    javaBadge: 'Java 版',
    javaDesc: '支持原版 Java 客户端。采用 Fabric 框架架设，效能出众。',
    javaNotice: '注意：支持 1.20 至 26.2 版本连入！',
    javaVersion: '支持版本: 1.20 至 26.2',
    bedrockBadge: '基岩版',
    bedrockDesc: '支持手机、平板及 Win10 基岩版连入，请手动新增服务器并指定端口进入。',
    bedrockVersion: '支持版本: 最新版本',
    copiedNotice: 'IP 已复制！',
    rulesBtn: '点我查看服务器规章与详细玩家手册',
    footerRights: 'Craft-Core 原味生存服务器. 保留所有权利。',
    footerRules: '服务器规章',
    footerContact: '联系我们'
  },
  'en': {
    title: 'Craft-Core Vanilla Survival｜Minecraft Server｜High Performance & Stable',
    metaDesc: 'Welcome to Craft-Core Minecraft Vanilla Survival Server! Supports Java Edition (1.20 to 26.2) and Bedrock Edition cross-play. Featuring chest market, physical bank cheques, treasure hunting sonar, lucky draw, claim protection, and leaderboards!',
    navWiki: 'Wiki',
    navDiscord: 'Discord',
    navJoin: 'Join Now',
    badgeSurvival: 'Vanilla Survival',
    heroSubtitle: 'JAVA 1.20 - 26.2 / BEDROCK LATEST / CROSS-PLAY',
    heroTitle: 'CRAFT-CORE',
    heroDesc: 'Pure Vanilla Survival Adventure ‧ Rich Visual GUIs & Community Features',
    copyIpBtn: 'Copy Server IP',
    copiedIpBtn: 'IP Copied!',
    joinDiscordBtn: 'Join Discord',
    featuresTitle: 'Server Features & Gameplay',
    featuresSubtitle: 'Classic survival adventure combined with advanced GUI menus',
    feature1Title: 'Chest Market & Bank Cheques',
    feature1Desc: 'Browse server-wide chest shops remotely and issue anti-counterfeiting paper cheques for secure player trading.',
    feature2Title: 'Treasure Hunting Sonar Radar',
    feature2Desc: 'Chests refresh every 2 hours! Locate hidden loot in 10-25 mins with 100x100 sonar pulses & compass radar.',
    feature3Title: 'Welfare Draw & Wheel Spinner',
    feature3Desc: 'Exchange playtime for lucky keys! Spin the 9x3 wheel GUI to win money, rare items, and custom titles.',
    feature4Title: 'Global Leaderboards & Goals',
    feature4Desc: 'View Top 10 rankings for wealth, keys, and daily streaks. Complete weekly server goals for team rewards.',
    feature5Title: 'Ultimate Protection & Lockboxes',
    feature5Desc: 'Complete explosion and fluid isolation protection for land claims, plus 4-digit passcode lockboxes.',
    feature6Title: 'Virtual Express & Bot Assistants',
    feature6Desc: 'Send items to online/offline players (/express), and manage custom AFK dummy bots easily.',
    statusTitle: 'Server Status: ',
    statusConnecting: 'Connecting...',
    statusOnline: 'Online',
    statusOffline: 'Offline',
    onlinePlayers: 'Online Players: ',
    playersUnit: 'players',
    offlineNotice: 'The server is currently offline for maintenance. Please check our Discord channel for updates.',
    playerListTitle: 'Online Player List',
    noPlayersOnline: 'No players online currently. Be the first adventurer to join!',
    joinSectionTitle: 'How to Join',
    javaBadge: 'Java Edition',
    javaDesc: 'Supports vanilla Java clients. Built on Fabric framework with high performance.',
    javaNotice: 'Note: Supports client versions 1.20 to 26.2!',
    javaVersion: 'Supported: 1.20 - 26.2',
    bedrockBadge: 'Bedrock Edition',
    bedrockDesc: 'Supports Mobile, Tablet, and Win10 Bedrock clients. Add server with default port.',
    bedrockVersion: 'Supported: Latest Version',
    copiedNotice: 'IP Copied!',
    rulesBtn: 'Click to view server rules and player handbook',
    footerRights: 'Craft-Core Vanilla Survival Server. All rights reserved.',
    footerRules: 'Server Rules',
    footerContact: 'Contact Us'
  }
};

export default function Home() {
  const [copiedJava, setCopiedJava] = useState(false);
  const [copiedBedrock, setCopiedBedrock] = useState(false);
  const [copiedGeneral, setCopiedGeneral] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lang, setLang] = useState('zh-TW');

  useEffect(() => {
    // Detect browser language automatically on client mount
    if (typeof window !== 'undefined' && window.navigator) {
      const userLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (userLang.startsWith('zh')) {
        if (userLang.includes('cn') || userLang.includes('hans') || userLang.includes('sg')) {
          setLang('zh-CN');
        } else {
          setLang('zh-TW');
        }
      } else if (userLang.startsWith('en')) {
        setLang('en');
      } else {
        setLang('zh-TW');
      }
    }
  }, []);

  const t = translations[lang] || translations['zh-TW'];

  const [serverStatus, setServerStatus] = useState({
    loading: true,
    online: false,
    current_players: 0,
    max_players: 0,
    players: []
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('https://getmcsrvstatus.craft-core.xyz');
        if (res.ok) {
          const data = await res.json();
          setServerStatus({
            loading: false,
            online: !!data.online,
            current_players: data.current_players || 0,
            max_players: data.max_players || 50,
            players: data.players || []
          });
        } else {
          setServerStatus({ loading: false, online: false, current_players: 0, max_players: 0, players: [] });
        }
      } catch (e) {
        setServerStatus({ loading: false, online: false, current_players: 0, max_players: 0, players: [] });
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

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
        <title>{t.title}</title>
        <meta name="description" content={t.metaDesc} />
        <meta name="keywords" content="Minecraft 伺服器, Minecraft 生存伺服器, 麥塊伺服器, 原味生存伺服器, 雙端互通伺服器, Java 基岩互通, Craft-Core, 麥塊生存, i7-13700" />
        <link rel="icon" href="/favicon.png" />
        <link rel="preload" href="/favicon.png" as="image" />
      </Head>

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <img src="/favicon.png" alt="CRAFT-CORE Logo" className="w-8 h-8 object-contain" />
            <span className="font-black text-xl tracking-wider text-blue-600">CRAFT-CORE</span>
            <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded">{t.badgeSurvival}</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <a href="https://docs.craft-core.xyz" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-zinc-600 hover:text-blue-600 transition-colors">
              {t.navWiki}
            </a>
            <a href="https://discord.gg/XJZZwG7jR4" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-zinc-600 hover:text-blue-600 transition-colors">
              {t.navDiscord}
            </a>
            
            {/* Language Switcher Dropdown */}
            <div className="relative flex items-center space-x-1.5 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-600 bg-zinc-50 hover:border-zinc-300 transition-colors">
              <Globe className="w-3.5 h-3.5 text-zinc-500" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-zinc-700 focus:outline-none cursor-pointer pr-1"
                aria-label="Language Switcher"
              >
                <option value="zh-TW">繁體中文</option>
                <option value="zh-CN">简体中文</option>
                <option value="en">English</option>
              </select>
            </div>

            <a 
              href="#join"
              onClick={handleScrollToJoin}
              className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-colors"
            >
              {t.navJoin}
            </a>
          </nav>

          {/* Mobile Menu & Language Selector */}
          <div className="flex md:hidden items-center space-x-3">
            <div className="relative flex items-center space-x-1 border border-zinc-200 rounded-lg px-2 py-1 text-xs font-bold text-zinc-600 bg-zinc-50">
              <Globe className="w-3.5 h-3.5 text-zinc-500" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-zinc-700 focus:outline-none cursor-pointer"
                aria-label="Mobile Language Switcher"
              >
                <option value="zh-TW">繁中</option>
                <option value="zh-CN">简中</option>
                <option value="en">EN</option>
              </select>
            </div>

            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-zinc-600 hover:text-blue-600 hover:bg-zinc-100 rounded-lg transition-colors"
              aria-label="切換導覽選單"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden border-b border-zinc-200 bg-white px-4 py-4 space-y-4 flex flex-col shadow-inner">
            <a 
              href="https://docs.craft-core.xyz" 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={() => setIsMenuOpen(false)}
              className="text-sm font-bold text-zinc-600 hover:text-blue-600 transition-colors py-2 border-b border-zinc-100"
            >
              {t.navWiki}
            </a>
            <a 
              href="https://discord.gg/XJZZwG7jR4" 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={() => setIsMenuOpen(false)}
              className="text-sm font-bold text-zinc-600 hover:text-blue-600 transition-colors py-2 border-b border-zinc-100"
            >
              {t.navDiscord}
            </a>
            <a 
              href="#join"
              onClick={(e) => {
                setIsMenuOpen(false);
                handleScrollToJoin(e);
              }}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-colors"
            >
              {t.navJoin}
            </a>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section 
        className="relative w-full h-[520px] bg-cover bg-center flex flex-col items-center justify-center text-center px-4"
        style={{ backgroundImage: `url('/hero-bg.jpg')` }}
      >
        <div className="absolute inset-0 bg-black/50 z-0"></div>

        <div className="relative z-10 max-w-3xl text-white">
          <div className="text-sm font-extrabold tracking-widest text-blue-400 uppercase mb-3">
            {t.heroSubtitle}
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-none mb-6 drop-shadow-md">
            {t.heroTitle}
          </h1>
          <p className="text-base md:text-lg font-medium opacity-90 mb-8 max-w-xl mx-auto leading-relaxed">
            {t.heroDesc}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => copyToClipboard('mc.craft-core.xyz', setCopiedGeneral)}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-extrabold shadow-lg transition-colors flex items-center justify-center space-x-2.5 cursor-pointer"
            >
              {copiedGeneral ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedGeneral ? t.copiedIpBtn : t.copyIpBtn}</span>
            </button>
            <a
              href="https://discord.gg/XJZZwG7jR4"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 text-sm font-extrabold backdrop-blur-sm transition-colors flex items-center justify-center space-x-2.5"
            >
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span>{t.joinDiscordBtn}</span>
            </a>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-4xl w-full mx-auto px-4 py-16 flex flex-col items-center">
        
        {/* Core Features Grid */}
        <section className="w-full mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tight mb-3">{t.featuresTitle}</h2>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">{t.featuresSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Feature 1 */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-6 text-left space-y-3 shadow-sm hover:border-blue-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Banknote className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">{t.feature1Title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{t.feature1Desc}</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-6 text-left space-y-3 shadow-sm hover:border-blue-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">{t.feature2Title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{t.feature2Desc}</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-6 text-left space-y-3 shadow-sm hover:border-blue-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Gift className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">{t.feature3Title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{t.feature3Desc}</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-6 text-left space-y-3 shadow-sm hover:border-blue-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">{t.feature4Title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{t.feature4Desc}</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-6 text-left space-y-3 shadow-sm hover:border-blue-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">{t.feature5Title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{t.feature5Desc}</p>
            </div>

            {/* Feature 6 */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-6 text-left space-y-3 shadow-sm hover:border-blue-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">{t.feature6Title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{t.feature6Desc}</p>
            </div>

          </div>
        </section>

        {/* Real-time Server Status Component */}
        <section className="w-full max-w-3xl mb-20">
          <div className={`border rounded-2xl p-6 sm:p-8 transition-all shadow-sm ${
            serverStatus.online 
              ? 'bg-emerald-50/70 border-emerald-200' 
              : 'bg-red-50/70 border-red-200'
          }`}>
            {/* Status Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <span className="relative flex h-3.5 w-3.5">
                  {serverStatus.online && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                    serverStatus.online ? 'bg-emerald-500' : 'bg-red-500'
                  }`}></span>
                </span>
                <span className="text-xl font-black tracking-tight">
                  {t.statusTitle}{serverStatus.loading ? t.statusConnecting : (serverStatus.online ? t.statusOnline : t.statusOffline)}
                </span>
              </div>

              {serverStatus.online && (
                <div className="text-sm font-bold bg-white/80 px-4 py-1.5 rounded-full border border-emerald-200 text-emerald-800 shadow-xs">
                  {t.onlinePlayers}<span className="text-emerald-600 font-extrabold">{serverStatus.current_players}</span> / {serverStatus.max_players} {t.playersUnit}
                </div>
              )}
            </div>

            {/* Offline Message */}
            {!serverStatus.online && !serverStatus.loading && (
              <p className="text-sm text-red-600/80 font-medium mt-3 text-center sm:text-left">
                {t.offlineNotice}
              </p>
            )}

            {/* Online Players Grid (Only shown when server is online) */}
            {serverStatus.online && (
              <div className="mt-6 pt-5 border-t border-emerald-200/60">
                <div className="text-xs font-extrabold uppercase text-emerald-700/80 tracking-wider mb-3">
                  {t.playerListTitle}
                </div>
                {serverStatus.players && serverStatus.players.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5">
                    {serverStatus.players.map((p, idx) => {
                      const name = typeof p === 'string' ? p : p.name;
                      const avatar = typeof p === 'object' && p.avatar ? p.avatar : `https://mc-heads.net/avatar/${encodeURIComponent(name)}/32`;
                      return (
                        <div key={idx} className="flex items-center space-x-2 bg-white/90 border border-emerald-200 px-3 py-1.5 rounded-lg shadow-2xs hover:border-emerald-400 transition-colors">
                          <img src={avatar} alt={name} className="w-6 h-6 rounded border border-zinc-200" />
                          <span className="text-xs font-bold text-zinc-700">{name}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700/70 italic">{t.noPlayersOnline}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Connection Guides (Java / Bedrock Specs) */}
        <section id="join" className="w-full max-w-3xl text-center mb-16 scroll-mt-24">
          <h2 className="text-3xl font-black tracking-tight mb-8">{t.joinSectionTitle}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Java Card */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-8 text-left flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-blue-600 mb-3">
                  <span className="text-xs font-extrabold bg-blue-100 px-2.5 py-1 rounded">{t.javaBadge}</span>
                </div>
                <p className="text-sm text-zinc-600 mb-8 leading-relaxed">
                  {t.javaDesc}<strong className="text-blue-600 font-bold block mt-2">{t.javaNotice}</strong>
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between px-4 py-3 bg-white border border-zinc-200 rounded-lg text-sm md:text-base font-mono text-zinc-700">
                  <span>mc.craft-core.xyz</span>
                  <button
                    onClick={() => copyToClipboard('mc.craft-core.xyz', setCopiedJava)}
                    className="p-1.5 hover:bg-zinc-100 rounded text-zinc-500 hover:text-zinc-800 transition-colors"
                    aria-label="複製 Java 版伺服器 IP"
                  >
                    {copiedJava ? <Check className="w-4 h-4 text-blue-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-between items-center text-xs text-zinc-500">
                  <span>{t.javaVersion}</span>
                  {copiedJava && <span className="text-blue-600 font-bold">{t.copiedNotice}</span>}
                </div>
              </div>
            </div>

            {/* Bedrock Card */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-8 text-left flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-blue-600 mb-3">
                  <span className="text-xs font-extrabold bg-blue-100 px-2.5 py-1 rounded">{t.bedrockBadge}</span>
                </div>
                <p className="text-sm text-zinc-600 mb-8 leading-relaxed">
                  {t.bedrockDesc}
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between px-4 py-3 bg-white border border-zinc-200 rounded-lg text-sm md:text-base font-mono text-zinc-700">
                  <span>mc.craft-core.xyz : 19132</span>
                  <button
                    onClick={() => copyToClipboard('mc.craft-core.xyz:19132', setCopiedBedrock)}
                    className="p-1.5 hover:bg-zinc-100 rounded text-zinc-500 hover:text-zinc-800 transition-colors"
                    aria-label="複製基岩版伺服器 IP 與 Port"
                  >
                    {copiedBedrock ? <Check className="w-4 h-4 text-blue-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-between items-center text-xs text-zinc-500">
                  <span>{t.bedrockVersion}</span>
                  {copiedBedrock && <span className="text-blue-600 font-bold">{t.copiedNotice}</span>}
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
            <span>{t.rulesBtn}</span>
          </a>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-200 bg-zinc-50 py-8 text-sm text-zinc-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} {t.footerRights}</p>
          <div className="flex space-x-6">
            <a href="https://docs.craft-core.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-800">{t.footerRules}</a>
            <a href="https://discord.gg/XJZZwG7jR4" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-800">{t.footerContact}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
