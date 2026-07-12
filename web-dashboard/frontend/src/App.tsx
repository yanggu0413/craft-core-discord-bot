import React, { useState, useEffect, useRef } from 'react';
import { 
  Sun, Moon, Shield, DollarSign, ShoppingBag, BarChart3, 
  User, Copy, Search, LogOut, ArrowUpDown, ChevronRight,
  TrendingUp, Award, AwardIcon, Compass, Sparkles, RefreshCw,
  Mail, Settings, Bell, ChevronDown, Check, AlertTriangle
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, Legend 
} from 'recharts';

// API Configuration
const API_URL = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:3000/ws';

interface LeaderboardEntry {
  username: string;
  balance: number;
}

interface ChestShop {
  location: string;
  owner: string;
  item: string;
  stock: number;
  buy_price: number;
  sell_price: number;
  custom_name?: string;
}

interface TradeLog {
  timestamp: number;
  shop_coords: string;
  buyer: string;
  seller: string;
  item: string;
  quantity: number;
  unit_price: number;
  tax_deducted: number;
  net_profit: number;
}

export default function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('mc_username'));
  const [uuid, setUuid] = useState<string | null>(localStorage.getItem('mc_uuid'));
  const [userBalance, setUserBalance] = useState<number>(0);
  const [devLoginInput, setDevLoginInput] = useState('Yanggu');

  // Page routing
  const [activeTab, setActiveTab] = useState<'home' | 'explorer' | 'market' | 'owner'>('home');

  // Data states
  const [stats, setStats] = useState({ totalCirculation: 0, accumulatedSalesTax: 0, totalShopsCount: 0 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [shops, setShops] = useState<ChestShop[]>([]);
  const [analytics, setAnalytics] = useState<any>({});
  const [selectedMineral, setSelectedMineral] = useState('minecraft:diamond');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'stock_desc'>('price_asc');

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Toast Notifications list
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' }[]>([]);

  // Owner Panel states
  const [renameShopCoords, setRenameShopCoords] = useState<string | null>(null);
  const [newShopName, setNewShopName] = useState('');

  // Refs for tracking WS
  const wsRef = useRef<WebSocket | null>(null);

  // Toast trigger helper
  const triggerToast = (message: string, type: 'success' | 'info' = 'success') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  // Sync token search parameters on redirect oauth callback load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    const userParam = params.get('username');
    const uuidParam = params.get('uuid');

    if (tokenParam && userParam && uuidParam) {
      localStorage.setItem('jwt_token', tokenParam);
      localStorage.setItem('mc_username', userParam);
      localStorage.setItem('mc_uuid', uuidParam);
      setToken(tokenParam);
      setUsername(userParam);
      setUuid(uuidParam);
      // Clean URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      triggerToast(`歡迎回來，${userParam}！`, 'success');
    }
  }, []);

  // Fetch initial server stats, leaderboard & shops
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Stats
      const statsRes = await fetch(`${API_URL}/stats`);
      const statsJson = await statsRes.json();
      if (statsJson.success) setStats(statsJson.stats);

      // 2. Leaderboard
      const leadRes = await fetch(`${API_URL}/leaderboard`);
      const leadJson = await leadRes.json();
      if (leadJson.success) setLeaderboard(leadJson.leaderboard);

      // 3. Shops list
      const shopsRes = await fetch(`${API_URL}/shops`);
      const shopsJson = await shopsRes.json();
      if (shopsJson.success) setShops(shopsJson.shops);

      // 4. Analytics
      const analRes = await fetch(`${API_URL}/market/analytics`);
      const analJson = await analRes.json();
      if (analJson.success) setAnalytics(analJson.analytics);

      // 5. User balance if logged in
      if (token) {
        const userProfileRes = await fetch(`${API_URL}/user/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const userProfileJson = await userProfileRes.json();
        if (userProfileJson.success) {
          setUserBalance(userProfileJson.user.balance);
        }
      }
    } catch (err) {
      console.error('Failed to fetch API data', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Establish Live WebSocket connection with Backend
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Live WS connection to backend established.');
    };

    ws.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        const { type, payload } = packet;

        if (type === 'transaction_log') {
          const log = payload as TradeLog;
          const cleanedItem = log.item.replace('minecraft:', '').toUpperCase();
          triggerToast(
            `🛒 交易動態：${log.buyer} 向 ${log.seller} 購買了 ${log.quantity} 個 ${cleanedItem}，總額 $${log.net_profit + log.tax_deducted} 元！`,
            'info'
          );
          // Auto refresh stats dynamically
          fetchData();
        }
      } catch (err) {
        console.error('Error handling live WS packet', err);
      }
    };

    ws.onclose = () => {
      console.warn('Live WS disconnected, reconnecting in 5s...');
      setTimeout(() => {
        // Simple reconnect
      }, 5000);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Developer Bypass Auth Login handler
  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devLoginInput.trim()) return;

    try {
      const res = await fetch(`${API_URL}/auth/dev-login?username=${devLoginInput.trim()}`);
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('jwt_token', data.token);
        localStorage.setItem('mc_username', data.user.mc_username);
        localStorage.setItem('mc_uuid', data.user.mc_uuid);
        setToken(data.token);
        setUsername(data.user.mc_username);
        setUuid(data.user.mc_uuid);
        triggerToast('開發者模式登入成功！', 'success');
      } else {
        triggerToast('登入失敗：' + data.message, 'info');
      }
    } catch (err) {
      triggerToast('開發者登入發生錯誤！', 'info');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('mc_username');
    localStorage.removeItem('mc_uuid');
    setToken(null);
    setUsername(null);
    setUuid(null);
    setUserBalance(0);
    triggerToast('已成功登出。', 'success');
  };

  // Coords Copy Action helper
  const handleCopyTpCommand = (location: string) => {
    const coords = location.split(',').map(s => s.trim());
    if (coords.length === 3) {
      const cmd = `/tp ${coords[0]} ${coords[1]} ${coords[2]}`;
      navigator.clipboard.writeText(cmd);
      triggerToast(`已複製傳送指令: ${cmd}`, 'success');
    }
  };

  // Rename Chest Shop Escalated post
  const handleRenameShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameShopCoords || !newShopName.trim() || !token) return;

    try {
      const res = await fetch(`${API_URL}/shop/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          coords: renameShopCoords,
          custom_name: newShopName.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('商店重命名成功！已扣除 $5,000 手續費。', 'success');
        setRenameShopCoords(null);
        setNewShopName('');
        fetchData();
      } else {
        triggerToast(`❌ 失敗: ${data.message}`, 'info');
      }
    } catch (err: any) {
      triggerToast('更名過程發生錯誤！', 'info');
    }
  };

  // Withdraw Shop escrow money
  const handleWithdrawRevenue = async (coords: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/shop/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ coords })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message, 'success');
        fetchData();
      } else {
        triggerToast(`❌ 提領失敗: ${data.message}`, 'info');
      }
    } catch (err) {
      triggerToast('提領營收發生錯誤', 'info');
    }
  };

  // Upgrade slots limit post
  const handleUpgradeSlots = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/user/upgrade`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('成功升級商店插槽上限！', 'success');
        fetchData();
      } else {
        triggerToast(`❌ 升級失敗: ${data.message}`, 'info');
      }
    } catch (err) {
      triggerToast('升級過程發生錯誤', 'info');
    }
  };

  // Filtered Chest Shops logic
  const filteredShops = shops
    .filter(shop => {
      const cleanItem = shop.item.replace('minecraft:', '').toLowerCase();
      const customName = (shop.custom_name || '').toLowerCase();
      const owner = shop.owner.toLowerCase();
      const query = searchQuery.toLowerCase();
      return cleanItem.includes(query) || customName.includes(query) || owner.includes(query);
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.buy_price - b.buy_price;
      if (sortBy === 'price_desc') return b.buy_price - a.buy_price;
      if (sortBy === 'stock_desc') return b.stock - a.stock;
      return 0;
    });

  // Toggle Dark Mode
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className={`min-h-screen font-sans ${isDarkMode ? 'dark bg-darkBg text-zinc-100' : 'light bg-lightBg text-zinc-800'}`}>
      
      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b py-3 px-6 flex items-center justify-between transition-all">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2 rounded-xl text-white shadow-lg shadow-emerald-500/20">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              CRAFT-CORE
            </h1>
            <p className="text-xs opacity-60">聯名伺服器 Web 資訊板</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex space-x-1">
          {[
            { id: 'home', label: '📊 數據總覽', icon: BarChart3 },
            { id: 'explorer', label: '🏪 商店導航', icon: ShoppingBag },
            { id: 'market', label: '📈 市場行情', icon: TrendingUp },
            { id: 'owner', label: '🔑 店主管理', icon: User }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 shadow-inner' 
                  : 'hover:bg-zinc-500/10 opacity-70 hover:opacity-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* User Auth Section / Theme switch */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={toggleTheme}
            className="p-2.5 rounded-xl hover:bg-zinc-500/15 transition-all text-zinc-400 hover:text-emerald-400"
            title="切換主題"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {token && username ? (
            <div className="flex items-center space-x-3 bg-zinc-500/10 py-1.5 pl-3 pr-2 rounded-2xl border border-zinc-500/10">
              <img 
                src={`https://mc-heads.net/avatar/${username}/32`} 
                alt={username}
                className="w-7 h-7 rounded-lg shadow-md"
              />
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold leading-tight">{username}</p>
                <p className="text-[10px] text-emerald-400 font-medium">💰 ${userBalance.toLocaleString()} 元</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all ml-1"
                title="登出系統"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => {
                // If developer mode is detected, just trigger popup, otherwise link oauth url
                fetch(`${API_URL}/auth/url`)
                  .then(res => res.json())
                  .then(json => {
                    if (json.url) window.location.href = json.url;
                  })
                  .catch(() => triggerToast('OAuth 連結獲取失敗，請使用開發者登入！', 'info'));
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center space-x-2"
            >
              <span>🔑 綁定登入</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Main Layout Content Area */}
      <main className="max-w-7xl mx-auto p-6 md:p-8 animate-fade-in">
        
        {/* Sync loading spinner */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin" />
            <p className="text-sm opacity-60">正在對接 Minecraft 伺服器，請稍候...</p>
          </div>
        ) : (
          <>
            {/* Login Required / Dev Login Section on top if not authenticated */}
            {!token && (
              <div className="mb-8 p-6 glass-panel rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/5">
                <div className="text-left space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                    <Sparkles className="w-5 h-5" />
                    <span>對話串接已啟用 (WebSocket RPC Active)</span>
                  </div>
                  <h2 className="text-2xl font-bold">請先登入您的 Minecraft 帳號</h2>
                  <p className="text-sm opacity-70">
                    您需要與 Discord Bot 建立綁定，登入後即可享有遙控修改商店標題、提領餘額以及資產統計。
                  </p>
                </div>
                
                {/* Developer Login Card */}
                <form onSubmit={handleDevLogin} className="flex items-center space-x-3 bg-zinc-500/10 p-2 rounded-2xl border border-zinc-500/10 w-full md:w-auto">
                  <input 
                    type="text"
                    placeholder="輸入測試玩家 IGN"
                    value={devLoginInput}
                    onChange={(e) => setDevLoginInput(e.target.value)}
                    className="bg-transparent border-0 outline-none text-sm px-3 py-2 w-32 md:w-40 text-center font-semibold tracking-wider text-emerald-400 placeholder:text-zinc-500"
                  />
                  <button
                    type="submit"
                    className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                  >
                    🛠️ 測試登入
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT A: Home Panel */}
            {activeTab === 'home' && (
              <div className="space-y-8">
                {/* Statistics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { title: '💰 總流通金幣 (Circulation)', value: `$${stats.totalCirculation.toLocaleString()} 元`, desc: '全服綁定玩家總持有金幣', color: 'from-emerald-500 to-teal-400' },
                    { title: '🏛️ 累計收繳稅額 (Sales Tax)', value: `$${Number(stats.accumulatedSalesTax.toFixed(1)).toLocaleString()} 元`, desc: '胸口商店累計交易徵收稅款', color: 'from-blue-500 to-cyan-400' },
                    { title: '🏪 營運中胸口商店 (Active Shops)', value: `${stats.totalShopsCount} 間`, desc: '當前伺服器運作中的商店總數', color: 'from-amber-500 to-orange-400' }
                  ].map((card, i) => (
                    <div key={i} className="glass-panel p-6 rounded-3xl border text-left relative overflow-hidden group">
                      <div className={`absolute top-0 left-0 w-2 h-full bg-gradient-to-b ${card.color}`} />
                      <h3 className="text-xs font-semibold tracking-wider opacity-65 uppercase">{card.title}</h3>
                      <p className="text-3xl font-extrabold mt-3 tracking-tight">{card.value}</p>
                      <p className="text-xs opacity-60 mt-2">{card.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Main Content Splitted Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left: Wealth Leaderboard */}
                  <div className="lg:col-span-2 glass-panel rounded-3xl border p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <Award className="w-6 h-6 text-amber-400" />
                        <h2 className="text-xl font-bold tracking-tight">🏆 伺服器財富富豪榜</h2>
                      </div>
                      <button 
                        onClick={fetchData} 
                        disabled={isRefreshing}
                        className="text-xs flex items-center space-x-1.5 opacity-60 hover:opacity-100 transition-all hover:text-emerald-400 disabled:opacity-30"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>重新整理</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-500/10 text-xs opacity-60 uppercase font-semibold">
                            <th className="py-3 px-4 w-16">排名</th>
                            <th className="py-3 px-4">玩家名稱 (IGN)</th>
                            <th className="py-3 px-4 text-right">財富餘額</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-500/5">
                          {leaderboard.slice(0, 10).map((player, idx) => {
                            let medal = <span className="font-semibold opacity-60">{idx + 1}</span>;
                            if (idx === 0) medal = <span className="text-2xl">🥇</span>;
                            else if (idx === 1) medal = <span className="text-2xl">🥈</span>;
                            else if (idx === 2) medal = <span className="text-2xl">🥉</span>;

                            return (
                              <tr key={idx} className="hover:bg-zinc-500/5 transition-all rounded-xl">
                                <td className="py-3.5 px-4 font-bold text-sm">{medal}</td>
                                <td className="py-3.5 px-4 flex items-center space-x-3">
                                  <img 
                                    src={`https://mc-heads.net/avatar/${player.username}/24`} 
                                    alt={player.username}
                                    className="w-6 h-6 rounded-md"
                                  />
                                  <span className="font-semibold text-sm">{player.username}</span>
                                </td>
                                <td className="py-3.5 px-4 text-right font-extrabold text-emerald-400 text-sm">
                                  ${player.balance.toLocaleString()} 元
                                </td>
                              </tr>
                            );
                          })}
                          {leaderboard.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-8 text-center text-sm opacity-60">目前暫無任何排行榜數據</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right: Live trade feed widget */}
                  <div className="glass-panel rounded-3xl border p-6 flex flex-col text-left">
                    <div className="flex items-center space-x-2.5 mb-6">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                      <h2 className="text-lg font-bold">🛒 即時交易動態日誌</h2>
                    </div>

                    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                      {/* We will populate some mock dynamic logs if empty */}
                      {[
                        { time: '17:52', buyer: 'Yanggu', seller: 'Rory', item: '鑽石', profit: 5000 },
                        { time: '17:48', buyer: 'Alice', seller: 'Bob', item: '鐵錠 x 64', profit: 1600 },
                        { time: '17:40', buyer: 'Charlie', seller: 'Yanggu', item: '獄髓碎片', profit: 4500 }
                      ].map((trade, i) => (
                        <div key={i} className="p-3 bg-zinc-500/5 hover:bg-zinc-500/10 rounded-2xl border border-zinc-500/5 text-xs transition-all space-y-1">
                          <div className="flex items-center justify-between text-[10px] opacity-60">
                            <span>⏱️ {trade.time}</span>
                            <span className="text-emerald-400 font-bold">成交 ${trade.profit} 元</span>
                          </div>
                          <p className="leading-relaxed">
                            <span className="font-semibold text-emerald-400">{trade.buyer}</span> 購買了 
                            <span className="font-semibold text-amber-400"> {trade.item} </span>
                            (賣家: <span className="opacity-80">{trade.seller}</span>)
                          </p>
                        </div>
                      ))}
                      <div className="text-center py-4 text-[10px] opacity-50 border-t border-zinc-500/5 mt-4">
                        💡 遊戲內交易箱子時，網頁將自動彈出實時更新！
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT B: Shop Explorer */}
            {activeTab === 'explorer' && (
              <div className="space-y-6">
                {/* Search and Filters toolbar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 glass-panel rounded-3xl border">
                  {/* Search box */}
                  <div className="flex items-center bg-zinc-500/10 px-4 py-2.5 rounded-2xl border border-zinc-500/5 w-full md:max-w-md">
                    <Search className="w-5 h-5 text-zinc-400 shrink-0 mr-2" />
                    <input 
                      type="text" 
                      placeholder="模糊關鍵字搜尋商品、擁有者..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent border-0 outline-none w-full text-sm placeholder:text-zinc-500 text-zinc-100"
                    />
                  </div>

                  {/* Sorter toggles */}
                  <div className="flex items-center space-x-2 w-full md:w-auto shrink-0 justify-end">
                    <button
                      onClick={() => setSortBy('price_asc')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        sortBy === 'price_asc' 
                          ? 'bg-emerald-500 text-white border-emerald-500' 
                          : 'bg-zinc-500/10 hover:bg-zinc-500/15 border-transparent'
                      }`}
                    >
                      💰 價格低到高
                    </button>
                    <button
                      onClick={() => setSortBy('price_desc')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        sortBy === 'price_desc' 
                          ? 'bg-emerald-500 text-white border-emerald-500' 
                          : 'bg-zinc-500/10 hover:bg-zinc-500/15 border-transparent'
                      }`}
                    >
                      📈 價格高到低
                    </button>
                    <button
                      onClick={() => setSortBy('stock_desc')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        sortBy === 'stock_desc' 
                          ? 'bg-emerald-500 text-white border-emerald-500' 
                          : 'bg-zinc-500/10 hover:bg-zinc-500/15 border-transparent'
                      }`}
                    >
                      🎒 庫存多到少
                    </button>
                  </div>
                </div>

                {/* Directory Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredShops.map((shop, i) => {
                    const cleanItem = shop.item.replace('minecraft:', '').replace('_', ' ').toUpperCase();
                    return (
                      <div key={i} className="glass-panel p-5 rounded-3xl border text-left flex flex-col justify-between hover:shadow-lg hover:shadow-emerald-500/5 transition-all group">
                        
                        <div className="space-y-3">
                          {/* Header name */}
                          <div className="flex items-start justify-between">
                            <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md">
                              📍 {shop.location}
                            </span>
                            <button
                              onClick={() => handleCopyTpCommand(shop.location)}
                              className="text-zinc-400 hover:text-emerald-400 transition-all"
                              title="複製傳送指令 (/tp)"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <h3 className="font-extrabold text-base tracking-wide group-hover:text-emerald-400 transition-all leading-tight">
                            {shop.custom_name || `${shop.owner} 的胸口商店`}
                          </h3>

                          {/* Item Block info */}
                          <div className="flex items-center space-x-3 p-3 bg-zinc-500/5 rounded-2xl border border-zinc-500/5">
                            <img 
                              src={`https://mc-heads.net/avatar/${shop.owner}/24`} 
                              alt={shop.owner}
                              className="w-6 h-6 rounded-md"
                              title={`店主: ${shop.owner}`}
                            />
                            <div className="text-xs">
                              <p className="font-semibold text-amber-400">{cleanItem}</p>
                              <p className="opacity-60 text-[10px]">店主：{shop.owner}</p>
                            </div>
                          </div>
                        </div>

                        {/* Trade Actions/Escrow info */}
                        <div className="mt-4 pt-3 border-t border-zinc-500/5 flex items-center justify-between text-xs">
                          <div>
                            <p className="opacity-60 text-[10px]">買入價格</p>
                            <p className="font-extrabold text-emerald-400">${shop.buy_price} 元</p>
                          </div>
                          <div>
                            <p className="opacity-60 text-[10px]">賣出回購</p>
                            <p className="font-extrabold text-amber-500">
                              {shop.sell_price > 0 ? `$${shop.sell_price} 元` : '不收購'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="opacity-60 text-[10px]">剩餘庫存</p>
                            <p className="font-bold">{shop.stock} 個</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredShops.length === 0 && (
                    <div className="col-span-full py-16 text-center text-sm opacity-60">
                      🔍 找不到任何符合過濾條件的胸口商店
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT C: Market Analytics */}
            {activeTab === 'market' && (
              <div className="space-y-8">
                {/* Mineral Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    { id: 'minecraft:diamond', name: '💎 鑽石 (Diamond)', avgPrice: '$530 元', trend: '+1.9%' },
                    { id: 'minecraft:netherite_ingot', name: '🔥 獄髓合金 (Netherite)', avgPrice: '$4700 元', trend: '+3.2%' },
                    { id: 'minecraft:iron_ingot', name: '⚙️ 鐵錠 (Iron Ingot)', avgPrice: '$29 元', trend: '+3.5%' }
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedMineral(item.id)}
                      className={`glass-panel p-6 rounded-3xl border text-left flex justify-between items-center transition-all ${
                        selectedMineral === item.id 
                          ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/5' 
                          : 'border-zinc-500/10 hover:bg-zinc-500/5'
                      }`}
                    >
                      <div>
                        <h4 className="text-sm font-bold opacity-80">{item.name}</h4>
                        <p className="text-2xl font-black mt-2">{item.avgPrice}</p>
                      </div>
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-1 rounded-md">
                        {item.trend}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Price trend Recharts graph */}
                <div className="glass-panel p-6 rounded-3xl border text-left">
                  <h3 className="text-lg font-bold mb-6 flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    <span>礦物價格交易量波動趨勢 (7天交易圖表)</span>
                  </h3>

                  <div className="w-full h-80">
                    {analytics[selectedMineral] ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={analytics[selectedMineral]}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                          <XAxis dataKey="date" stroke="#888888" fontSize={11} />
                          <YAxis yAxisId="left" stroke="#10b981" fontSize={11} label={{ value: '平均價格 ($)', angle: -90, position: 'insideLeft', style: { fill: '#10b981', fontSize: 11 } }} />
                          <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} label={{ value: '交易數量', angle: 90, position: 'insideRight', style: { fill: '#f59e0b', fontSize: 11 } }} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: isDarkMode ? '#1f1f23' : '#ffffff', 
                              borderColor: 'rgba(16, 185, 129, 0.2)',
                              color: isDarkMode ? '#f4f4f5' : '#18181b',
                              borderRadius: '12px'
                            }} 
                          />
                          <Area yAxisId="left" type="monotone" dataKey="price" name="平均價格" stroke="#10b981" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} />
                          <Area yAxisId="right" type="monotone" dataKey="volume" name="交易數量" stroke="#f59e0b" fillOpacity={1} fill="url(#colorVolume)" strokeWidth={1.5} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full opacity-50 text-xs">
                        目前暫無此項礦物的走勢數據
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT D: Owner Management Panel */}
            {activeTab === 'owner' && (
              <div className="space-y-6">
                {!token ? (
                  <div className="py-16 text-center space-y-4">
                    <User className="w-16 h-16 opacity-30 mx-auto" />
                    <h3 className="text-xl font-bold">請先綁定您的 Minecraft 帳號</h3>
                    <p className="text-sm opacity-60">店主面板需要通過 JWT 認證才能讀取您在遊戲內擁有的商店。</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Owner stats & upgrades banner */}
                    <div className="glass-panel p-6 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-emerald-500/5 to-teal-500/10">
                      <div className="text-left space-y-1">
                        <h3 className="text-xl font-black">🏪 店主遙控中心</h3>
                        <p className="text-xs opacity-75">
                          您可以在這裡直接修改實體告示牌名稱（手續費 $5,000 元）或一鍵領取商店託管的買賣營收金幣。
                        </p>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <button
                          onClick={handleUpgradeSlots}
                          className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-xs px-5 py-3 rounded-xl transition-all"
                        >
                          ⚡ 升級商店插槽上限
                        </button>
                      </div>
                    </div>

                    {/* Owner Shops Grid list */}
                    <div className="space-y-4 text-left">
                      <h3 className="text-lg font-bold">您的旗下胸口商店 (Owned Chest Shops)</h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {shops
                          .filter(shop => shop.owner.toLowerCase() === username?.toLowerCase())
                          .map((shop, i) => {
                            const cleanItem = shop.item.replace('minecraft:', '').toUpperCase();
                            return (
                              <div key={i} className="glass-panel p-6 rounded-3xl border flex flex-col justify-between gap-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md">
                                      📍 {shop.location}
                                    </span>
                                    <span className="text-xs opacity-60">庫存：{shop.stock} 個</span>
                                  </div>

                                  <h4 className="font-extrabold text-base">
                                    {shop.custom_name || `${shop.owner} 的胸口商店`}
                                  </h4>

                                  <div className="flex items-center space-x-2 text-xs opacity-80">
                                    <span className="text-amber-400 font-bold">{cleanItem}</span>
                                    <span>⟫ 買入價格 ${shop.buy_price} | 回購價 ${shop.sell_price}</span>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2 pt-3 border-t border-zinc-500/5">
                                  <button
                                    onClick={() => handleWithdrawRevenue(shop.location)}
                                    className="bg-zinc-500/10 hover:bg-zinc-500/15 text-emerald-400 hover:text-emerald-300 font-bold text-xs px-4 py-2.5 rounded-xl border border-transparent transition-all w-1/2"
                                  >
                                    💰 提領營收
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRenameShopCoords(shop.location);
                                      setNewShopName(shop.custom_name || '');
                                    }}
                                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs px-4 py-2.5 rounded-xl border border-transparent transition-all w-1/2"
                                  >
                                    ✏️ 遙控更名
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        
                        {shops.filter(shop => shop.owner.toLowerCase() === username?.toLowerCase()).length === 0 && (
                          <div className="col-span-full py-16 text-center text-sm opacity-60 bg-zinc-500/5 rounded-3xl border border-dashed border-zinc-500/10">
                            🏝️ 您目前在伺服器中尚無註冊胸口商店
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </main>

      {/* 3. Global Toast Notifications Overlay */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-md w-full">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className={`p-4 rounded-2xl shadow-xl flex items-start space-x-3 border animate-fade-in ${
              toast.type === 'success' 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                : 'bg-zinc-800 border-zinc-700 text-zinc-100'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <ShoppingBag className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
            )}
            <p className="text-xs font-semibold leading-relaxed text-left">{toast.message}</p>
          </div>
        ))}
      </div>

      {/* 4. Owner Rename Shop Modal Overlay */}
      {renameShopCoords && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass-panel p-6 rounded-3xl border max-w-md w-full space-y-4 bg-zinc-900 text-zinc-100">
            <div className="text-left space-y-1">
              <h3 className="text-lg font-bold">✏️ 遙控更改商店名稱</h3>
              <p className="text-xs opacity-65">
                坐標：`{renameShopCoords}`。此操作將於遊戲內收取手續費 $5,000 元，並實時改寫告示牌文字。
              </p>
            </div>

            <form onSubmit={handleRenameShopSubmit} className="space-y-4">
              <input
                type="text"
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                placeholder="輸入全新商店招牌名稱"
                className="w-full bg-zinc-500/10 border border-zinc-500/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-zinc-100"
                maxLength={20}
                required
              />

              <div className="flex items-center space-x-3 justify-end text-xs">
                <button
                  type="button"
                  onClick={() => setRenameShopCoords(null)}
                  className="px-4 py-2.5 rounded-xl hover:bg-zinc-500/10 text-zinc-400"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-5 py-2.5 rounded-xl transition-all"
                >
                  儲存並改名
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
