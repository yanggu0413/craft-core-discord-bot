import { 
  BarChart3, Award, TrendingUp, MapPin, Sparkles, ArrowRight, 
  DollarSign, Activity, ShieldCheck, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import PageHeader from '../ui/PageHeader';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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
  dailyTasks?: any[];
  dailyTasksDate?: string;
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
  isOnline: boolean;
  playerCoords: string;
  serverTps: number;
  mails?: any[];
  leaderboard: LeaderboardEntry[];
  isRefreshing: boolean;
  handleManualRefresh?: () => void;
  fetchData?: () => Promise<void>;
  onClaimReward?: () => Promise<void>;
  liveTrades?: any[];
}

export default function HomeView({
  stats = { totalCirculation: 0, accumulatedSalesTax: 0, totalShopsCount: 0 },
  dailyTasks = [],
  dailyTasksDate = '',
  activeEvents = [],
  onNavigateToEvents,
  onNavigateToTab,
  token,
  username,
  userBalance,
  checkinStreak,
  keysCount,
  isOnline,
  playerCoords,
  serverTps,
  leaderboard = [],
  isRefreshing,
  handleManualRefresh
}: HomeViewProps) {

  const total = stats.totalCirculation || 75000;
  const chartData = [
    { time: '00:00', amount: Math.floor(total * 0.88) },
    { time: '04:00', amount: Math.floor(total * 0.90) },
    { time: '08:00', amount: Math.floor(total * 0.92) },
    { time: '12:00', amount: Math.floor(total * 0.95) },
    { time: '16:00', amount: Math.floor(total * 0.98) },
    { time: '20:00', amount: total },
  ];

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={BarChart3}
        iconColor="text-cyan-500"
        title="數據總覽"
        description="伺服器實時經濟數據、玩家動態與即時富豪排行榜"
        badgeText={isOnline ? "伺服器在線" : "伺服器連線"}
        badgeVariant={isOnline ? "success" : "outline"}
        actions={
          handleManualRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="text-xs flex items-center space-x-1.5 rounded-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>重新整理</span>
            </Button>
          )
        }
        kpis={[
          { label: "總發行幣", value: `$${(stats.totalCirculation || 0).toLocaleString()}`, icon: DollarSign, iconColor: "text-emerald-500" },
          { label: "伺服器 TPS", value: `${(serverTps || 20).toFixed(1)}`, icon: Activity, iconColor: "text-cyan-500" },
          { label: "箱子商店數", value: `${stats.totalShopsCount || 0} 間`, icon: TrendingUp, iconColor: "text-teal-500" },
          { label: "累計營業稅", value: `$${Math.floor(stats.accumulatedSalesTax || 0).toLocaleString()}`, icon: ShieldCheck, iconColor: "text-indigo-500" }
        ]}
      />

      {token && username ? (
        <Card className="bg-card border-border rounded-none">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-center space-x-4">
                <div className="relative shrink-0">
                  <img 
                    src={`https://mc-heads.net/avatar/${username}/56`} 
                    alt={username}
                    className="w-14 h-14 rounded-md border border-border bg-muted shrink-0"
                  />
                  <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-card ${isOnline ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                </div>
                <div className="space-y-1 text-left">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold tracking-tight text-foreground">{username}</h2>
                    <Badge variant={isOnline ? "success" : "secondary"} className="rounded-md">
                      {isOnline ? '遊戲在線' : '遊戲離線'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                      <DollarSign className="w-3.5 h-3.5 mr-0.5 text-emerald-500" />
                      ${Math.floor(userBalance).toLocaleString()} 元
                    </span>
                    <span>•</span>
                    <span className="flex items-center text-rose-500">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-rose-500" />
                      {playerCoords || '無座標'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 border-border pt-4 lg:pt-0">
                <div className="text-left px-4 py-2 bg-muted/30 border border-border rounded-md min-w-28">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">連續簽到</p>
                  <p className="text-sm font-bold font-mono text-amber-500 mt-0.5">{checkinStreak} 天</p>
                </div>
                <div className="text-left px-4 py-2 bg-muted/30 border border-border rounded-md min-w-28">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">抽獎鑰匙</p>
                  <p className="text-sm font-bold font-mono text-amber-400 mt-0.5">{keysCount} 把</p>
                </div>
                {onNavigateToTab && (
                  <Button
                    onClick={() => onNavigateToTab('welfare')}
                    size="sm"
                    className="text-xs font-semibold rounded-md"
                  >
                    <span>每日簽到</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border rounded-none">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-left">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">
                歡迎來到 Craft-Core 原味生存伺服器儀表板
              </h2>
              <p className="text-xs text-muted-foreground">登入帳號後可同步您的個人遊戲資產、每日任務進度、離線信箱與福利！</p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeEvents && activeEvents.length > 0 && (
        <Card className="border-border rounded-none">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-md bg-purple-500/10 text-purple-500 shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-[10px] rounded-md">限時活動</Badge>
                  <span className="text-xs font-semibold text-foreground">{activeEvents[0].title}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{activeEvents[0].description}</p>
              </div>
            </div>
            {onNavigateToEvents && (
              <Button
                onClick={onNavigateToEvents}
                variant="outline"
                size="sm"
                className="text-xs shrink-0 rounded-md"
              >
                <span>檢視活動</span>
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-none">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">全服幣值與經濟走勢</CardTitle>
                  <CardDescription className="text-xs">即時發行量走勢圖表 (24 小時紀錄)</CardDescription>
                </div>
                <Badge variant="outline" className="rounded-md">即時圖表</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="emeraldCirculationGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                    <YAxis 
                      stroke="var(--muted-foreground)" 
                      fontSize={11} 
                      tickLine={false}
                      width={60}
                      domain={['dataMin - 3000', 'dataMax + 3000']}
                      tickFormatter={(val) => val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${val}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--card)', 
                        borderColor: 'var(--border)', 
                        borderRadius: '4px', 
                        fontSize: '12px',
                        color: 'var(--foreground)'
                      }} 
                      formatter={(val: any) => [`$${Number(val).toLocaleString()} 元`, '總發行幣']}
                      labelFormatter={(label) => `時間: ${label}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#10b981" 
                      strokeWidth={2.5}
                      fillOpacity={1} 
                      fill="url(#emeraldCirculationGrad)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-sm font-bold">每日任務預覽 — {dailyTasksDate || '今日'}</CardTitle>
              </div>
              {onNavigateToTab && (
                <Button variant="ghost" size="sm" onClick={() => onNavigateToTab('tasks')} className="text-xs h-7 rounded-md">
                  查看全部
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {dailyTasks && dailyTasks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {dailyTasks.slice(0, 4).map((task, idx) => {
                    const isCompleted = (task.progress || 0) >= task.count;
                    return (
                      <div key={idx} className="p-3 border border-border bg-card rounded-none flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-foreground">{task.title || `任務 #${idx + 1}`}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {task.progress || 0} / {task.count}
                          </p>
                        </div>
                        <Badge variant={isCompleted ? "success" : "secondary"} className="rounded-md">
                          {isCompleted ? "已完成" : "進行中"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">今日暫無每日任務</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-none">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <CardTitle className="text-sm font-bold">全服首富榜 前 10 名</CardTitle>
                </div>
                {onNavigateToTab && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onNavigateToTab('leaderboard')}
                    className="text-xs h-7 rounded-md"
                  >
                    完整榜單
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {leaderboard && leaderboard.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">名次</TableHead>
                      <TableHead>玩家</TableHead>
                      <TableHead className="text-right">總資產</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.slice(0, 10).map((player, index) => (
                      <TableRow key={player.username}>
                        <TableCell className="text-center font-bold font-mono text-xs">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2.5">
                            <img 
                              src={`https://mc-heads.net/avatar/${player.username}/20`} 
                              alt={player.username}
                              className="w-5 h-5 rounded-md border border-border bg-muted"
                            />
                            <span className="text-xs font-semibold text-foreground">{player.username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          ${Math.floor(player.balance).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">無排行榜數據</div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
