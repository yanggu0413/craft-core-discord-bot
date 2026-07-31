import { useState, useEffect } from 'react';
import { Trophy, Flame, Key, DollarSign, RefreshCw, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import PageHeader from '../ui/PageHeader';
import { apiFetch } from '../../lib/api';

interface WealthEntry {
  username: string;
  balance: number;
}

interface WelfareEntry {
  mc_username: string;
  keys_count: number;
  checkin_streak: number;
  total_checkins: number;
}

interface LeaderboardViewProps {
  wealthLeaderboard: WealthEntry[];
  isRefreshing: boolean;
  handleManualRefresh?: () => void;
}

export default function LeaderboardView({
  wealthLeaderboard = [],
  isRefreshing,
  handleManualRefresh
}: LeaderboardViewProps) {
  const [welfareBoard, setWelfareBoard] = useState<WelfareEntry[]>([]);
  const [loadingWelfare, setLoadingWelfare] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'wealth' | 'streak' | 'keys'>('all');

  const fetchWelfareBoard = async () => {
    setLoadingWelfare(true);
    try {
      const res = await apiFetch('/user/leaderboard');
      if (res.ok && res.data?.success) {
        setWelfareBoard(res.data.leaderboard || []);
      }
    } catch (e) {
      console.error('Failed to fetch welfare leaderboard:', e);
    } finally {
      setLoadingWelfare(false);
    }
  };

  useEffect(() => {
    fetchWelfareBoard();
  }, []);

  const streakSorted = [...welfareBoard].sort((a, b) => (b.checkin_streak || 0) - (a.checkin_streak || 0));
  const keysSorted = [...welfareBoard].sort((a, b) => (b.keys_count || 0) - (a.keys_count || 0));

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        icon={Trophy}
        iconColor="text-amber-500"
        title="全服榮譽排行榜"
        description="即時展示全服首富財富榜、每日簽到連簽榜與鑰匙收藏狂人榜"
        badgeText="全服榮譽榜"
        badgeVariant="outline"
        actions={
          handleManualRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleManualRefresh();
                fetchWelfareBoard();
              }}
              disabled={isRefreshing || loadingWelfare}
              className="text-xs flex items-center space-x-1.5 rounded-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(isRefreshing || loadingWelfare) ? 'animate-spin' : ''}`} />
              <span>重新整理榜單</span>
            </Button>
          )
        }
        kpis={[
          { label: "財富榜首富", value: wealthLeaderboard[0]?.username || '尚無', icon: DollarSign, iconColor: "text-emerald-500" },
          { label: "連簽王冠軍", value: streakSorted[0]?.mc_username || '尚無', icon: Flame, iconColor: "text-orange-500" },
          { label: "鑰匙收藏王", value: keysSorted[0]?.mc_username || '尚無', icon: Key, iconColor: "text-amber-500" },
        ]}
      />

      <div className="flex items-center space-x-2 border-b border-border pb-3 overflow-x-auto">
        <Button
          variant={activeTab === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('all')}
          className="text-xs font-semibold rounded-md shrink-0"
        >
          <Sparkles className={`w-3.5 h-3.5 mr-1 ${activeTab === 'all' ? 'text-primary-foreground' : 'text-primary'}`} />
          <span>全部榜單</span>
        </Button>
        <Button
          variant={activeTab === 'wealth' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('wealth')}
          className="text-xs font-semibold rounded-md shrink-0"
        >
          <DollarSign className={`w-3.5 h-3.5 mr-1 ${activeTab === 'wealth' ? 'text-primary-foreground' : 'text-emerald-500'}`} />
          <span>全服首富財富榜</span>
        </Button>
        <Button
          variant={activeTab === 'streak' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('streak')}
          className="text-xs font-semibold rounded-md shrink-0"
        >
          <Flame className={`w-3.5 h-3.5 mr-1 ${activeTab === 'streak' ? 'text-primary-foreground' : 'text-orange-500'}`} />
          <span>簽到連簽榜</span>
        </Button>
        <Button
          variant={activeTab === 'keys' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('keys')}
          className="text-xs font-semibold rounded-md shrink-0"
        >
          <Key className={`w-3.5 h-3.5 mr-1 ${activeTab === 'keys' ? 'text-primary-foreground' : 'text-amber-500'}`} />
          <span>鑰匙狂人榜</span>
        </Button>
      </div>

      <div className={`grid gap-6 ${activeTab === 'all' ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        
        {/* 欄位 1：全服首富榜 */}
        {(activeTab === 'all' || activeTab === 'wealth') && (
          <Card className="rounded-none flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <CardTitle className="text-sm font-bold">全服首富榜</CardTitle>
                </div>
                <Badge variant="outline" className="rounded-md text-[10px]">金幣資產</Badge>
              </div>
              <CardDescription className="text-[11px]">按玩家遊戲幣總數排名</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {wealthLeaderboard && wealthLeaderboard.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">名次</TableHead>
                      <TableHead>玩家</TableHead>
                      <TableHead className="text-right">總資產 ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wealthLeaderboard.slice(0, 10).map((player, index) => (
                      <TableRow key={player.username}>
                        <TableCell className="text-center font-bold font-mono text-xs">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2.5">
                            <img 
                              src={`https://mc-heads.net/avatar/${player.username}/20`} 
                              alt={player.username}
                              className="w-5 h-5 rounded-md border border-border bg-muted shrink-0"
                            />
                            <span className="text-xs font-semibold text-foreground truncate max-w-[90px] inline-block">{player.username}</span>
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
                <div className="p-6 text-center text-xs text-muted-foreground">暫無財富榜單數據</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 欄位 2：簽到連簽榜 */}
        {(activeTab === 'all' || activeTab === 'streak') && (
          <Card className="rounded-none flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <CardTitle className="text-sm font-bold">簽到連簽榜</CardTitle>
                </div>
                <Badge variant="outline" className="rounded-md text-[10px]">連續簽到</Badge>
              </div>
              <CardDescription className="text-[11px]">按連續簽到天數排名</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {streakSorted && streakSorted.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">名次</TableHead>
                      <TableHead>玩家</TableHead>
                      <TableHead className="text-right">連簽天數</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {streakSorted.slice(0, 10).map((player, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-center font-bold font-mono text-xs">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2.5">
                            <img 
                              src={`https://mc-heads.net/avatar/${player.mc_username}/20`} 
                              alt={player.mc_username}
                              className="w-5 h-5 rounded-md border border-border bg-muted shrink-0"
                            />
                            <span className="text-xs font-semibold text-foreground truncate max-w-[90px] inline-block">{player.mc_username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-orange-500">
                          {player.checkin_streak || 0} 天
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">暫無連簽榜單數據</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 欄位 3：鑰匙狂人榜 */}
        {(activeTab === 'all' || activeTab === 'keys') && (
          <Card className="rounded-none flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Key className="w-4 h-4 text-amber-500" />
                  <CardTitle className="text-sm font-bold">鑰匙狂人榜</CardTitle>
                </div>
                <Badge variant="outline" className="rounded-md text-[10px]">鑰匙庫存</Badge>
              </div>
              <CardDescription className="text-[11px]">按擁有的抽獎鑰匙數量排名</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {keysSorted && keysSorted.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">名次</TableHead>
                      <TableHead>玩家</TableHead>
                      <TableHead className="text-right">鑰匙數量</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keysSorted.slice(0, 10).map((player, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-center font-bold font-mono text-xs">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2.5">
                            <img 
                              src={`https://mc-heads.net/avatar/${player.mc_username}/20`} 
                              alt={player.mc_username}
                              className="w-5 h-5 rounded-md border border-border bg-muted shrink-0"
                            />
                            <span className="text-xs font-semibold text-foreground truncate max-w-[90px] inline-block">{player.mc_username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-amber-500">
                          {player.keys_count || 0} 把
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">暫無鑰匙榜單數據</div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
