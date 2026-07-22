import { Award, Gift, Mail, RefreshCw, TrendingUp, MapPin, Sparkles, ArrowRight, Compass } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';

interface LeaderboardEntry {
  username: string;
  balance: number;
}

interface HomeViewProps {
  stats: {
    totalCirculation: number;
    accumulatedSalesTax: number;
    totalShopsCount: number;
  };
  dailyTasks: any[];
  dailyTasksDate: string;
  activeEvents?: any[];
  onNavigateToEvents?: () => void;
  onNavigateToTab?: (tab: string) => void;
  token: string | null;
  username: string | null;
  userBalance: number;
  checkinStreak: number;
  totalCheckins?: number;
  keysCount: number;
  lastCheckin?: string | null;
  mails: any[];
  leaderboard: LeaderboardEntry[];
  liveTrades: any[];
  fetchData: () => Promise<void>;
  isRefreshing: boolean;
  isOnline: boolean;
  playerCoords: string;
  serverTps: number;
  onClaimReward: () => Promise<void>;
}

export default function HomeView({
  stats,
  dailyTasks,
  dailyTasksDate,
  activeEvents = [],
  onNavigateToEvents,
  onNavigateToTab,
  token,
  username,
  userBalance,
  checkinStreak,
  keysCount,
  mails,
  leaderboard,
  liveTrades,
  fetchData,
  isRefreshing,
  isOnline,
  playerCoords,
  serverTps,
  onClaimReward
}: HomeViewProps) {
  return (
    <div className="space-y-6">
      {/* 1. 頂部「玩家個人英雄名片 Hero Profile Banner」 */}
      {token && username ? (
        <Card className="bg-gradient-to-r from-card via-card to-primary/5 border-primary/20 shadow-md relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
            <Compass className="w-64 h-64 text-primary" />
          </div>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              
              {/* 玩家個人資訊區 */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img 
                    src={`https://mc-heads.net/avatar/${username}/64`} 
                    alt={username}
                    className="w-16 h-16 rounded-xl border-2 border-primary/30 bg-muted shadow-sm"
                  />
                  <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                </div>
                <div className="text-left space-y-1">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-black tracking-tight text-foreground">{username}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isOnline ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border'}`}>
                      {isOnline ? '🟢 遊戲線上' : '🔴 遊戲離線'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center text-emerald-500 font-bold font-mono">
                      💰 ${userBalance.toLocaleString()} 元
                    </span>
                    <span>•</span>
                    <span className="flex items-center font-mono">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                      {playerCoords || '世界 (0, 64, 0)'}
                    </span>
                    <span>•</span>
                    <span className={`font-bold ${serverTps > 18 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      TPS: {serverTps.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 簽到與福利快速統計 */}
              <div className="flex items-center space-x-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 border-border pt-4 lg:pt-0">
                <div className="text-center px-4 py-2 bg-muted/30 border border-border rounded-lg">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">連續簽到</p>
                  <p className="text-base font-black text-primary mt-0.5">{checkinStreak} 天</p>
                </div>
                <div className="text-center px-4 py-2 bg-muted/30 border border-border rounded-lg">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">抽獎鑰匙</p>
                  <p className="text-base font-black text-amber-500 mt-0.5">{keysCount} 把</p>
                </div>
                {onNavigateToTab && (
                  <Button
                    onClick={() => onNavigateToTab('welfare')}
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-sm h-10 px-4 flex items-center space-x-1"
                  >
                    <Gift className="w-4 h-4 mr-1" />
                    <span>簽到與抽獎</span>
                  </Button>
                )}
              </div>

            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-r from-card to-primary/5 border-primary/20">
          <CardContent className="p-6 text-left flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-black text-foreground">👋 歡迎來到 Craft-Core 官方伺服器儀表板</h2>
              <p className="text-xs text-muted-foreground">登入帳號後可同步您的個人遊戲資產、每日任務進度、離線信箱與個人福利！</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🎪 熱門伺服器活動 Banner */}
      {activeEvents && activeEvents.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left shadow-sm">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">🎪 熱門限時活動進行中</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                  {activeEvents.length} 個活動開放中
                </span>
              </div>
              <h3 className="text-sm font-bold text-foreground mt-0.5">{activeEvents[0].title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{activeEvents[0].description}</p>
            </div>
          </div>
          {onNavigateToEvents && (
            <Button
              onClick={onNavigateToEvents}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center space-x-1 shrink-0 self-end sm:self-center"
            >
              <span>檢視所有活動</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}
        </div>
      )}

      {/* 數據統計欄 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-left border-border/60 hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-bold text-[10px]">總流通金幣</CardDescription>
            <CardTitle className="text-2xl font-black mt-1 text-emerald-500 font-mono">
              ${stats.totalCirculation.toLocaleString()} 元
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">全伺服器玩家持有的金幣總額</p>
          </CardContent>
        </Card>

        <Card className="text-left border-border/60 hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-bold text-[10px]">累計收繳稅額</CardDescription>
            <CardTitle className="text-2xl font-black mt-1 text-primary font-mono">
              ${Number(stats.accumulatedSalesTax.toFixed(1)).toLocaleString()} 元
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">箱子商店交易累計徵收的系統稅金</p>
          </CardContent>
        </Card>

        <Card className="text-left border-border/60 hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-bold text-[10px]">營運中箱子商店</CardDescription>
            <CardTitle className="text-2xl font-black mt-1 text-amber-500 font-mono">
              {stats.totalShopsCount} 間
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">當前伺服器中運作中的實體商店總數</p>
          </CardContent>
        </Card>
      </div>

      {/* 下方雙欄主要佈局 (2-Column Responsive Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左欄：每日任務與郵局快遞 (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 今日任務區 */}
          <Card className="text-left">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-emerald-500" />
                <CardTitle className="text-sm font-bold">今日每日任務 — {dailyTasksDate || '載入中...'}</CardTitle>
              </div>
              {!token && (
                <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-bold">
                  登入後同步個人任務進度
                </span>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dailyTasks.map((task, idx) => {
                  const progressPct = Math.min(100, Math.max(0, (task.progress || 0) / task.count * 100));
                  const isCompleted = (task.progress || 0) >= task.count;
                  const isClaimed = task.claimed;
                  return (
                    <div key={idx} className="p-4 bg-muted/30 border border-border rounded-lg flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            task.type === 1 ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                          }`}>
                            {task.type === 1 ? '擊殺任務' : '挖掘任務'}
                          </span>
                          <span className={`text-[10px] font-bold ${isClaimed ? 'text-emerald-500' : isCompleted ? 'text-amber-500 animate-pulse' : 'text-muted-foreground'}`}>
                            {isClaimed ? '已領取' : isCompleted ? '待領取' : '進行中'}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-foreground">
                          {task.type === 1 ? `擊殺 ${task.target}` : `挖掘 ${task.target}`}
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          目標：{task.count} | 獎勵：<span className="text-emerald-500 font-bold">${task.reward}元</span>
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span>進度：{task.progress || 0} / {task.count}</span>
                          <span>{Math.round(progressPct)}%</span>
                        </div>
                        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              isClaimed ? 'bg-emerald-500' : isCompleted ? 'bg-amber-500' : task.type === 1 ? 'bg-rose-500' : 'bg-sky-500'
                            }`} 
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        {token && isCompleted && !isClaimed && (
                          <Button 
                            size="sm" 
                            onClick={() => onClaimReward()} 
                            className="w-full h-8 text-[11px] font-bold mt-2 bg-emerald-500 hover:bg-emerald-600 text-white"
                          >
                            領取任務獎勵 ${task.reward}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {dailyTasks.length === 0 && (
                  <div className="col-span-full py-6 text-center text-xs text-muted-foreground">
                    正在從伺服器獲取每日任務...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 離線快遞收發信箱 */}
          {token && (
            <Card className="text-left">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm font-bold">離線快遞與物品收件箱</CardTitle>
                  </div>
                  {onNavigateToTab && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigateToTab('inventory')}
                      className="text-[11px] text-primary h-7 px-2"
                    >
                      開啟背包細節
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-3 max-h-[260px] overflow-y-auto space-y-2 pr-1">
                {mails.map((mail, idx) => {
                  const isReceiver = mail.receiver_username.toLowerCase() === username?.toLowerCase();
                  const partner = isReceiver ? mail.sender_username : mail.receiver_username;
                  const dateStr = new Date(mail.created_at).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={idx} className="p-3 bg-muted/30 hover:bg-muted/50 border border-border rounded-lg text-xs transition-colors flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                            isReceiver 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {isReceiver ? '收件' : '寄件'}
                          </span>
                          <span className="font-bold text-foreground">{isReceiver ? `來自 ${partner}` : `發往 ${partner}`}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          內容物品：<span className="font-bold text-amber-500">{mail.item_id.replace('minecraft:', '').toUpperCase()}</span> x{mail.quantity}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <span className={`text-[10px] font-bold ${
                          mail.status === 'delivered' ? 'text-emerald-500' : 'text-amber-500'
                        }`}>
                          {mail.status === 'delivered' ? '已送達' : '暫存中'}
                        </span>
                        <p className="text-[9px] text-muted-foreground font-mono">{dateStr}</p>
                      </div>
                    </div>
                  );
                })}
                {mails.length === 0 && (
                  <div className="text-center py-10 text-xs text-muted-foreground">
                    目前暫無任何離線快遞或收件紀錄
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右欄：富豪榜與即時交易日誌 (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 財富富豪榜 */}
          <Card className="text-left">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-bold">伺服器財富富豪榜</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={isRefreshing}
                className="h-7 text-[10px] px-2"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                更新
              </Button>
            </CardHeader>
            <CardContent className="pt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">排名</TableHead>
                    <TableHead>玩家</TableHead>
                    <TableHead className="text-right">餘額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.slice(0, 7).map((player, idx) => {
                    let medal = <span className="font-mono text-muted-foreground">{idx + 1}</span>;
                    if (idx === 0) medal = <span className="text-base">🥇</span>;
                    else if (idx === 1) medal = <span className="text-base">🥈</span>;
                    else if (idx === 2) medal = <span className="text-base">🥉</span>;

                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-bold py-2">{medal}</TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center space-x-2">
                            <img 
                              src={`https://mc-heads.net/avatar/${player.username}/20`} 
                              alt={player.username}
                              className="w-5 h-5 rounded border border-border"
                            />
                            <span className="font-bold text-xs">{player.username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-500 font-mono py-2">
                          ${player.balance.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {leaderboard.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                        目前暫無任何排行榜數據
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 即時交易日誌 */}
          <Card className="text-left flex flex-col">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <CardTitle className="text-sm font-bold">即時交易動態日誌</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-3 overflow-y-auto max-h-[300px] space-y-2.5 pr-1">
              {liveTrades.map((trade, i) => (
                <div key={i} className="p-2.5 bg-muted/30 border border-border rounded-lg text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono">
                    <span>時間：{trade.time}</span>
                    <span className="text-emerald-500 font-bold">金幣：${trade.profit} 元</span>
                  </div>
                  <p className="leading-relaxed text-foreground">
                    玩家 <span className="font-bold text-primary">{trade.buyer}</span> 購買了 
                    <span className="font-bold text-amber-500"> {trade.item} </span>
                    {trade.quantity && <span>x{trade.quantity} </span>}
                    （店主：<span className="text-muted-foreground">{trade.seller}</span>）
                  </p>
                </div>
              ))}
              {liveTrades.length === 0 && (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  目前暫無任何交易紀錄
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
