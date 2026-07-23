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
      const res = await fetch(`${API_URL}/user/exchange-playtime`, {
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

  // 4. Spin Lucky Draw (Roulette Animation)
  const handleLuckyDraw = async () => {
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
        headers: { 'Authorization': `Bearer ${token}` }
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
        // Center position offset = viewportWidth / 2 - cardWidth / 2
        // Slight random offset inside the winning card to prevent landing exactly in the mathematical center
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

          // How far we have scrolled inside the viewport
          const currentScroll = parentRect.left - rect.left;
          // Calculate the card index at the center pointer line
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
          triggerToast(`🎉 恭喜您獲得：${data.reward.name}！`, 'success');
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

  return (
    <div className="space-y-6">
      
      {/* 頂部引言 */}
      <div className="text-left space-y-2">
        <h1 className="text-lg font-black text-foreground">福利中心</h1>
        <p className="text-xs text-muted-foreground">每日簽到領取鑰匙、時數兌換、參與抽獎，祝你幸運抱回不死圖騰與鑽石！</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 左側：每日簽到與提醒設定 */}
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
                每日簽到可獲得 🔑 +1 鑰匙。連續簽到達 🔥 7 天可加碼獲得 🔑 +3 鑰匙並重新計算！
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
                  <Key className="w-5 h-5 text-yellow-500 mx-auto mb-1.5" />
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
                    📅 今日已完成簽到
                  </Button>
                ) : (
                  <Button 
                    onClick={handleCheckin} 
                    disabled={loadingCheckin || !token}
                    className="w-full md:w-64 h-11 text-xs font-bold"
                  >
                    {loadingCheckin ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                    ) : '📅 點擊進行今日簽到'}
                  </Button>
                )}
                {!token && (
                  <p className="text-[10px] text-red-500 mt-2 font-bold">請先點擊右上角「Discord 帳號登入」驗證後再進行簽到</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 幸運大抽獎 (開箱輪盤) */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-bold flex items-center space-x-2">
                  <Gift className="w-4 h-4 text-yellow-500" />
                  <span>幸運大抽獎 (消耗 1 把鑰匙)</span>
                </CardTitle>
                
                {/* 聲音切換按鈕 */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSoundEnabled(!soundEnabled)} 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground border border-border"
                  title={soundEnabled ? '點擊關閉音效' : '點擊啟用音效'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-yellow-500" /> : <VolumeX className="w-4 h-4" />}
                </Button>
              </div>
              <CardDescription className="text-left text-[11px]">
                點擊抽獎後，輪盤將快速旋轉並慢慢減速。本系統與遊戲音效同步！抽中後若玩家在線，直接發送至背包，若離線則以快遞郵件發送。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* CS:GO 箱子旋轉輪盤視窗 */}
              <div className="relative border border-border bg-muted/30 rounded-[4px] py-4 overflow-hidden h-28 flex items-center">
                
                {/* 中心指標線 */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-500 z-10 shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                  <div className="absolute top-0 -left-1 w-2.5 h-2.5 bg-red-500 rotate-45"></div>
                  <div className="absolute bottom-0 -left-1 w-2.5 h-2.5 bg-red-500 rotate-45"></div>
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
                    // 預設靜態顯示一些獎品
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
              <div className="flex flex-col items-center space-y-2">
                <Button 
                  onClick={handleLuckyDraw} 
                  disabled={isSpinning || keysCount < 1 || !token}
                  className="w-full md:w-64 h-11 text-xs font-bold bg-yellow-500 text-black hover:bg-yellow-600 disabled:bg-muted"
                >
                  {isSpinning ? '🎰 輪盤開箱旋轉中...' : `🔑 消耗 1 鑰匙進行抽獎`}
                </Button>
                <div className="text-[10px] text-muted-foreground">
                  目前剩餘 🔑 <span className="font-bold text-foreground">{keysCount}</span> 把鑰匙
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右側：時數兌換與簽到排行榜 */}
        <div className="space-y-6">
          
          {/* 遊戲時數兌換 */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center space-x-2">
                <Clock className="w-4 h-4 text-purple-500" />
                <span>遊戲時數兌換</span>
              </CardTitle>
              <CardDescription className="text-left text-[11px]">
                兌換比率為 ⏳ <span className="font-black text-purple-500">5 小時</span> (360,000 tick) 可換取 🔑 <span className="font-black text-yellow-500">1 把</span> 鑰匙。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* 兌換選項 widget */}
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

              {/* 兌換資訊流程示意 */}
              <div className="flex items-center justify-between px-3 py-2 bg-muted/10 border border-border rounded-[4px]">
                <div className="text-left">
                  <span className="text-[9px] text-muted-foreground block leading-none font-bold">消耗</span>
                  <span className="text-xs font-black text-purple-400">
                    {exchangeMode === 'single' ? '5 小時' : '所有可用時數'}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <div className="text-right">
                  <span className="text-[9px] text-muted-foreground block leading-none font-bold">獲得</span>
                  <span className="text-xs font-black text-yellow-500">
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
                ) : '⏳ 執行時數兌換'}
              </Button>
            </CardContent>
          </Card>

          {/* 金幣購買抽獎鑰匙 ($10,000 / 把) */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold flex items-center space-x-2">
                <Key className="w-4 h-4 text-emerald-500" />
                <span>金幣購買抽獎鑰匙 ($10,000 / 把)</span>
              </CardTitle>
              <CardDescription className="text-left text-[11px]">
                將遊戲內積攢的金幣直接向系統兌換大理石抽獎鑰匙，消耗過剩流動資金！
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
                  <span className="text-[9px] text-muted-foreground block leading-none font-bold">獲得</span>
                  <span className="text-xs font-black text-yellow-500">+1 鑰匙</span>
                </div>
              </div>

              <Button 
                onClick={handleBuyKeyWithMoney}
                disabled={loadingBuyKey || !token}
                className="w-full h-10 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-muted"
              >
                {loadingBuyKey ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                ) : '💰 花費 $10,000 購買 1 把鑰匙'}
              </Button>
            </CardContent>
          </Card>

          {/* 簽到排行榜 (Top 10) */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-yellow-500 animate-pulse" />
                <span>簽到與鑰匙排行榜 (Top 10)</span>
              </CardTitle>
              <CardDescription className="text-left text-[11px]">
                本伺服器最活躍、累積鑰匙數最多之頂尖冒險者名單。
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-72 overflow-y-auto">
                <Table className="border-t border-border">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12 text-center text-[10px] font-black h-8">排名</TableHead>
                      <TableHead className="text-left text-[10px] font-black h-8">玩家</TableHead>
                      <TableHead className="text-center text-[10px] font-black h-8">鑰匙</TableHead>
                      <TableHead className="text-center text-[10px] font-black h-8">連續</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.length > 0 ? (
                      leaderboard.map((player, idx) => {
                        let rankBadge = '👤';
                        if (idx === 0) rankBadge = '🥇';
                        else if (idx === 1) rankBadge = '🥈';
                        else if (idx === 2) rankBadge = '🥉';
                        return (
                          <TableRow key={idx} className="hover:bg-muted/30">
                            <TableCell className="text-center text-xs py-1.5 font-bold h-8">
                              {idx < 3 ? rankBadge : idx + 1}
                            </TableCell>
                            <TableCell className="text-left text-xs py-1.5 font-bold truncate h-8 max-w-[80px]">
                              {player.mc_username}
                            </TableCell>
                            <TableCell className="text-center text-xs py-1.5 font-black text-yellow-500 h-8">
                              🔑 {player.keys_count}
                            </TableCell>
                            <TableCell className="text-center text-xs py-1.5 font-bold text-red-400 h-8">
                              🔥 {player.checkin_streak}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-[10px] text-muted-foreground py-4">
                          尚無排行榜數據
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
}
