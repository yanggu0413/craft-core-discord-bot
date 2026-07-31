import { useState, useEffect, useRef } from 'react';
import { 
  Gift, Calendar, Flame, Key, Trophy, Clock, 
  ArrowRight, Bell, BellOff, Volume2, VolumeX, RefreshCw 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import MinecraftItemIcon from '../ui/MinecraftItemIcon';

interface WelfareViewProps {
  token: string | null;
  isOnline: boolean;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  fetchData: () => Promise<void>;
  keysCount: number;
  checkinStreak: number;
  totalCheckins: number;
  lastCheckin: string | null;
  subscribeReminder: number;
  setSubscribeReminder: (val: number) => void;
  setKeysCount: (val: number) => void;
  setCheckinStreak: (val: number) => void;
  setTotalCheckins: (val: number) => void;
  setLastCheckin: (val: string | null) => void;
  API_URL: string;
}

interface LeaderboardEntry {
  mc_username: string;
  keys_count: number;
  checkin_streak: number;
  total_checkins: number;
}

const PRIZE_POOL = [
  { id: 'minecraft:diamond', name: '鑽石 x 5', color: 'border-blue-500/40 bg-blue-500/5 text-blue-400' },
  { id: 'minecraft:golden_carrot', name: '金胡蘿蔔 x 5', color: 'border-yellow-500/40 bg-yellow-500/5 text-yellow-400' },
  { id: 'minecraft:golden_apple', name: '金蘋果 x 5', color: 'border-amber-500/40 bg-amber-500/5 text-amber-400' },
  { id: 'minecraft:experience_bottle', name: '經驗瓶 x 64', color: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400' },
  { id: 'minecraft:totem_of_undying', name: '不死圖騰 x 1', color: 'border-amber-600/40 bg-amber-600/5 text-amber-500' },
  { id: 'craftcore:money', name: '遊戲金幣', color: 'border-red-500/40 bg-red-500/5 text-red-400' }
];

export default function WelfareView({
  token,
  isOnline: _isOnline,
  triggerToast,
  fetchData,
  keysCount,
  checkinStreak,
  totalCheckins,
  lastCheckin,
  subscribeReminder,
  setSubscribeReminder,
  setKeysCount,
  setCheckinStreak,
  setTotalCheckins,
  setLastCheckin,
  API_URL
}: WelfareViewProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingCheckin, setLoadingCheckin] = useState(false);
  const [loadingReminder, setLoadingReminder] = useState(false);
  const [loadingExchange, setLoadingExchange] = useState(false);
  const [exchangeMode, setExchangeMode] = useState<'single' | 'all'>('single');

  // Titles State
  const [unlockedTitles, setUnlockedTitles] = useState<string[]>([]);
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [loadingTitles, setLoadingTitles] = useState(false);

  const fetchTitles = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/user/titles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActiveTitle(data.activeTitle || '');
        setUnlockedTitles(data.unlockedTitles || []);
      }
    } catch (e) {
      console.error('Error fetching user titles:', e);
    }
  };

  useEffect(() => {
    fetchTitles();
  }, [token]);

  const handleEquipTitle = async (titleText: string) => {
    if (!token) return;
    setLoadingTitles(true);
    try {
      const res = await fetch(`${API_URL}/user/title/equip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title_text: titleText })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '稱號設定完成！', 'success');
        fetchTitles();
      } else {
        triggerToast(data.message || '稱號設定失敗', 'error');
      }
    } catch (e: any) {
      triggerToast('請求失敗：' + e.message, 'error');
    } finally {
      setLoadingTitles(false);
    }
  };

  // Lucky Draw State
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinPrizes, setSpinPrizes] = useState<typeof PRIZE_POOL>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const spinContainerRef = useRef<HTMLDivElement>(null);
  const spinAnimationFrameRef = useRef<number | null>(null);

  // Timezones Taipei Helper
  const getTaipeiDateStr = (date = new Date()) => {
    const options = { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-US', options as any);
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTaipeiDateStr();
  const alreadyCheckedInToday = lastCheckin === todayStr;

  // Synthesize Sound Effects using Web Audio API
  const playTickSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.warn('AudioContext failed:', e);
    }
  };

  const playLevelUpSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + index * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.12 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + index * 0.12);
        osc.stop(ctx.currentTime + index * 0.12 + 0.35);
      });
    } catch (e) {
      console.warn('AudioContext failed:', e);
    }
  };

  // Fetch Welfare Leaderboard
  const fetchWelfareLeaderboard = async () => {
    try {
      const res = await fetch(`${API_URL}/user/leaderboard`);
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch leaderboard:', err);
    }
  };

  useEffect(() => {
    fetchWelfareLeaderboard();
  }, []);

  // 1. Perform Check-in
  const handleCheckin = async () => {
    if (!token) {
      triggerToast('請先進行安全登入！', 'error');
      return;
    }
    setLoadingCheckin(true);
    try {
      const res = await fetch(`${API_URL}/user/checkin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '簽到成功！', 'success');
        setKeysCount(data.keys_count);
        setCheckinStreak(data.checkin_streak);
        setTotalCheckins(data.total_checkins);
        setLastCheckin(data.last_checkin);
        fetchData();
        fetchWelfareLeaderboard();
      } else {
        triggerToast(data.message || '簽到失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('簽到連線失敗：' + err.message, 'error');
    } finally {
      setLoadingCheckin(false);
    }
  };

  // 2. Toggle Reminder subscription
  const handleToggleReminder = async () => {
    if (!token) {
      triggerToast('請先進行安全登入！', 'error');
      return;
    }
    setLoadingReminder(true);
    const subscribeNextVal = subscribeReminder !== 1;
    try {
      const res = await fetch(`${API_URL}/user/reminder-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subscribe: subscribeNextVal })
      });
      const data = await res.json();
      if (data.success) {
        setSubscribeReminder(data.subscribe ? 1 : 0);
        triggerToast(data.message || '提醒設定更新成功！', 'success');
        fetchData();
      } else {
        triggerToast(data.message || '設定更新失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('連線 API 錯誤：' + err.message, 'error');
    } finally {
      setLoadingReminder(false);
    }
  };

  // 3. Playtime Exchange
  const handleExchangePlaytime = async () => {
    if (!token) {
      triggerToast('請先進行安全登入！', 'error');
      return;
    }
    setLoadingExchange(true);
    try {
      const res = await fetch(`${API_URL}/playtime/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ mode: exchangeMode })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '時數兌換成功！', 'success');
        setKeysCount(data.keys_count);
        fetchData();
        fetchWelfareLeaderboard();
      } else {
        triggerToast(data.message || '時數兌換失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('兌換連線失敗：' + err.message, 'error');
    } finally {
      setLoadingExchange(false);
    }
  };

  // 3.5 Buy Key with $10,000 Money
  const [loadingBuyKey, setLoadingBuyKey] = useState(false);
  const handleBuyKeyWithMoney = async () => {
    if (!token) {
      triggerToast('請先進行安全登入！', 'error');
      return;
    }
    setLoadingBuyKey(true);
    try {
      const res = await fetch(`${API_URL}/user/buy-key-with-money`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '購買成功！', 'success');
        setKeysCount(data.keys_count);
        fetchData();
        fetchWelfareLeaderboard();
      } else {
        triggerToast(data.message || '購買失敗', 'error');
      }
    } catch (err: any) {
      triggerToast('購買連線失敗：' + err.message, 'error');
    } finally {
      setLoadingBuyKey(false);
    }
  };

  const [customDrawInput, setCustomDrawInput] = useState<string>('1');

  // 4. Spin Lucky Draw (Roulette Animation)
  const handleLuckyDraw = async (requestedCount: number | 'all' = 1) => {
    if (!token) {
      triggerToast('請先進行安全登入！', 'error');
      return;
    }
    if (keysCount < 1) {
      triggerToast('您的鑰匙餘額不足！', 'error');
      return;
    }
    if (isSpinning) return;

    setIsSpinning(true);

    try {
      const res = await fetch(`${API_URL}/user/luckydraw`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ count: requestedCount })
      });
      const data = await res.json();
      if (!data.success) {
        triggerToast(data.message || '抽獎失敗', 'error');
        setIsSpinning(false);
        return;
      }

      // Decrement key count locally
      setKeysCount(data.keys_count);
      fetchData();

      // Setup Case Spinner Items (Construct 60 cards, winning one at index 50)
      const winPrize = PRIZE_POOL.find(p => p.id === data.reward.id) || PRIZE_POOL[5]; // fallback to gold
      const fullList: typeof PRIZE_POOL = [];
      for (let i = 0; i < 60; i++) {
        if (i === 50) {
          fullList.push({
            ...winPrize,
            name: data.reward.name // Use exact display name from server (e.g. including random money)
          });
        } else {
          // Fill with random items from pool
          const randomIdx = Math.floor(Math.random() * PRIZE_POOL.length);
          fullList.push(PRIZE_POOL[randomIdx]);
        }
      }

      setSpinPrizes(fullList);

      // Reset animation position
      const container = spinContainerRef.current;
      if (container) {
        container.style.transition = 'none';
        container.style.transform = 'translateX(0px)';
      }

      // Trigger animation after DOM update
      setTimeout(() => {
        const container = spinContainerRef.current;
        if (!container) return;

        const cardWidth = 112; // width 96px + gap 16px (112px total per card)
        const viewportWidth = container.parentElement?.getBoundingClientRect().width || 500;
        
        // Target: Center the winning card (index 50)
        const insideCardOffset = Math.floor(Math.random() * 40) - 20; 
        const targetTranslateX = -(50 * cardWidth - (viewportWidth / 2 - cardWidth / 2) + insideCardOffset);

        // Apply smooth deceleration transition curve
        container.style.transition = 'transform 5s cubic-bezier(0.12, 0.8, 0.38, 1)';
        container.style.transform = `translateX(${targetTranslateX}px)`;

        // Track sound sync (tick when a card passes the center line)
        const centerLineX = viewportWidth / 2;
        let lastPassedIndex = -1;

        const checkTick = () => {
          if (!container) return;
          const rect = container.getBoundingClientRect();
          const parentRect = container.parentElement?.getBoundingClientRect();
          if (!parentRect) return;

          const currentScroll = parentRect.left - rect.left;
          const centerCardIndex = Math.floor((currentScroll + centerLineX) / cardWidth);

          if (centerCardIndex !== lastPassedIndex && centerCardIndex >= 0 && centerCardIndex < 60) {
            lastPassedIndex = centerCardIndex;
            playTickSound();
          }

          spinAnimationFrameRef.current = requestAnimationFrame(checkTick);
        };

        spinAnimationFrameRef.current = requestAnimationFrame(checkTick);

        // Animation Completion
        setTimeout(() => {
          if (spinAnimationFrameRef.current) {
            cancelAnimationFrame(spinAnimationFrameRef.current);
          }
          playLevelUpSound();
          if (data.count_drawn && data.count_drawn > 1) {
            triggerToast(`🎉 批量抽獎完成 (${data.count_drawn} 抽)！共獲得 $${data.total_money} 金幣與物資！`, 'success');
          } else {
            triggerToast(`🎉 恭喜您獲得：${data.reward.name}！`, 'success');
          }
          setIsSpinning(false);
          fetchData();
          fetchWelfareLeaderboard();
        }, 5000);

      }, 50);

    } catch (err: any) {
      triggerToast('抽獎連線失敗：' + err.message, 'error');
      setIsSpinning(false);
    }
  };

  // Clean animation frame on unmount
  useEffect(() => {
    return () => {
      if (spinAnimationFrameRef.current) cancelAnimationFrame(spinAnimationFrameRef.current);
    };
  }, []);

  const [welfareSubTab, setWelfareSubTab] = useState<'checkin' | 'lottery' | 'leaderboard'>('checkin');

  return (
    <div className="space-y-6 text-left">
      
      {/* 頂部引言與分頁導航 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-lg font-black text-foreground flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            <span>福利中心</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">每日簽到領取鑰匙、遊戲時數兌換、幸運抽獎與榮譽榜單。</p>
        </div>

        {/* 福利中心選單頁籤 */}
        <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg border border-border shrink-0 text-xs font-bold">
          <button
            onClick={() => setWelfareSubTab('checkin')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              welfareSubTab === 'checkin' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            每日簽到與兌換
          </button>
          <button
            onClick={() => setWelfareSubTab('lottery')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              welfareSubTab === 'lottery' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            幸運大抽獎
          </button>
          <button
            onClick={() => setWelfareSubTab('leaderboard')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              welfareSubTab === 'leaderboard' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            簽到榮譽榜
          </button>
        </div>
      </div>

      {/* 分頁 1: 每日簽到與時數金幣兌換 */}
      {welfareSubTab === 'checkin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* 左側：每日簽到 */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-bold flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span>每日簽到福利</span>
                  </CardTitle>
                  
                  {/* 提醒設定切換按鈕 */}
                  {token && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleToggleReminder}
                      disabled={loadingReminder}
                      className="h-8 px-2 text-[10px] font-bold border border-border"
                    >
                      {subscribeReminder === 1 ? (
                        <>
                          <Bell className="w-3.5 h-3.5 mr-1 text-emerald-500 animate-wiggle" />
                          <span className="text-emerald-500">已開啟提醒</span>
                        </>
                      ) : (
                        <>
                          <BellOff className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                          <span className="text-muted-foreground">提醒已關閉</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <CardDescription className="text-left text-[11px]">
                  每日簽到可獲得鑰匙 +1。連續簽到滿 7 天可加碼獲得鑰匙 +3 並重新計算！
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* 簽到統計數據格 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border border-border p-3 rounded-[4px] text-center bg-muted/20">
                    <Flame className="w-5 h-5 text-red-500 mx-auto mb-1.5" />
                    <span className="text-[10px] text-muted-foreground font-bold">連續簽到</span>
                    <p className="text-lg font-black text-foreground mt-0.5">{checkinStreak} 天</p>
                  </div>
                  <div className="border border-border p-3 rounded-[4px] text-center bg-muted/20">
                    <Calendar className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                    <span className="text-[10px] text-muted-foreground font-bold">累計簽到</span>
                    <p className="text-lg font-black text-foreground mt-0.5">{totalCheckins} 次</p>
                  </div>
                  <div className="border border-border p-3 rounded-[4px] text-center bg-muted/20">
                    <Key className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                    <span className="text-[10px] text-muted-foreground font-bold">鑰匙餘額</span>
                    <p className="text-lg font-black text-foreground mt-0.5">{keysCount} 把</p>
                  </div>
                  <div className="border border-border p-3 rounded-[4px] text-center bg-muted/20">
                    <Clock className="w-5 h-5 text-blue-500 mx-auto mb-1.5" />
                    <span className="text-[10px] text-muted-foreground font-bold">上次簽到</span>
                    <p className="text-[11px] font-black text-foreground mt-2 truncate">
                      {lastCheckin || '無紀錄'}
                    </p>
                  </div>
                </div>

                {/* 簽到動作按鈕 */}
                <div className="flex flex-col items-center">
                  {alreadyCheckedInToday ? (
                    <Button disabled className="w-full md:w-64 h-11 text-xs font-bold bg-muted text-muted-foreground">
                      今日已完成簽到
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleCheckin} 
                      disabled={loadingCheckin || !token}
                      className="w-full md:w-64 h-11 text-xs font-bold gap-2"
                    >
                      {loadingCheckin ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                      ) : (
                        <>
                          <Calendar className="w-4 h-4" />
                          <span>點擊進行今日簽到</span>
                        </>
                      )}
                    </Button>
                  )}
                  {!token && (
                    <p className="text-[10px] text-red-500 mt-2 font-bold">請先點擊右上角「Discord 帳號登入」驗證後再進行簽到</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右側：時數與金幣購買鑰匙 */}
          <div className="space-y-6">
            {/* 遊戲時數兌換 */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-purple-500" />
                  <span>遊戲時數兌換鑰匙</span>
                </CardTitle>
                <CardDescription className="text-left text-[11px]">
                  兌換比率為 <span className="font-black text-purple-500">5 小時</span> (360,000 tick) 可換取 <span className="font-black text-amber-500">1 把</span> 鑰匙。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2 border border-border p-1 bg-muted/20 rounded-[4px]">
                  <button 
                    onClick={() => setExchangeMode('single')}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-[2px] transition-colors cursor-pointer ${
                      exchangeMode === 'single' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    單把兌換 (5hr)
                  </button>
                  <button 
                    onClick={() => setExchangeMode('all')}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-[2px] transition-colors cursor-pointer ${
                      exchangeMode === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    兌換所有可能鑰匙
                  </button>
                </div>

                <div className="flex items-center justify-between px-3 py-2 bg-muted/10 border border-border rounded-[4px]">
                  <div className="text-left">
                    <span className="text-[9px] text-muted-foreground block leading-none font-bold">消耗時數</span>
                    <span className="text-xs font-black text-purple-400">
                      {exchangeMode === 'single' ? '5 小時' : '所有可用時數'}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="text-right">
                    <span className="text-[9px] text-muted-foreground block leading-none font-bold">獲得獎勵</span>
                    <span className="text-xs font-black text-amber-500">
                      {exchangeMode === 'single' ? '+1 鑰匙' : '加算鑰匙'}
                    </span>
                  </div>
                </div>

                <Button 
                  onClick={handleExchangePlaytime}
                  disabled={loadingExchange || !token}
                  className="w-full h-10 text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 disabled:bg-muted"
                >
                  {loadingExchange ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                  ) : '執行時數兌換'}
                </Button>
              </CardContent>
            </Card>

            {/* 金幣購買抽獎鑰匙 */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold flex items-center space-x-2">
                  <Key className="w-4 h-4 text-emerald-500" />
                  <span>金幣購買鑰匙 ($10,000 / 把)</span>
                </CardTitle>
                <CardDescription className="text-left text-[11px]">
                  將遊戲內積攢的金幣向系統兌換大理石抽獎鑰匙！
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/10 border border-border rounded-[4px]">
                  <div className="text-left">
                    <span className="text-[9px] text-muted-foreground block leading-none font-bold">花費金幣</span>
                    <span className="text-xs font-black text-emerald-500">$10,000 元</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="text-right">
                    <span className="text-[9px] text-muted-foreground block leading-none font-bold">獲得鑰匙</span>
                    <span className="text-xs font-black text-amber-500">+1 鑰匙</span>
                  </div>
                </div>

                <Button 
                  onClick={handleBuyKeyWithMoney}
                  disabled={loadingBuyKey || !token}
                  className="w-full h-10 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-muted"
                >
                  {loadingBuyKey ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                  ) : '花費 $10,000 購買 1 把鑰匙'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 分頁 2: 幸運大抽獎 (開箱輪盤) */}
      {welfareSubTab === 'lottery' && (
        <div className="space-y-6 animate-fade-in">
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-bold flex items-center space-x-2">
                  <Gift className="w-4 h-4 text-amber-500" />
                  <span>幸運大抽獎 (消耗 1 把鑰匙)</span>
                </CardTitle>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSoundEnabled(!soundEnabled)} 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground border border-border"
                  title={soundEnabled ? '關閉音效' : '開啟音效'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-500" /> : <VolumeX className="w-4 h-4" />}
                </Button>
              </div>
              <CardDescription className="text-left text-[11px]">
                點擊抽獎後，輪盤將快速旋轉並慢慢減速。抽中獎品若玩家在線，直接發送至背包，若離線則以快遞郵件發送！
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* CS:GO 箱子旋轉輪盤視窗 */}
              <div className="relative border border-border bg-muted/30 rounded-[4px] py-4 overflow-hidden h-28 flex items-center">
                
                {/* 中心指標線 */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-rose-500 z-10 shadow-[0_0_8px_rgba(244,63,94,0.8)]">
                  <div className="absolute top-0 -left-1 w-2.5 h-2.5 bg-rose-500 rotate-45"></div>
                  <div className="absolute bottom-0 -left-1 w-2.5 h-2.5 bg-rose-500 rotate-45"></div>
                </div>

                {/* 卡片滑動軌道 */}
                <div 
                  ref={spinContainerRef}
                  className="flex space-x-4 px-4 will-change-transform"
                  style={{ transform: 'translateX(0px)' }}
                >
                  {spinPrizes.length > 0 ? (
                    spinPrizes.map((prize, idx) => (
                      <div 
                        key={idx}
                        className={`w-24 h-20 border-2 rounded-[2px] flex flex-col items-center justify-center shrink-0 select-none ${prize.color}`}
                      >
                        <MinecraftItemIcon itemId={prize.id} className="w-9 h-9 object-contain" />
                        <span className="text-[9px] font-black mt-1 truncate max-w-full px-1">{prize.name}</span>
                      </div>
                    ))
                  ) : (
                    PRIZE_POOL.concat(PRIZE_POOL).map((prize, idx) => (
                      <div 
                        key={idx}
                        className={`w-24 h-20 border-2 rounded-[2px] flex flex-col items-center justify-center shrink-0 opacity-40 ${prize.color}`}
                      >
                        <MinecraftItemIcon itemId={prize.id} className="w-9 h-9 object-contain" />
                        <span className="text-[9px] font-black mt-1 truncate max-w-full px-1">{prize.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 抽獎動作按鈕 */}
              <div className="flex flex-col items-center space-y-3">
                <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                  <Button 
                    onClick={() => handleLuckyDraw(1)} 
                    disabled={isSpinning || keysCount < 1 || !token}
                    className="h-10 px-4 text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-600 disabled:bg-muted"
                  >
                    {isSpinning ? '旋轉中...' : '1 抽 (消耗 1 鑰匙)'}
                  </Button>
                  <Button 
                    onClick={() => handleLuckyDraw(10)} 
                    disabled={isSpinning || keysCount < 10 || !token}
                    className="h-10 px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted"
                  >
                    10 連抽
                  </Button>
                  <Button 
                    onClick={() => handleLuckyDraw('all')} 
                    disabled={isSpinning || keysCount < 1 || !token}
                    className="h-10 px-4 text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:bg-muted"
                  >
                    一鍵全抽 ({keysCount} 把)
                  </Button>
                </div>

                <div className="flex items-center space-x-2 w-full max-w-xs pt-1">
                  <input
                    type="number"
                    min="1"
                    max={keysCount}
                    value={customDrawInput}
                    onChange={(e) => setCustomDrawInput(e.target.value)}
                    placeholder="自訂抽數"
                    className="w-24 h-9 px-2 text-xs border border-border bg-muted/20 rounded-[4px] text-center"
                  />
                  <Button
                    onClick={() => {
                      const num = parseInt(customDrawInput, 10);
                      if (!isNaN(num) && num > 0) handleLuckyDraw(num);
                    }}
                    disabled={isSpinning || keysCount < 1 || !token}
                    className="flex-1 h-9 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground"
                  >
                    自動輸入抽數
                  </Button>
                </div>

                <div className="text-[10px] text-muted-foreground pt-1">
                  目前剩餘 <span className="font-bold text-foreground">{keysCount}</span> 把鑰匙
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 分頁 3: 簽到與鑰匙榮譽榜 */}
      {welfareSubTab === 'leaderboard' && (
        <div className="space-y-6 animate-fade-in">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>簽到與鑰匙榮譽榜 (Check-in & Key Leaderboard Top 10)</span>
              </CardTitle>
              <CardDescription className="text-left text-[11px]">
                全伺服器累積鑰匙數最多、簽到最勤奮之冒險者榮譽榜單。
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="border-t border-border">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-16 text-center text-[10px] font-black h-8">排名</TableHead>
                    <TableHead className="text-left text-[10px] font-black h-8">玩家</TableHead>
                    <TableHead className="text-center text-[10px] font-black h-8">擁有的鑰匙</TableHead>
                    <TableHead className="text-center text-[10px] font-black h-8">連續簽到天數</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.length > 0 ? (
                    leaderboard.map((player: any, idx: number) => {
                      let rankBadge = (
                        <span className="w-5 h-5 rounded-full bg-muted border border-border inline-flex items-center justify-center font-mono text-[9px] font-bold text-muted-foreground">
                          {idx + 1}
                        </span>
                      );
                      if (idx === 0) rankBadge = (
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-500 inline-flex items-center justify-center font-mono text-[10px] font-black">
                          1
                        </span>
                      );
                      else if (idx === 1) rankBadge = (
                        <span className="w-5 h-5 rounded-full bg-slate-300/20 border border-slate-300/40 text-slate-300 inline-flex items-center justify-center font-mono text-[10px] font-black">
                          2
                        </span>
                      );
                      else if (idx === 2) rankBadge = (
                        <span className="w-5 h-5 rounded-full bg-amber-700/20 border border-amber-700/40 text-amber-600 inline-flex items-center justify-center font-mono text-[10px] font-black">
                          3
                        </span>
                      );
                      const name = player.mc_username || player.username || '匿名玩家';
                      return (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell className="text-center text-xs py-2 font-bold h-9">
                            {rankBadge}
                          </TableCell>
                          <TableCell className="text-left text-xs py-2 font-bold truncate h-9">
                            <div className="flex items-center space-x-2">
                              <img 
                                src={`https://mc-heads.net/avatar/${name}/20`} 
                                alt={name}
                                className="w-5 h-5 rounded border border-border shrink-0"
                              />
                              <span className="font-bold text-xs">{name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-xs py-2 font-black text-amber-500 font-mono h-9">
                            {player.keys_count || 0} 把
                          </TableCell>
                          <TableCell className="text-center text-xs py-2 font-bold text-red-400 font-mono h-9">
                            {player.checkin_streak || 0} 天
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                        暫無榜單數據
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 個人稱號配戴面板 */}
          <Card className="border-border">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-500" />
                  個人解鎖稱號配戴
                </span>
                {activeTitle && (
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-500 px-2 py-0.5 rounded font-bold">
                    當前佩戴：[{activeTitle}]
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-[11px]">
                點擊已解鎖的稱號即可實時佩戴至遊戲頭頂與聊天欄。
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {!token ? (
                <p className="text-xs text-muted-foreground text-center py-4">請先登入帳號以檢視個人解鎖稱號</p>
              ) : unlockedTitles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">您目前尚無解鎖任何專屬稱號</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {unlockedTitles.map((t, idx) => {
                    const isEquipped = activeTitle === t;
                    return (
                      <Button
                        key={idx}
                        disabled={loadingTitles}
                        onClick={() => handleEquipTitle(t)}
                        size="sm"
                        variant={isEquipped ? 'default' : 'outline'}
                        className="text-xs font-bold gap-1.5"
                      >
                        <span>{t}</span>
                        {isEquipped && <span className="text-[9px] bg-white/20 px-1 rounded">使用中</span>}
                      </Button>
                    );
                  })}
                </div>
              )}

              {activeTitle && (
                <div className="pt-2 border-t border-border flex justify-end">
                  <Button
                    disabled={loadingTitles}
                    onClick={() => handleEquipTitle('')}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    卸下當前稱號
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
