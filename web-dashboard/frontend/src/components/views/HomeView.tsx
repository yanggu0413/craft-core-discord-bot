import { Award, Calendar, Key, Mail, RefreshCw, TrendingUp, Activity, MapPin, Sparkles, ArrowRight } from 'lucide-react';
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
  token: string | null;
  username: string | null;
  userBalance: number;
  checkinStreak: number;
  totalCheckins: number;
  keysCount: number;
  lastCheckin: string | null;
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
  token,
  username,
  userBalance,
  checkinStreak,
  totalCheckins,
  keysCount,
  lastCheckin,
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
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-bold text-[10px]">總流通金幣</CardDescription>
            <CardTitle className="text-2xl font-black mt-1">
              ${stats.totalCirculation.toLocaleString()} 元
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">全伺服器已綁定玩家持有的金幣總額</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-bold text-[10px]">累計收繳稅額</CardDescription>
            <CardTitle className="text-2xl font-black mt-1">
              ${Number(stats.accumulatedSalesTax.toFixed(1)).toLocaleString()} 元
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">箱子商店交易累計徵收的系統稅金</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-bold text-[10px]">營運中箱子商店</CardDescription>
            <CardTitle className="text-2xl font-black mt-1">
              {stats.totalShopsCount} 間
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">當前伺服器中運作中的實體商店總數</p>
          </CardContent>
        </Card>
      </div>

      {/* 今日任務區 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-emerald-500" />
            <CardTitle className="text-sm font-bold">今日每日任務 — {dailyTasksDate || '載入中...'}</CardTitle>
          </div>
          {!token && (
            <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-[2px] font-bold">
              登入後可同步您的個人任務進度
            </span>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyTasks.map((task, idx) => {
              const progressPct = Math.min(100, Math.max(0, (task.progress || 0) / task.count * 100));
              const isCompleted = (task.progress || 0) >= task.count;
              const isClaimed = task.claimed;
              return (
                <div key={idx} className="p-4 bg-muted/30 border border-border rounded-[4px] flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-[2px] ${
                        task.type === 1 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      }`}>
                        {task.type === 1 ? '擊殺任務' : '挖掘任務'}
                      </span>
                      <span className={`text-[10px] font-bold ${isClaimed ? 'text-emerald-500' : isCompleted ? 'text-amber-500 animate-pulse' : 'text-muted-foreground'}`}>
                        {isClaimed ? '已領取' : isCompleted ? '待領取' : '進行中'}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm">
                      {task.type === 1 ? `擊殺 ${task.target}` : `挖掘 ${task.target}`}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      目標數量：{task.count} | 獎勵金幣：<span className="text-emerald-500 font-bold">${task.reward}元</span>
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
                          isClaimed ? 'bg-emerald-500' : isCompleted ? 'bg-amber-500' : task.type === 1 ? 'bg-red-500' : 'bg-blue-500'
                        }`} 
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    {token && isCompleted && !isClaimed && (
                      <Button 
                        size="sm" 
                        onClick={() => onClaimReward()} 
                        className="w-full h-8 text-[11px] font-bold mt-2"
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

      {/* 登入後顯示：即時狀態、個人簽到與收件箱 */}
      {token && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 遊戲即時狀態 */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <CardTitle>遊戲即時狀態</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-muted/30 border border-border rounded-[4px] flex items-center justify-between">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold">目前線上狀態</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`}></span>
                      <p className="text-sm font-bold text-foreground">{isOnline ? '線上' : '離線'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 border border-border rounded-[4px] flex items-center justify-between">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold">遊戲內座標</p>
                    <div className="flex items-center space-x-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-sm font-mono font-bold text-foreground">{playerCoords}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 border border-border rounded-[4px] flex items-center justify-between">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold">遊戲內金幣餘額</p>
                    <p className="text-sm font-bold mt-1 text-emerald-500 font-mono">
                      ${userBalance.toLocaleString()} 元
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 border border-border rounded-[4px] flex items-center justify-between">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold">伺服器 TPS</p>
                    <p className={`text-sm font-bold mt-1 ${serverTps > 18 ? 'text-emerald-500' : serverTps > 15 ? 'text-amber-500' : 'text-red-500'}`}>
                      {serverTps.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 個人簽到與抽獎福利 */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-primary" />
                <CardTitle>個人簽到與抽獎福利</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/30 border border-border rounded-[4px]">
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">連續簽到天數</p>
                  <p className="text-xl font-bold mt-1 text-primary">{checkinStreak} 天</p>
                </div>
                <div className="p-3 bg-muted/30 border border-border rounded-[4px]">
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">累計簽到次數</p>
                  <p className="text-xl font-bold mt-1 text-primary">{totalCheckins} 次</p>
                </div>
                <div className="p-3 bg-muted/30 border border-border rounded-[4px] flex items-center justify-between col-span-2">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold">擁有抽獎鑰匙</p>
                    <p className="text-xl font-bold mt-1 text-amber-500">{keysCount} 把</p>
                  </div>
                  <Key className="w-6 h-6 text-amber-500 opacity-60" />
                </div>
              </div>
              <div className="flex justify-between text-[11px] border-t border-border pt-3">
                <span className="text-muted-foreground">上次簽到時間：</span>
                <span className="font-mono text-foreground">{lastCheckin ? lastCheckin : '無紀錄'}</span>
              </div>
            </CardContent>
          </Card>

          {/* 離線快遞收發信箱 */}
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-primary" />
                <CardTitle>離線快遞收發信箱</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto max-h-[220px] space-y-2 pr-1">
              {mails.map((mail, idx) => {
                const isReceiver = mail.receiver_username.toLowerCase() === username?.toLowerCase();
                const partner = isReceiver ? mail.sender_username : mail.receiver_username;
                const dateStr = new Date(mail.created_at).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={idx} className="p-2.5 bg-muted/30 hover:bg-muted/50 border border-border rounded-[4px] text-xs transition-colors flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-1 rounded-[2px] text-[9px] font-bold border ${
                          isReceiver 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                            : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {isReceiver ? '收件' : '寄件'}
                        </span>
                        <span className="font-bold text-foreground">{isReceiver ? `來自 ${partner}` : `發往 ${partner}`}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        物品：<span className="font-bold text-amber-500">{mail.item_id.replace('minecraft:', '').toUpperCase()}</span> x{mail.quantity}
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
                  目前暫無任何離線快遞紀錄
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 底部佈局：富豪榜與即時交易日誌 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 財富富豪榜 */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <CardTitle>伺服器財富富豪榜</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={isRefreshing}
              className="h-7 text-[10px] px-2"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              更新數據
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">排名</TableHead>
                  <TableHead>玩家名稱</TableHead>
                  <TableHead className="text-right">財富餘額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.slice(0, 10).map((player, idx) => {
                  let medal = <span className="font-mono text-muted-foreground">{idx + 1}</span>;
                  if (idx === 0) medal = <span className="text-base">🥇</span>;
                  else if (idx === 1) medal = <span className="text-base">🥈</span>;
                  else if (idx === 2) medal = <span className="text-base">🥉</span>;

                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-bold">{medal}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <img 
                            src={`https://mc-heads.net/avatar/${player.username}/20`} 
                            alt={player.username}
                            className="w-5 h-5 rounded-[2px] border border-border"
                          />
                          <span className="font-bold text-xs">{player.username}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-500 font-mono">
                        ${player.balance.toLocaleString()} 元
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
        <Card className="flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <CardTitle>即時交易動態日誌</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[360px] space-y-3 pr-1">
            {liveTrades.map((trade, i) => (
              <div key={i} className="p-2.5 bg-muted/30 border border-border rounded-[4px] text-[11px] space-y-1">
                <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono">
                  <span>時間：{trade.time}</span>
                  <span className="text-emerald-500 font-bold">金額：${trade.profit} 元</span>
                </div>
                <p className="leading-relaxed text-left text-foreground">
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
          <div className="p-3 text-center text-[9px] text-muted-foreground border-t border-border mt-auto">
            提示：遊戲內交易時，此處將自動同步更新
          </div>
        </Card>
      </div>
    </div>
  );
}
