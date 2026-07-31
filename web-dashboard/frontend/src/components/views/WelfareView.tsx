import { useState, useEffect, useRef } from 'react';
import { 
  Gift, Calendar, Flame, Key, Trophy, 
  Volume2, VolumeX 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import PageHeader from '../ui/PageHeader';
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
  { id: 'minecraft:diamond', name: '鑽石 x 5', color: 'border-border bg-card text-foreground' },
  { id: 'minecraft:golden_carrot', name: '金胡蘿蔔 x 5', color: 'border-border bg-card text-foreground' },
  { id: 'minecraft:golden_apple', name: '金蘋果 x 5', color: 'border-border bg-card text-foreground' },
  { id: 'minecraft:experience_bottle', name: '經驗瓶 x 64', color: 'border-border bg-card text-foreground' },
  { id: 'minecraft:totem_of_undying', name: '不死圖騰 x 1', color: 'border-border bg-card text-foreground' },
  { id: 'craftcore:money', name: '遊戲金幣', color: 'border-border bg-card text-foreground' }
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
  setKeysCount,
  setCheckinStreak,
  setTotalCheckins,
  setLastCheckin,
  API_URL
}: WelfareViewProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingCheckin, setLoadingCheckin] = useState(false);
  const [welfareSubTab, setWelfareSubTab] = useState<'checkin' | 'wheel' | 'leaderboard'>('checkin');

  const [isSpinning, setIsSpinning] = useState(false);
  const [spinPrizes, setSpinPrizes] = useState<typeof PRIZE_POOL>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const spinContainerRef = useRef<HTMLDivElement>(null);
  const spinAnimationFrameRef = useRef<number | null>(null);

  const playTickSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
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
      const notes = [261.63, 329.63, 392.00, 523.25];
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

      const wonItem = data.prize || data.reward || (Array.isArray(data.rewards) ? data.rewards[0] : null) || { id: 'minecraft:gold_ingot', name: '金錠 x5' };
      const keysLeft = data.keys_count ?? data.remaining_keys ?? (keysCount - 1);
      
      setKeysCount(keysLeft);
      fetchData();

      const winPrize = PRIZE_POOL.find(p => p.id === wonItem.id) || PRIZE_POOL[5];
      const fullList: typeof PRIZE_POOL = [];
      for (let i = 0; i < 60; i++) {
        if (i === 50) {
          fullList.push({
            ...winPrize,
            name: wonItem.name || winPrize.name
          });
        } else {
          const randomIdx = Math.floor(Math.random() * PRIZE_POOL.length);
          fullList.push(PRIZE_POOL[randomIdx]);
        }
      }

      setSpinPrizes(fullList);

      const container = spinContainerRef.current;
      if (container) {
        container.style.transition = 'none';
        container.style.transform = 'translateX(0px)';
      }

      setTimeout(() => {
        const container = spinContainerRef.current;
        if (!container) return;

        const cardWidth = 112;
        const viewportWidth = container.parentElement?.getBoundingClientRect().width || 500;
        const insideCardOffset = Math.floor(Math.random() * 40) - 20; 
        const targetTranslateX = -(50 * cardWidth - (viewportWidth / 2 - cardWidth / 2) + insideCardOffset);

        container.style.transition = 'transform 5s cubic-bezier(0.12, 0.8, 0.38, 1)';
        container.style.transform = `translateX(${targetTranslateX}px)`;

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

        setTimeout(() => {
          if (spinAnimationFrameRef.current) {
            cancelAnimationFrame(spinAnimationFrameRef.current);
          }
          playLevelUpSound();
          if (data.count_drawn && data.count_drawn > 1) {
            triggerToast(`🎉 批量抽獎完成 (${data.count_drawn} 抽)！共獲得物資！`, 'success');
          } else {
            triggerToast(`🎉 恭喜您獲得：${wonItem.name || winPrize.name}！`, 'success');
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

  const isCheckedInToday = () => {
    if (!lastCheckin) return false;
    const today = new Date().toISOString().split('T')[0];
    return lastCheckin.startsWith(today);
  };

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={Gift}
        title="福利與簽到大抽獎"
        description="每日登入累積連簽天數領取抽獎鑰匙，參與幸運輪盤大抽獎獲得珍貴物資"
        badgeText={`${keysCount} 把鑰匙`}
        badgeVariant="outline"
        kpis={[
          { label: "抽獎鑰匙", value: `${keysCount} 把`, icon: Key },
          { label: "連續簽到", value: `${checkinStreak} 天`, icon: Flame },
          { label: "總簽到天數", value: `${totalCheckins} 天`, icon: Calendar }
        ]}
      />

      <div className="flex items-center space-x-2 border-b border-border pb-3">
        <Button
          variant={welfareSubTab === 'checkin' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setWelfareSubTab('checkin')}
          className="text-xs font-semibold"
        >
          <Calendar className="w-3.5 h-3.5 mr-1" />
          <span>每日簽到與領取</span>
        </Button>
        <Button
          variant={welfareSubTab === 'wheel' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setWelfareSubTab('wheel')}
          className="text-xs font-semibold"
        >
          <Gift className="w-3.5 h-3.5 mr-1" />
          <span>幸運轉盤大抽獎</span>
        </Button>
        <Button
          variant={welfareSubTab === 'leaderboard' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setWelfareSubTab('leaderboard')}
          className="text-xs font-semibold"
        >
          <Trophy className="w-3.5 h-3.5 mr-1" />
          <span>簽到排行榜</span>
        </Button>
      </div>

      {welfareSubTab === 'checkin' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-bold">每日登入簽到</CardTitle>
                  <CardDescription className="text-xs">
                    每日 00:00 重置，連續簽到天數越高可獲得更多加碼鑰匙。
                  </CardDescription>
                </div>
                <Badge variant={isCheckedInToday() ? "success" : "secondary"}>
                  {isCheckedInToday() ? "今日已簽到" : "今日未簽到"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-border bg-card rounded-lg">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">點擊完成今日簽到</p>
                  <p className="text-xs text-muted-foreground font-mono">上次簽到日期：{lastCheckin || '無紀錄'}</p>
                </div>
                <Button
                  size="sm"
                  disabled={isCheckedInToday() || loadingCheckin || !token}
                  onClick={handleCheckin}
                  className="text-xs font-semibold"
                >
                  {isCheckedInToday() ? '今日已完成簽到' : '立即簽到領取 (+1 鑰匙)'}
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-border bg-card rounded-lg">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">使用遊戲金幣購買鑰匙</p>
                  <p className="text-xs text-muted-foreground">單價：$10,000 遊戲幣 / 1 把鑰匙</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingBuyKey || !token}
                  onClick={handleBuyKeyWithMoney}
                  className="text-xs font-semibold"
                >
                  購買 1 把鑰匙 ($10,000)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {welfareSubTab === 'wheel' && (
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">幸運大輪盤抽獎</CardTitle>
                <CardDescription className="text-xs">消耗抽獎鑰匙獲得豐富實體物資與遊戲金幣獎勵</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="text-xs"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 mr-1" /> : <VolumeX className="w-4 h-4 mr-1" />}
                <span>音效</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="relative w-full h-24 border border-border bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center">
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-primary z-20" />
              
              <div 
                ref={spinContainerRef}
                className="flex space-x-4 px-4 items-center transition-transform"
                style={{ width: 'max-content' }}
              >
                {spinPrizes.length > 0 ? (
                  spinPrizes.map((prize, idx) => (
                    <div 
                      key={idx}
                      className="w-24 h-20 border border-border bg-card rounded-md flex flex-col items-center justify-center shrink-0 p-1"
                    >
                      <MinecraftItemIcon itemId={prize.id} className="w-8 h-8 object-contain" />
                      <span className="text-[10px] font-bold mt-1 text-foreground truncate max-w-full">{prize.name}</span>
                    </div>
                  ))
                ) : (
                  PRIZE_POOL.concat(PRIZE_POOL).map((prize, idx) => (
                    <div 
                      key={idx}
                      className="w-24 h-20 border border-border bg-card rounded-md flex flex-col items-center justify-center shrink-0 p-1 opacity-50"
                    >
                      <MinecraftItemIcon itemId={prize.id} className="w-8 h-8 object-contain" />
                      <span className="text-[10px] font-bold mt-1 text-foreground truncate max-w-full">{prize.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                onClick={() => handleLuckyDraw(1)}
                disabled={isSpinning || keysCount < 1 || !token}
                className="text-xs font-semibold"
              >
                1 抽 (1 鑰匙)
              </Button>
              <Button
                onClick={() => handleLuckyDraw(10)}
                disabled={isSpinning || keysCount < 10 || !token}
                variant="secondary"
                className="text-xs font-semibold"
              >
                10 連抽
              </Button>
              <Button
                onClick={() => handleLuckyDraw('all')}
                disabled={isSpinning || keysCount < 1 || !token}
                variant="outline"
                className="text-xs font-semibold"
              >
                一鍵全抽 ({keysCount} 把)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {welfareSubTab === 'leaderboard' && (
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-bold">簽到與鑰匙排行榜 (前 10 名)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">排名</TableHead>
                  <TableHead>玩家</TableHead>
                  <TableHead className="text-center">擁有的鑰匙</TableHead>
                  <TableHead className="text-center">連續簽到</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.length > 0 ? (
                  leaderboard.map((player, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-center font-mono font-bold text-xs">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <img 
                            src={`https://mc-heads.net/avatar/${player.mc_username}/20`} 
                            alt={player.mc_username}
                            className="w-5 h-5 rounded border border-border"
                          />
                          <span className="text-xs font-semibold text-foreground">{player.mc_username}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-bold text-foreground">
                        {player.keys_count || 0} 把
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-bold text-foreground">
                        {player.checkin_streak || 0} 天
                      </TableCell>
                    </TableRow>
                  ))
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
      )}
    </div>
  );
}
