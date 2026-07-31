import { useState, useEffect } from 'react';
import { CheckSquare, Trophy, Clock, Sparkles, Award, RefreshCw, CheckCircle2, Gift } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';

interface TasksViewProps {
  API_URL: string;
  token: string | null;
  username: string | null;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function TasksView({ API_URL, token, triggerToast }: TasksViewProps) {
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [globalGoal, setGlobalGoal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Daily Tasks
      if (token) {
        const tasksRes = await fetch(`${API_URL}/user/daily-tasks`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const tasksData = await tasksRes.json();
        if (tasksData.success) {
          setDailyTasks(tasksData.tasks || []);
        }
      }

      // 2. Fetch Global Bounty Goal
      const goalRes = await fetch(`${API_URL}/bounty/global`);
      const goalData = await goalRes.json();
      if (goalData.success) {
        setGlobalGoal(goalData.goal || null);
      }
    } catch (err) {
      console.error('Error fetching tasks data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleClaimTask = async (taskId: string) => {
    if (!token) {
      triggerToast('請先登入帳號！', 'error');
      return;
    }
    setClaimingId(taskId);
    try {
      const res = await fetch(`${API_URL}/user/claim-daily-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ taskId })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '任務獎勵領取成功！', 'success');
        fetchData();
      } else {
        triggerToast(data.message || '領取失敗！', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setClaimingId(null);
    }
  };

  const handlePlaytimeExchange = async (mode: 'single' | 'all' = 'single') => {
    if (!token) {
      triggerToast('請先登入帳號！', 'error');
      return;
    }
    setExchanging(true);
    try {
      const res = await fetch(`${API_URL}/user/exchange-playtime`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mode })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(data.message || '時數兌換成功！', 'success');
        fetchData();
      } else {
        triggerToast(data.message || '兌換失敗！', 'error');
      }
    } catch (err: any) {
      triggerToast('請求失敗：' + err.message, 'error');
    } finally {
      setExchanging(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 頁頭標題區 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <CheckSquare className="w-7 h-7 text-primary" />
            伺服器任務與狂歡
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            完成每日目標、全服狂歡活動與遊戲時數兌換獲取豐厚獎勵與幸運鑰匙！
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="gap-2 self-start md:self-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          重新整理
        </Button>
      </div>

      {/* 1. 全服狂歡共同目標 (Global Bounty) */}
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Trophy className="w-48 h-48 text-primary" />
        </div>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 animate-pulse" />
              全服狂歡活動
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary font-bold">
              全體玩家共同參與
            </span>
          </div>
          <CardTitle className="text-xl font-black mt-2">
            {globalGoal?.title || '⚔️ 全服大討伐：怪物獵人考驗'}
          </CardTitle>
          <CardDescription>
            {globalGoal?.description || '全服玩家擊殺指定怪物達標，每位在線玩家皆可獲得全服狂歡禮包！'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-muted-foreground">目前全服總累計進度</span>
              <span className="text-primary">
                {globalGoal?.current_progress || 0} / {globalGoal?.target_goal || 3000}
              </span>
            </div>
            <div className="w-full bg-muted/60 h-3.5 rounded-full overflow-hidden border border-border p-0.5">
              <div 
                className="bg-gradient-to-r from-primary/80 to-primary h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, Math.max(0, ((globalGoal?.current_progress || 0) / (globalGoal?.target_goal || 3000)) * 100))}%` 
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="bg-background/60 border border-border rounded-lg p-3 flex items-center gap-3">
              <Gift className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground font-bold">目標達成獎勵</p>
                <p className="text-xs font-black text-foreground">$2,000 金幣 + 鑰匙 x2</p>
              </div>
            </div>
            <div className="bg-background/60 border border-border rounded-lg p-3 flex items-center gap-3">
              <Trophy className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground font-bold">解鎖全服稱號</p>
                <p className="text-xs font-black text-foreground">[怪物獵人] 限定稱號</p>
              </div>
            </div>
            <div className="bg-background/60 border border-border rounded-lg p-3 flex items-center gap-3">
              <Award className="w-5 h-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground font-bold">活動狀態</p>
                <p className="text-xs font-black text-foreground flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${(globalGoal?.current_progress || 0) >= (globalGoal?.target_goal || 3000) ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  <span>{(globalGoal?.current_progress || 0) >= (globalGoal?.target_goal || 3000) ? '目標已達成' : '熱血進行中'}</span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. 每日個人任務列表 (Daily Tasks) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            個人每日任務
          </h2>

          {!token ? (
            <Card className="border-border text-center py-12">
              <CardContent className="space-y-3">
                <CheckSquare className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm font-bold text-muted-foreground">請登入 Discord 帳號以檢視與領取每日任務</p>
              </CardContent>
            </Card>
          ) : dailyTasks.length === 0 ? (
            <Card className="border-border text-center py-12">
              <CardContent className="space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-foreground">今日任務已全數完成！明日零點重置！</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {dailyTasks.map((task, idx) => (
                <Card key={task.id || idx} className="border-border hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-foreground">{task.title || `任務 #${idx + 1}`}</span>
                        {task.claimed && (
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-500 font-bold px-2 py-0.5 rounded-full">
                            已領取
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{task.desc || task.description}</p>
                      <div className="flex items-center gap-3 pt-1 text-xs text-primary font-bold">
                        <span>獎勵: ${task.reward_money || 500} 元</span>
                        {task.reward_keys > 0 && <span>鑰匙 x{task.reward_keys}</span>}
                      </div>
                    </div>

                    <Button
                      disabled={task.claimed || claimingId === task.id}
                      onClick={() => handleClaimTask(task.id)}
                      size="sm"
                      className="shrink-0 font-bold"
                      variant={task.claimed ? 'outline' : 'default'}
                    >
                      {task.claimed ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 已完成
                        </span>
                      ) : claimingId === task.id ? (
                        '領取中...'
                      ) : (
                        '領取獎勵'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 3. 遊戲時數兌換區 (Playtime Exchange) */}
        <div className="space-y-4">
          <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            遊戲時數兌換
          </h2>

          <Card className="border-amber-500/20 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                時數換抽獎鑰匙
              </CardTitle>
              <CardDescription className="text-xs">
                在伺服器遊戲每滿 5 小時，即可免費兌換 1 把幸運大抽獎鑰匙！
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs space-y-1">
                <p className="font-bold text-amber-500">💡 兌換說明：</p>
                <p className="text-muted-foreground">• 累積滿 5 小時可兌換 1 把鑰匙。</p>
                <p className="text-muted-foreground">• 可單次兌換或一鍵全額兌換剩餘時數。</p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  disabled={!token || exchanging}
                  onClick={() => handlePlaytimeExchange('single')}
                  className="w-full font-bold gap-2"
                >
                  <Clock className="w-4 h-4" />
                  {exchanging ? '處理中...' : '兌換 1 把鑰匙 (扣 5hr)'}
                </Button>
                <Button
                  disabled={!token || exchanging}
                  onClick={() => handlePlaytimeExchange('all')}
                  variant="outline"
                  className="w-full font-bold gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  一鍵兌換全部可用時數
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
