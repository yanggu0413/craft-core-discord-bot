import { useState, useEffect, useRef } from 'react';
import { Check, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import DashboardLayout from './components/DashboardLayout';
import HomeView from './components/views/HomeView';
import ExplorerView from './components/views/ExplorerView';
import MarketView from './components/views/MarketView';
import OwnerView from './components/views/OwnerView';
import ClaimsView from './components/views/ClaimsView';
import LockboxesView from './components/views/LockboxesView';
import InventoryView from './components/views/InventoryView';
import AdminView from './components/views/AdminView';
import WelfareView from './components/views/WelfareView';
import { Card, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { cn } from './lib/utils';

// 後端介面設定
const API_URL = window.location.port === '5173'
  ? 'http://localhost:3000/api'
  : `${window.location.protocol}//${window.location.host}/api`;
const WS_URL = window.location.port === '5173'
  ? 'ws://localhost:3000/ws'
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

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
  // 主題設定：預設使用淺色模式
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme_mode');
    return saved ? saved === 'dark' : false;
  });

  // 同步樣式類名與主題狀態
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme_mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('theme_mode', 'light');
    }
  }, [isDarkMode]);

  // 登入憑證與帳號狀態
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('mc_username'));
  const [, setUuid] = useState<string | null>(localStorage.getItem('mc_uuid'));
  const [userBalance, setUserBalance] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [playerCoords, setPlayerCoords] = useState<string>('離線');
  const [serverTps, setServerTps] = useState<number>(20.0);

  // 個人福利與收發件狀態
  const [keysCount, setKeysCount] = useState<number>(0);
  const [checkinStreak, setCheckinStreak] = useState<number>(0);
  const [totalCheckins, setTotalCheckins] = useState<number>(0);
  const [lastCheckin, setLastCheckin] = useState<string | null>(null);
  const [subscribeReminder, setSubscribeReminder] = useState<number>(0);
  const [mails, setMails] = useState<any[]>([]);
  const [liveTrades, setLiveTrades] = useState<any[]>([]);

  // 當前選單分頁
  const [activeTab, setActiveTab] = useState<'home' | 'explorer' | 'market' | 'owner' | 'claims' | 'lockboxes' | 'inventory' | 'admin' | 'welfare'>('home');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // 全域數據狀態
  const [stats, setStats] = useState({ totalCirculation: 0, accumulatedSalesTax: 0, totalShopsCount: 0 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [shops, setShops] = useState<ChestShop[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, any[]>>({});
  const [claims, setClaims] = useState<any[]>([]);
  const [lockboxes, setLockboxes] = useState<any[]>([]);
  const [selectedMineral, setSelectedMineral] = useState('minecraft:diamond');
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [dailyTasksDate, setDailyTasksDate] = useState<string>('');

  // 搜尋與篩選狀態 (商店導航使用)
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'stock_desc'>('price_asc');

  // 載入與更新狀態
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 提示訊息列表
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'error' }[]>([]);

  // 建立套接字參照
  const wsRef = useRef<WebSocket | null>(null);

  // 觸發提示訊息工具
  const triggerToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 7000);
  };

  // 驗證開放授權重新導向參數
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    const userParam = params.get('username');
    const uuidParam = params.get('uuid');
    const errorParam = params.get('error');
    const discordUsername = params.get('discord_username');

    if (tokenParam && userParam && uuidParam) {
      localStorage.setItem('jwt_token', tokenParam);
      localStorage.setItem('mc_username', userParam);
      localStorage.setItem('mc_uuid', uuidParam);
      setToken(tokenParam);
      setUsername(userParam);
      setUuid(uuidParam);
      window.history.replaceState({}, document.title, window.location.pathname);
      triggerToast(`歡迎回來，${userParam}！`, 'success');
    } else if (errorParam === 'not_bound') {
      const nameStr = discordUsername ? `您的通訊軟體帳號（@${decodeURIComponent(discordUsername)}）` : '您的通訊軟體帳號';
      triggerToast(`${nameStr}尚未與遊戲角色連結綁定。請先登入遊戲輸入指令「/discord link」獲取驗證碼，再前往官方通訊伺服器使用指令進行綁定。`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorParam) {
      triggerToast(`登入失敗：安全驗證錯誤（${errorParam}）`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // 獲取伺服器基礎數據
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      // 1. 系統統計
      const statsRes = await fetch(`${API_URL}/stats`);
      const statsJson = await statsRes.json();
      if (statsJson.success) setStats(statsJson.stats);

      // 2. 富豪榜
      const leadRes = await fetch(`${API_URL}/leaderboard`);
      const leadJson = await leadRes.json();
      if (leadJson.success) setLeaderboard(leadJson.leaderboard);

      // 3. 商店列表
      const shopsRes = await fetch(`${API_URL}/shops`);
      const shopsJson = await shopsRes.json();
      if (shopsJson.success) setShops(shopsJson.shops);

      // 4. 市場行情
      const analRes = await fetch(`${API_URL}/market/analytics`);
      const analJson = await analRes.json();
      if (analJson.success) setAnalytics(analJson.analytics);

      // 5. 即時成交歷史
      try {
        const recentRes = await fetch(`${API_URL}/market/recent`);
        const recentJson = await recentRes.json();
        if (recentJson.success) {
          setLiveTrades(recentJson.trades || []);
        }
      } catch (err) {
        console.error('Failed to fetch recent trades', err);
      }

      // 6. 登入玩家的帳戶資料與信箱
      if (token) {
        try {
          const profileRes = await fetch(`${API_URL}/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const profileJson = await profileRes.json();
            if (profileJson.success) {
              setUserBalance(profileJson.user.balance);
              setKeysCount(profileJson.user.keys_count || 0);
              setCheckinStreak(profileJson.user.checkin_streak || 0);
              setTotalCheckins(profileJson.user.total_checkins || 0);
              setLastCheckin(profileJson.user.last_checkin || null);
              setSubscribeReminder(profileJson.user.subscribe_reminder || 0);
              setIsOnline(!!profileJson.user.online);
              setPlayerCoords(profileJson.user.coords || '離線');
              setServerTps(typeof profileJson.user.tps === 'number' ? profileJson.user.tps : 20.0);
              setIsAdmin(!!profileJson.user.isAdmin);
            }
        } catch (err) {
          console.error('Failed to fetch profile', err);
        }

        try {
          const mailsRes = await fetch(`${API_URL}/user/mails`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const mailsJson = await mailsRes.json();
          if (mailsJson.success) {
            setMails(mailsJson.mails || []);
          }
        } catch (err) {
          console.error('Failed to fetch mails', err);
        }
      }

      // 7. 今日每日任務
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const tasksRes = await fetch(`${API_URL}/tasks/daily`, { headers });
        const tasksJson = await tasksRes.json();
        if (tasksJson.success) {
          setDailyTasks(tasksJson.tasks || []);
          setDailyTasksDate(tasksJson.date || '');
        }
      } catch (err) {
        console.error('Failed to fetch tasks', err);
      }

      // 8. 領地列表
      const claimsRes = await fetch(`${API_URL}/claims`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const claimsJson = await claimsRes.json();
      if (claimsJson.success) setClaims(claimsJson.claims);

      // 9. 密碼鎖列表
      const lockboxesRes = await fetch(`${API_URL}/lockboxes`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const lockboxesJson = await lockboxesRes.json();
      if (lockboxesJson.success) setLockboxes(lockboxesJson.lockboxes);

    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // 建立套接字連線
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Live WS connection active.');
    };

    ws.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        const { type, payload } = packet;

        if (type === 'transaction_log') {
          const log = payload as TradeLog;
          const cleanedItem = log.item.replace('minecraft:', '').toUpperCase();
          triggerToast(
            `交易動態：玩家 ${log.buyer} 向店主 ${log.seller} 購買了 ${log.quantity} 個 ${cleanedItem}，成交金額 $${log.net_profit + log.tax_deducted} 元！`,
            'info'
          );
          
          setLiveTrades((prev) => [
            {
              time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
              buyer: log.buyer,
              seller: log.seller,
              item: cleanedItem,
              quantity: log.quantity,
              profit: log.net_profit
            },
            ...prev
          ].slice(0, 15));

          fetchData();
        }
      } catch (err) {
        console.error('Error parsing live WS packet', err);
      }
    };

    ws.onclose = () => {
      console.warn('Live WS closed. Reconnecting...');
    };

    return () => {
      ws.close();
    };
  }, []);


  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('mc_username');
    localStorage.removeItem('mc_uuid');
    setToken(null);
    setUsername(null);
    setUuid(null);
    setUserBalance(0);
    setIsAdmin(false);
    setActiveTab('home');
    triggerToast('帳號已安全登出。', 'success');
  };

  const handleLoginTrigger = () => {
    fetch(`${API_URL}/auth/url`)
      .then(res => res.json())
      .then(json => {
        if (json.url) window.location.href = json.url;
      })
      .catch(() => triggerToast('安全驗證連結獲取失敗，請改用下方開發者測試通道登入。', 'error'));
  };

  // 複製對應座標的傳送指令
  const handleCopyTpCommand = (location: string) => {
    const coords = location.split(',').map(s => s.trim());
    if (coords.length === 3) {
      const cmd = `/tp ${coords[0]} ${coords[1]} ${coords[2]}`;
      navigator.clipboard.writeText(cmd);
      triggerToast(`已成功複製傳送指令：${cmd}`, 'success');
    }
  };

  // 遠端更改商店名稱
  const handleRenameShopSubmit = async (coords: string, newName: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/shop/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          coords,
          custom_name: newName.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('商店告示牌名稱修改成功！帳戶已扣除金幣手續費 $5,000 元。', 'success');
        fetchData();
      } else {
        triggerToast(`更名失敗：${data.message}`, 'error');
      }
    } catch (err) {
      triggerToast('更名操作連線失敗，請檢查網路連線。', 'error');
    }
  };

  // 提領商店累積的交易營收
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
        triggerToast(data.message || '金幣提領成功！已匯入您的個人帳戶。', 'success');
        fetchData();
      } else {
        triggerToast(`提領失敗：${data.message}`, 'error');
      }
    } catch (err) {
      triggerToast('提領營收連線異常，請稍後再試。', 'error');
    }
  };

  // 升級商店插槽上限
  const handleUpgradeSlots = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/user/upgrade`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('成功提升商店最大註冊數量上限！', 'success');
        fetchData();
      } else {
        triggerToast(`升級失敗：${data.message}`, 'error');
      }
    } catch (err) {
      triggerToast('升級申請連線錯誤', 'error');
    }
  };

  // 領取每日任務獎勵
  const handleClaimReward = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/tasks/claim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('成功領取每日任務獎勵！', 'success');
        fetchData();
      } else {
        triggerToast(`領取失敗：${data.message}`, 'error');
      }
    } catch (err) {
      triggerToast('領取任務獎勵連線異常，請稍後再試。', 'error');
    }
  };

  // 管理密碼鎖安全箱
  const handleUpdateLockbox = async (lockboxId: string, action: string, targetPlayer?: string, newPassword?: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/lockboxes/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ lockboxId, action, targetPlayer, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '密碼鎖設定更新成功！', 'success');
        fetchData();
      } else {
        triggerToast(`更新失敗：${data.message}`, 'error');
      }
    } catch (err) {
      triggerToast('更新密碼鎖連線錯誤，請稍後重試。', 'error');
    }
  };

  // 更新領地保護區玩家權限
  const handleUpdatePermission = async (claimId: string, permissionType: string, player: string, action: 'grant' | 'revoke') => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_URL}/claims/permission`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ claimId, permissionType, player, action })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '領地授權名單更新成功！', 'success');
        // 重新獲取最新的領地保護區資料
        const claimsRes = await fetch(`${API_URL}/claims`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const claimsJson = await claimsRes.json();
        if (claimsJson.success) setClaims(claimsJson.claims);
      } else {
        triggerToast(data.message || '更新授權名單失敗！', 'error');
      }
    } catch (err: any) {
      triggerToast(`連線失敗：${err.message}`, 'error');
    }
  };

  return (
    <DashboardLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isDarkMode={isDarkMode}
      toggleTheme={() => setIsDarkMode(!isDarkMode)}
      token={token}
      username={username}
      userBalance={userBalance}
      handleLogout={handleLogout}
      handleLoginTrigger={handleLoginTrigger}
      isAdmin={isAdmin}
    >
      {/* 連線同步狀態 */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground">正在同步遊戲伺服器數據，請稍候...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 未登入狀態下的橫幅 */}
          {!token && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-6">
                <div className="text-left space-y-2">
                  <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 border border-emerald-500/20 bg-emerald-500/10 rounded-[2px] text-[10px] text-emerald-500 font-bold">
                    <Sparkles className="w-3 h-3" />
                    <span>伺服器即時通訊服務已啟用</span>
                  </div>
                  <CardTitle className="text-base font-bold">請先連結並登入您的遊戲帳號</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    請先在遊戲中輸入指令「/discord link」獲取驗證碼，並於官方 Discord 伺服器中輸入指令進行綁定。完成後即可點擊右上方的「Discord 帳號登入」按鈕進行安全登入，隨時查詢領地狀態、遙控商店更名與提領金幣。
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* 各分頁視圖切換 */}
          {activeTab === 'home' && (
            <HomeView
              stats={stats}
              dailyTasks={dailyTasks}
              dailyTasksDate={dailyTasksDate}
              token={token}
              username={username}
              userBalance={userBalance}
              checkinStreak={checkinStreak}
              totalCheckins={totalCheckins}
              keysCount={keysCount}
              lastCheckin={lastCheckin}
              mails={mails}
              leaderboard={leaderboard}
              liveTrades={liveTrades}
              fetchData={fetchData}
              isRefreshing={isRefreshing}
              isOnline={isOnline}
              playerCoords={playerCoords}
              serverTps={serverTps}
              onClaimReward={handleClaimReward}
            />
          )}

          {activeTab === 'explorer' && (
            <ExplorerView
              shops={shops}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              sortBy={sortBy}
              setSortBy={setSortBy}
              handleCopyTpCommand={handleCopyTpCommand}
            />
          )}

          {activeTab === 'market' && (
            <MarketView
              analytics={analytics}
              selectedMineral={selectedMineral}
              setSelectedMineral={setSelectedMineral}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === 'owner' && (
            <OwnerView
              shops={shops}
              token={token}
              username={username}
              handleWithdrawRevenue={handleWithdrawRevenue}
              handleRenameShopSubmit={handleRenameShopSubmit}
              handleUpgradeSlots={handleUpgradeSlots}
            />
          )}

          {activeTab === 'claims' && (
            <ClaimsView
              claims={claims}
              username={username}
              handleUpdatePermission={handleUpdatePermission}
            />
          )}

          {activeTab === 'lockboxes' && (
            <LockboxesView
              lockboxes={lockboxes}
              onUpdateLockbox={handleUpdateLockbox}
              currentUser={username}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              token={token}
              isOnline={isOnline}
              userBalance={userBalance}
              triggerToast={triggerToast}
              fetchData={fetchData}
            />
          )}

          {activeTab === 'welfare' && (
            <WelfareView
              token={token}
              isOnline={isOnline}
              triggerToast={triggerToast}
              fetchData={fetchData}
              keysCount={keysCount}
              checkinStreak={checkinStreak}
              totalCheckins={totalCheckins}
              lastCheckin={lastCheckin}
              subscribeReminder={subscribeReminder}
              setSubscribeReminder={setSubscribeReminder}
              setKeysCount={setKeysCount}
              setCheckinStreak={setCheckinStreak}
              setTotalCheckins={setTotalCheckins}
              setLastCheckin={setLastCheckin}
              API_URL={API_URL}
            />
          )}

          {activeTab === 'admin' && isAdmin && (
            <AdminView
              token={token}
              triggerToast={triggerToast}
              API_URL={API_URL}
            />
          )}
        </div>
      )}

      {/* 全域提示通知浮窗 */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className={cn(
              "p-3 rounded-[4px] border flex items-start space-x-2.5 text-xs text-foreground transition-all duration-200 bg-card shadow-none animate-fade-in",
              toast.type === 'success' && "border-emerald-500/30 text-emerald-500",
              toast.type === 'error' && "border-red-500/30 text-red-500",
              toast.type === 'info' && "border-border text-foreground"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : (
                <span className="relative flex h-2 w-2 mt-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
              )}
            </div>
            <p className="text-xs font-bold leading-normal text-left flex-1 text-foreground">
              {toast.message}
            </p>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
